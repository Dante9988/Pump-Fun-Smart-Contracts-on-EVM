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

contract ICO is LiquidityManager {

    using PriceLib for address;

    struct TokenParams {
        string name;
        string symbol;
        uint8 decimals;
    }

    MockPriceFeed public ethUsdPriceFeed;

    address[] public createdTokens;
    uint256 public constant MARKET_CAP_THRESHOLD = 100_000 * 1e18; // $100,000 with 18 decimals
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
    ) LiquidityManager(_factory, _nonfungiblePositionManager, _swapRouter, _weth9, _amm) {
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



        // Check if the market cap is above the threshold
        // if (getMarketCapInUSD(tokenAddress) >= MARKET_CAP_THRESHOLD) {

        //     // Withdraw liquidity from AMM



        //     // Get current price from AMM
        // (uint256 priceTokenInWETH, ) = amm.getTokenPrice(tokenAddress, WETH9);
        
        // uint160 sqrtPriceX96 = uint160(sqrt((priceTokenInWETH * (1 << 192)) / PRECISION));
        
        // uint24 fee = 10000; // 1% fee
        // int24 tickSpacing = 200; // Tick spacing for HIGH fee tier
        
        // // Calculate ticks for full range
        // int24 tickLower = -887272; // Min tick for full range
        // int24 tickUpper = 887272;  // Max tick for full range

        // MintPositionParams memory mintParams = MintPositionParams({
        //     tokenA: tokenAddress,
        //     tokenB: WETH9,
        //     fee: 500, // 0.05%
        //     tickLower: tickLower,
        //     tickUpper: tickUpper,
        //     amountA: amount / 10, // Use 10% of swap amount
        //     amountB: amount / 10, // Use 10% of swap amount
        //     amount0Min: 0,
        //     amount1Min: 0,
        //     recipient: msg.sender,
        //     deadline: block.timestamp + 1000,
        //     sqrtPriceX96: sqrtPriceX96
        // });
        
        // (address poolAddress, uint256 tokenId) = this.bundleLiquidity(mintParams);
        // console.log("Pool address:", poolAddress);
        // console.log("Token ID:", tokenId);
        // }


        return amountOut;
    }

    function sqrt(uint256 x) internal pure returns (uint256 y) {
    uint256 z = (x + 1) / 2;
    y = x;
    while (z < y) {
        y = z;
            z = (x / z + z) / 2;
        }
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



}

