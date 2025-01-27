// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "./libs/PriceLib.sol";
import "./MockPriceFeed.sol";
import "./interfaces/IMultiAMM.sol";
import "./interfaces/IUniswapV3Pools.sol";
import "./interfaces/IUniswapV3Factory.sol";
import "./interfaces/INonfungiblePositionManager.sol";
import "@uniswap/v3-periphery/contracts/base/Multicall.sol";
import "@uniswap/v3-core/contracts/libraries/TickMath.sol";
import "./abstract/LiquidityManager.sol";
import "./abstract/TokenManager.sol";
import "./SqrtPriceCalculator.sol";

contract ICO is LiquidityManager, SqrtPriceCalculator {

    using PriceLib for address;

    struct TokenParams {
        string name;
        string symbol;
        uint8 decimals;
    }

    MockPriceFeed public ethUsdPriceFeed;

    address[] public createdTokens;
    uint256 public constant MARKET_CAP_THRESHOLD = 100_000 * 1e8;
    uint24 constant FEE_LOW = 500;
    uint24 constant FEE_MEDIUM = 3000;
    uint24 constant FEE_HIGH = 10000;
    int24 FULL_RANGE_LOWER_10000 = -887200; 
    int24 FULL_RANGE_UPPER_10000 =  887200;

    // Token address => owner address
    mapping(address => address[]) public tokenOwners;

    event TokenCreated(address indexed tokenAddress, address indexed owner);

    constructor(address _factory, 
        address _nonfungiblePositionManager, 
        address _swapRouter,
        address _weth9,
        IMultiAMM _amm,
        address _ethUsdPriceFeed
    ) LiquidityManager(_factory, _nonfungiblePositionManager, _swapRouter, _weth9, _amm, address(this)) {
        ethUsdPriceFeed = MockPriceFeed(_ethUsdPriceFeed);
    }

    function getTokenPriceInUSD(address tokenAddress) public view returns (uint256) {
        return PriceLib.getTokenPriceInUSD(
            tokenAddress,
            WETH9,
            amm,
            AggregatorV3Interface(ethUsdPriceFeed)
        );
    }

    function getMarketCapInUSD(address tokenAddress) public view returns (uint256 marketCapInUSD) {
        marketCapInUSD = PriceLib.getMarketCapInUSD(
            tokenAddress,
            WETH9,
            amm,
            AggregatorV3Interface(ethUsdPriceFeed)
        );
        return marketCapInUSD;
    }

    function createToken(TokenParams calldata params) external returns (address tokenAddress) {
        require(msg.sender != address(0), "Invalid sender");

        Token token = new Token(params.name, params.symbol, params.decimals, address(this));
        tokenAddress = address(token);
        require(tokenAddress != address(0), "Token creation failed");
        createdTokens.push(tokenAddress);
        tokenOwners[tokenAddress].push(msg.sender);
        emit TokenCreated(tokenAddress, msg.sender);
    }

    function createTokenAndPool(TokenParams calldata params) external returns (address tokenAddress) {
        tokenAddress = this.createToken(params);
        uint256 balance = IERC20(tokenAddress).balanceOf(address(this));
    
        amm.addLiquidityAtZeroPrice(
            tokenAddress, balance
        );
        return tokenAddress;
    }

    function buyToken(address tokenAddress, uint256 amount) external returns (uint256 amountOut) {
        // First, transfer WETH from user to this contract
        require(IERC20(WETH9).transferFrom(msg.sender, address(this), amount), "WETH transfer failed");
    
        // Then approve AMM to spend the WETH
        require(IERC20(WETH9).approve(address(amm), amount), "WETH approval failed");
        
        amountOut = amm.swapExactTokenBforTokenA(tokenAddress, WETH9, amount);
        // 4. Transfer received tokens to the user (THIS WAS MISSING)
        require(IERC20(tokenAddress).transfer(msg.sender, amountOut), "Token transfer to user failed");

        uint256 marketCap = getMarketCapInUSD(tokenAddress);

        // Check if the market cap is above the threshold
        if (marketCap >= MARKET_CAP_THRESHOLD) {

            // Withdraw liquidity from AMM
            (uint share, ) = amm.getUserShare(tokenAddress, WETH9, address(this));
            (uint amountAOut, uint amountBOut) = amm.removeLiquidity(tokenAddress, WETH9, share);

            // Determine token0 and token1 based on address
            uint256 adjustedRatio = (amountBOut * 10**18) / amountAOut; // token1/token0
            uint160 sqrtPriceX96 = calculateSqrtPriceX96(adjustedRatio);

            (int24 tickLower, int24 tickUpper) = calculateTicks(sqrtPriceX96, FEE_HIGH, true);

            (address token0, address token1) = tokenAddress < WETH9 
                ? (tokenAddress, WETH9) 
                : (WETH9, tokenAddress);
            
            MintPositionParams memory mintParams = MintPositionParams({
                tokenA: token0,
                tokenB: token1,
                fee: FEE_HIGH,
                tickLower: tickLower,
                tickUpper: tickUpper,
                amountA: token0 == tokenAddress ? amountAOut : amountBOut,  // Match sorted amounts
                amountB: token0 == tokenAddress ? amountBOut : amountAOut,
                amount0Min: 0,
                amount1Min: 0,
                recipient: msg.sender,
                deadline: block.timestamp + 1000,
                sqrtPriceX96: sqrtPriceX96
            });
            
            this.bundleLiquidity(mintParams);
        }

        return amountOut;
    }

    function sellToken(address tokenAddress, uint256 amount) external returns (uint256 amountOut) {
        // First, transfer WETH from user to this contract
        require(IERC20(tokenAddress).transferFrom(msg.sender, address(this), amount), "Token transfer failed");
    
        // Then approve AMM to spend the WETH
        require(IERC20(tokenAddress).approve(address(amm), amount), "Token approval failed");
        
        amountOut = amm.swapExactTokenAforTokenB(tokenAddress, WETH9, amount);
        // 4. Transfer received tokens to the user (THIS WAS MISSING)
        require(IERC20(WETH9).transfer(msg.sender, amountOut), "WETH transfer to user failed");
        return amountOut;
    }

    function getTickSpacing(uint24 fee) internal pure returns (int24) {
        if (fee == FEE_LOW) return 10;
        if (fee == FEE_MEDIUM) return 60;
        if (fee == FEE_HIGH) return 200;
        revert("Invalid fee");
    }

    function calculateTicks(uint160 sqrtPriceX96, uint24 fee, bool isFullRange) internal pure returns (int24 tickLower, int24 tickUpper) {
        
        // If user wants full range for a 1% pool
        if (isFullRange && fee == 10000) {
            tickLower = -887200;
            tickUpper = 887200;
            return (tickLower, tickUpper);
        }
        
        // 1. Get the current tick for that sqrtPriceX96
        int24 currentTick = TickMath.getTickAtSqrtRatio(sqrtPriceX96);

        // 2. Fee tier spacing: 500, 3000, or 10000 => spacing of 10, 60, 200 etc.
        int24 tickSpacing = getTickSpacing(fee);

        // 3. Decide how "wide" you want the range to be in multiples of `tickSpacing`.
        //    For example, multiply by 1000.  Make sure it doesn't overflow an int24
        //    or exceed Uniswap's min/max ticks.
        int24 wide = tickSpacing * 1000; // e.g., 10, 60, or 200 => 10k, 60k, or 200k

        // 4. Snap currentTick to a multiple of tickSpacing
        //    so your position is aligned with valid tick boundaries
        int24 mid = (currentTick / tickSpacing) * tickSpacing;

        // 5. Propose lower & upper
        int24 lowerCandidate = mid - wide;
        int24 upperCandidate = mid + wide;

        // 6. Clamp them to Uniswap's allowable range
        //    (MIN_TICK = -887200, MAX_TICK = 887200). Example from TickMath library.
        if (lowerCandidate < TickMath.MIN_TICK) {
            lowerCandidate = TickMath.MIN_TICK;
        }
        if (upperCandidate > TickMath.MAX_TICK) {
            upperCandidate = TickMath.MAX_TICK;
        }

        // 7. Ensure the lower is still < upper
        //    If they inverted or got clamped too far, bump the upper
        if (lowerCandidate >= upperCandidate) {
            upperCandidate = lowerCandidate + tickSpacing;
            // If that still doesn't fix it, you might revert or pick a smaller wide factor
        }

        tickLower = lowerCandidate;
        tickUpper = upperCandidate;
    }

    function getRatio(uint256 amountAOut, uint256 amountBOut) internal pure returns (uint256 priceRatio) {
        // Ensure no division by zero
        require(amountAOut > 0 && amountBOut > 0, "Invalid amounts");
    
        // Calculate price as (token1/token0) scaled to 1e18
        priceRatio = (amountBOut * 1e18) / amountAOut;
    }
}

