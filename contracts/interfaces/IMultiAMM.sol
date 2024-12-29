// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;

interface IMultiAMM {
    
    // Pool data
    struct Pool {
        uint tokenBalanceA;
        uint tokenBalanceB; 
        uint K;             // product = tokenBalanceA * tokenBalanceB
        uint totalShares;   // total LP shares for this pool
        bool zeroPriceActive; // true if we only have tokenA added (B=0)
    }

    // Events
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

    // Core Functions
    function addLiquidity(
        address _tokenA,
        address _tokenB,
        uint _amountA,
        uint _amountB
    ) external;

    function pools(bytes32) external view returns (Pool memory);

    function addLiquidityAtZeroPrice(
        address _tokenA,
        uint _amountA
    ) external returns (Pool memory pool);

    function removeLiquidity(
        address _tokenA,
        address _tokenB,
        uint _share
    ) external returns (uint outA, uint outB);

    function swapExactTokenAforTokenB(
        address _tokenA,
        address _tokenB,
        uint _amountAIn
    ) external returns (uint amountBOut);

    function swapExactTokenBforTokenA(
        address _tokenA,
        address _tokenB,
        uint _amountBIn
    ) external returns (uint amountAOut);

    // View Functions
    function getPoolBalances(address _tokenA, address _tokenB) 
        external 
        view 
        returns (uint balanceA, uint balanceB, uint K);

    function _getPoolId(address _tokenA, address _tokenB)
        external
        view
        returns (bytes32 poolId);

    function getUserShare(address _tokenA, address _tokenB, address _user)
        external
        view
        returns (uint share, uint totalShares);

    function getTokenPrice(address _tokenA, address _tokenB)
        external
        view
        returns (uint priceAinB, uint priceBinA);

    function calculateTokenBDeposit(address _tokenA, address _tokenB, uint _amountA)
        external
        view
        returns (uint amountBRequired);

    function calculateTokenADeposit(address _tokenA, address _tokenB, uint _amountB)
        external
        view
        returns (uint amountARequired);

    function calculateTokenAtoTokenB(address _tokenA, address _tokenB, uint _amountAIn)
        external
        view
        returns (uint amountBOut);

    function calculateTokenBtoTokenA(address _tokenA, address _tokenB, uint _amountBIn)
        external
        view
        returns (uint amountAOut);
}