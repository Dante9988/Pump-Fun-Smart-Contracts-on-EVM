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
import "hardhat/console.sol";

contract ICO is LiquidityManager {

    using PriceLib for address;

    struct TokenParams {
        string name;
        string symbol;
        uint8 decimals;
    }

    MockPriceFeed public ethUsdPriceFeed;

    address[] public createdTokens;
    uint256 public constant MARKET_CAP_THRESHOLD = 100_000 * 1e8; // $100,000 with 8 decimals
    uint256 public constant PRECISION = 1e18;

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
        console.log("Market cap from contract:", marketCap);
        console.log("Market cap threshold:", MARKET_CAP_THRESHOLD);
        // Check if the market cap is above the threshold
        if (marketCap >= MARKET_CAP_THRESHOLD) {
            console.log("Market cap is above threshold, withdrawing liquidity");

            (uint256 priceTokenInWETH, uint256 priceWETHInToken) = amm.getTokenPrice(tokenAddress, WETH9);
            console.log("Price in WETH:", priceTokenInWETH);
            console.log("Price in token:", priceWETHInToken);

            uint160 sqrtPriceX96 = calculateSqrtPriceX96(priceTokenInWETH);
            console.log("Final sqrtPriceX96:", sqrtPriceX96);

            // Withdraw liquidity from AMM
            (uint share, ) = amm.getUserShare(tokenAddress, WETH9, address(this));
            (uint amountAOut, uint amountBOut) = amm.removeLiquidity(tokenAddress, WETH9, share);

            // Approve tokens for NFT manager
            IERC20(tokenAddress).approve(address(nonfungiblePositionManager), amountAOut);
            IERC20(WETH9).approve(address(nonfungiblePositionManager), amountBOut);
            
            MintPositionParams memory mintParams = MintPositionParams({
                tokenA: tokenAddress,
                tokenB: WETH9,
                fee: 10000, // 1% fee
                tickLower: -887200,
                tickUpper: 887200,
                amountA: amountAOut,
                amountB: amountBOut,
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

    // Internal functions

    function sqrt(uint256 x) internal pure returns (uint256 y) {
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    function calculateSqrtPriceX96(uint priceAinB) internal pure returns (uint160 sqrtPriceX96) {
        require(priceAinB > 0, "Price must be positive");

        // Calculate sqrtPriceX96 directly from priceAinB
        uint256 ratioTimes2_192 = priceAinB * (1 << 192); // Multiply by 2^192
        uint256 sqrtRatio = sqrt(ratioTimes2_192);        // Take the square root

        sqrtPriceX96 = uint160(sqrtRatio);
    }



}

