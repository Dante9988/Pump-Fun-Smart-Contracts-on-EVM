// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;

import "./Token.sol";
import "hardhat/console.sol";

contract MultiAMM {
    struct Pool {
        uint tokenBalanceA;
        uint tokenBalanceB;
        uint K;             // product = tokenBalanceA * tokenBalanceB
        uint totalShares;   // total LP shares for this pool
        bool zeroPriceActive; // true if we only have tokenA added (B=0)
    }

    // poolId => Pool data
    mapping(bytes32 => Pool) public pools;

    // poolId => (user => shares)
    mapping(bytes32 => mapping(address => uint)) public userShares;

    // A basic precision constant
    uint constant PRECISION = 1e18;

    address public WETH9;

    //--------------------------------------------------------------------------
    // EVENTS
    //--------------------------------------------------------------------------

    event Swap(
        address indexed user,
        address indexed tokenIn,
        uint amountIn,
        address indexed tokenOut,
        uint amountOut,
        uint newBalanceA,
        uint newBalanceB,
        uint timestamp
    );

    event AddLiquidity(
        address indexed user,
        address indexed tokenA,
        uint amountA,
        address indexed tokenB,
        uint amountB,
        uint userShare
    );

    event RemoveLiquidity(
        address indexed user,
        address indexed tokenA,
        address indexed tokenB,
        uint shareBurned,
        uint amountAOut,
        uint amountBOut
    );

    //--------------------------------------------------------------------------
    // CONSTRUCTOR
    //--------------------------------------------------------------------------

    /**
     * @param _weth The address of WETH (treated as tokenB in all pools).
     */
    constructor(address _weth) {
        require(_weth != address(0), "WETH = zero address");
        WETH9 = _weth;
    }

    //--------------------------------------------------------------------------
    // INTERNALS
    //--------------------------------------------------------------------------

    /**
     * @dev Sort token addresses so (tokenA < tokenB) for consistent poolId.
     */
    function _getPoolId(address _tokenA, address _tokenB)
        public
        pure
        returns (bytes32)
    {
        require(_tokenA != _tokenB, "IDENTICAL_ADDRESSES");
        (address token0, address token1) =
            _tokenA < _tokenB ? (_tokenA, _tokenB) : (_tokenB, _tokenA);
        return keccak256(abi.encodePacked(token0, token1));
    }

    //--------------------------------------------------------------------------
    // ADD LIQUIDITY
    //--------------------------------------------------------------------------

    //--------------------------------------------------------------------------
    // ADD LIQUIDITY (ZERO PRICE)
    //--------------------------------------------------------------------------

    /**
     * @notice Adds liquidity with only tokenA. WETH side = 0, so price is "0" until the first buy.
     * @param tokenA The address of the non-WETH token.
     * @param amountA How many tokenA to deposit.
     */
    function addLiquidityAtZeroPriceForWETH(address tokenA, uint amountA)
        external
        returns (Pool memory pool)
    {
        require(tokenA != address(0), "Invalid tokenA");
        require(tokenA != WETH9, "TokenA cannot be WETH");

        bytes32 poolId = _getPoolId(tokenA, WETH9);
        pool = pools[poolId];
        require(pool.totalShares == 0, "POOL_ALREADY_INIT");


        require(IERC20(tokenA).approve(address(this), amountA), "approve failed");

        // Transfer only tokenA from msg.sender
        require(
            IERC20(tokenA).transferFrom(msg.sender, address(this), amountA),
            "transferFrom tokenA failed"
        );

        // Decide which side is tokenBalanceA vs tokenBalanceB
        // If tokenA < WETH, then tokenBalanceA = amountA, else tokenBalanceB = amountA
        if (tokenA < WETH9) {
            pool.tokenBalanceA = amountA;
            pool.tokenBalanceB = 0;
        } else {
            pool.tokenBalanceA = 0;
            pool.tokenBalanceB = amountA;
        }

        pool.K = 0; // no second side yet
        pool.zeroPriceActive = true;

        // Mint some initial shares
        uint share = 100 * PRECISION;
        pool.totalShares = share;
        userShares[poolId][msg.sender] = share;

        // Store
        pools[poolId] = pool;

        emit AddLiquidity(msg.sender, tokenA, amountA, WETH9, 0, share);
        return pool;
    }   


    function addLiquidity(
        address _tokenA,
        address _tokenB,
        uint _amountA,
        uint _amountB
    ) public {
        bytes32 poolId = _getPoolId(_tokenA, _tokenB);
        Pool storage pool = pools[poolId];

        // 1. Transfer tokens from user to this contract
        require(Token(_tokenA).transferFrom(msg.sender, address(this), _amountA), "transferFrom A failed");
        require(Token(_tokenB).transferFrom(msg.sender, address(this), _amountB), "transferFrom B failed");

        // 2. Calculate shares
        uint share;
        if (pool.totalShares == 0) {
            // First provider sets the initial share arbitrarily
            share = 100 * PRECISION; 
        } else {
            // Compare ratio to existing reserves
            uint shareA = (pool.totalShares * _amountA) / pool.tokenBalanceA;
            uint shareB = (pool.totalShares * _amountB) / pool.tokenBalanceB;
            // They should be (almost) equal if adding at the correct ratio
            require((shareA / 1e3) == (shareB / 1e3), "SHARES_NOT_EQUAL");
            share = shareA;
        }

        // 3. Update pool
        pool.tokenBalanceA += _amountA;
        pool.tokenBalanceB += _amountB;
        pool.K = pool.tokenBalanceA * pool.tokenBalanceB;

        // 4. Update shares
        pool.totalShares += share;
        userShares[poolId][msg.sender] += share;

        // 5. Emit event
        emit AddLiquidity(msg.sender, _tokenA, _amountA, _tokenB, _amountB, userShares[poolId][msg.sender]);
    }

    //--------------------------------------------------------------------------
    // REMOVE LIQUIDITY
    //--------------------------------------------------------------------------

    function removeLiquidity(
        address _tokenA,
        address _tokenB,
        uint _share
    ) public returns (uint outA, uint outB) {
        bytes32 poolId = _getPoolId(_tokenA, _tokenB);
        Pool storage pool = pools[poolId];

        uint userShare = userShares[poolId][msg.sender];
        require(_share <= userShare, "NOT_ENOUGH_SHARES");

        // 1. Calculate amounts
        outA = (pool.tokenBalanceA * _share) / pool.totalShares;
        outB = (pool.tokenBalanceB * _share) / pool.totalShares;

        // 2. Update shares
        userShares[poolId][msg.sender] = userShare - _share;
        pool.totalShares -= _share;

        // 3. Update pool
        pool.tokenBalanceA -= outA;
        pool.tokenBalanceB -= outB;
        pool.K = pool.tokenBalanceA * pool.tokenBalanceB;

        // 4. Transfer tokens back
        require(Token(_tokenA).transfer(msg.sender, outA), "transfer A failed");
        require(Token(_tokenB).transfer(msg.sender, outB), "transfer B failed");

        // 5. Emit event
        emit RemoveLiquidity(msg.sender, _tokenA, _tokenB, _share, outA, outB);
    }

    //--------------------------------------------------------------------------
    // SWAP
    //--------------------------------------------------------------------------
    // swapExactTokenAforTokenB & swapExactTokenBforTokenA remain the same logic.
    // Just add the Swap event.

function swapExactTokenAforTokenB(
    address _tokenA,
    address _tokenB,
    uint _amountAIn
)
    public
    returns (uint amountBOut)
{
    bytes32 poolId = _getPoolId(_tokenA, _tokenB);
    Pool storage pool = pools[poolId];
    require(pool.tokenBalanceA > 0 && pool.tokenBalanceB > 0, "NO_POOL");

    // 1. Transfer A in
    require(Token(_tokenA).transferFrom(msg.sender, address(this), _amountAIn), "transferFrom A failed");

    if (pool.zeroPriceActive) {
        amountBOut = (_amountAIn * PRECISION) / 1e11;
        require(amountBOut <= pool.tokenBalanceB, "Not enough tokens in pool");
        
        // Update pool balances in correct order
        pool.tokenBalanceB -= amountBOut;
        pool.tokenBalanceA = _amountAIn;  
        pool.K = (pool.tokenBalanceA * pool.tokenBalanceB) / PRECISION;

        pool.zeroPriceActive = false;
    } else {
        // Normal x*y=K math with PRECISION scaling
        uint newBalanceA = pool.tokenBalanceA + _amountAIn;
        uint newBalanceB = pool.K / newBalanceA;
        amountBOut = pool.tokenBalanceB - newBalanceB;
        
        require(amountBOut < pool.tokenBalanceB, "INSUFFICIENT_LIQUIDITY");

        // Update pool balances
        pool.tokenBalanceA = newBalanceA;
        pool.tokenBalanceB = newBalanceB;
        // K remains unchanged
    }

    require(Token(_tokenB).transfer(msg.sender, amountBOut), "transfer B failed");

    emit Swap(
        msg.sender,
        _tokenA,
        _amountAIn,
        _tokenB,
        amountBOut,
        pool.tokenBalanceA,
        pool.tokenBalanceB,
        block.timestamp
    );
}

function swapExactTokenBforTokenA(
    address _tokenA,
    address _tokenB,
    uint _amountBIn
)
    public
    returns (uint amountAOut)
{
    bytes32 poolId = _getPoolId(_tokenA, _tokenB);
    Pool storage pool = pools[poolId];
    require(pool.tokenBalanceA >= 0 && pool.tokenBalanceB >= 0, "NO_POOL");

    // 1. Transfer B in
    require(Token(_tokenB).transferFrom(msg.sender, address(this), _amountBIn), "transferFrom B failed");

    if (pool.zeroPriceActive) {
        // For 1e11 wei (0.0001 ETH) you get 1 token (1e18 wei)
        // So for 1 ETH (1e18 wei) you get 10000 tokens
        uint balanceB = IERC20(_tokenB).balanceOf(address(this));
        console.log("balanceB:", balanceB);
        uint balanceA = IERC20(_tokenA).balanceOf(address(this));
        console.log("balanceA:", balanceA);
        amountAOut = (_amountBIn * PRECISION) / 1e11;
        require(amountAOut <= pool.tokenBalanceA, "Not enough tokens in pool");
        
        // Update pool state
        pool.tokenBalanceA -= amountAOut;
        pool.tokenBalanceB = _amountBIn;
        pool.K = (pool.tokenBalanceA * pool.tokenBalanceB) / PRECISION;

        pool.zeroPriceActive = false;
    } else {
        // Normal x*y=K math with PRECISION scaling
        uint newBalanceB = pool.tokenBalanceB + _amountBIn;
        uint newBalanceA = pool.K / newBalanceB;
        amountAOut = pool.tokenBalanceA - newBalanceA;
        
        require(amountAOut < pool.tokenBalanceA, "INSUFFICIENT_LIQUIDITY");

        // Update pool balances
        pool.tokenBalanceB = newBalanceB;
        pool.tokenBalanceA = newBalanceA;
        // K remains unchanged
    }

    require(Token(_tokenA).transfer(msg.sender, amountAOut), "transfer A failed");

    emit Swap(
        msg.sender,
        _tokenB,
        _amountBIn,
        _tokenA,
        amountAOut,
        pool.tokenBalanceA,
        pool.tokenBalanceB,
        block.timestamp
    );
}

    //--------------------------------------------------------------------------
    // "CALCULATE" VIEW FUNCTIONS
    //--------------------------------------------------------------------------

    // 1. Calculate how many of tokenB is needed if you deposit `_amountA` of tokenA
    function calculateTokenBDeposit(address _tokenA, address _tokenB, uint _amountA)
        public
        view
        returns (uint amountBRequired)
    {
        bytes32 poolId = _getPoolId(_tokenA, _tokenB);
        Pool memory pool = pools[poolId];
        require(pool.tokenBalanceA > 0 && pool.tokenBalanceB > 0, "NO_POOL");
        amountBRequired = (pool.tokenBalanceB * _amountA) / pool.tokenBalanceA;
    }

    // 2. Calculate how many of tokenA is needed if you deposit `_amountB` of tokenB
    function calculateTokenADeposit(address _tokenA, address _tokenB, uint _amountB)
        public
        view
        returns (uint amountARequired)
    {
        bytes32 poolId = _getPoolId(_tokenA, _tokenB);
        Pool memory pool = pools[poolId];
        require(pool.tokenBalanceA > 0 && pool.tokenBalanceB > 0, "NO_POOL");
        amountARequired = (pool.tokenBalanceA * _amountB) / pool.tokenBalanceB;
    }

    // 3. Calculate how many tokenB you'd get if you swapped in `_amountAIn` of tokenA
    function calculateTokenAtoTokenB(address _tokenA, address _tokenB, uint _amountAIn)
        public
        view
        returns (uint amountBOut)
    {
        bytes32 poolId = _getPoolId(_tokenA, _tokenB);
        Pool memory pool = pools[poolId];
        require(pool.tokenBalanceA > 0 && pool.tokenBalanceB > 0, "NO_POOL");

        uint xAfter = pool.tokenBalanceA + _amountAIn;
        uint yAfter = pool.K / xAfter;
        amountBOut = pool.tokenBalanceB - yAfter;
        require(amountBOut < pool.tokenBalanceB, "INSUFFICIENT_LIQUIDITY");
    }

    // 4. Calculate how many tokenA you'd get if you swapped in `_amountBIn` of tokenB
    function calculateTokenBtoTokenA(address _tokenA, address _tokenB, uint _amountBIn)
        public
        view
        returns (uint amountAOut)
    {
        bytes32 poolId = _getPoolId(_tokenA, _tokenB);
        Pool memory pool = pools[poolId];
        require(pool.tokenBalanceA > 0 && pool.tokenBalanceB > 0, "NO_POOL");

        uint yAfter = pool.tokenBalanceB + _amountBIn;
        uint xAfter = pool.K / yAfter;
        amountAOut = pool.tokenBalanceA - xAfter;
        require(amountAOut < pool.tokenBalanceA, "INSUFFICIENT_LIQUIDITY");
        console.log("amountAOut:", amountAOut);
    }

    //--------------------------------------------------------------------------
    // VIEW HELPERS
    //--------------------------------------------------------------------------

    function getPoolBalances(address _tokenA, address _tokenB)
        public
        view
        returns (uint balA, uint balB, uint totalK)
    {
        bytes32 poolId = _getPoolId(_tokenA, _tokenB);
        balA = pools[poolId].tokenBalanceA;
        balB = pools[poolId].tokenBalanceB;
        totalK = pools[poolId].K;
    }

    function getTokenPrice(address _tokenA, address _tokenB)
        external
        view
        returns (uint priceAinB, uint priceBinA)
    {
        console.log('TokenA:', _tokenA);
        console.log('TokenB:', _tokenB);
        bytes32 poolId = _getPoolId(_tokenA, _tokenB);
        Pool memory pool = pools[poolId];
        require(pool.tokenBalanceA >= 0 && pool.tokenBalanceB >= 0, "NO_POOL");
        
        // Price = (balance of quote token * PRECISION) / balance of base token
        priceAinB = (pool.tokenBalanceB * PRECISION) / pool.tokenBalanceA;  // How many tokenB per 1 tokenA
        priceBinA = (pool.tokenBalanceA * PRECISION) / pool.tokenBalanceB;  // How many tokenA per 1 tokenB
    }

    function getUserShare(address _tokenA, address _tokenB, address _user)
        external
        view
        returns (uint shareAmount, uint totalPoolShares)
    {
        bytes32 poolId = _getPoolId(_tokenA, _tokenB);
        shareAmount = userShares[poolId][_user];
        totalPoolShares = pools[poolId].totalShares;
    }
}
