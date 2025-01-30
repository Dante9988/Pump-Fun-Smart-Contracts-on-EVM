// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;

import "./libs/PriceLib.sol";
import "./abstract/LiquidityManager.sol";
import "./abstract/TokenManager.sol";

contract ICO is LiquidityManager, TokenManager {
    
    using PriceLib for address;

    constructor(address _factory, 
        address _nonfungiblePositionManager, 
        address _swapRouter,
        address _weth9,
        address _amm,
        address _ethUsdPriceFeed
    ) LiquidityManager(_factory, _nonfungiblePositionManager, _swapRouter, _weth9, _amm, address(this), _ethUsdPriceFeed) {
    }

    function buyToken(address tokenAddress, uint256 amount) external returns (uint256 amountOut, uint256 tokenId) {
        // First, transfer WETH from user to this contract
        require(IERC20(WETH9).transferFrom(msg.sender, address(this), amount), "WETH transfer failed");
    
        // Then approve AMM to spend the WETH
        require(IERC20(WETH9).approve(address(amm), amount), "WETH approval failed");
        
        amountOut = amm.swapExactTokenBforTokenA(tokenAddress, WETH9, amount);

        // Register as early buyer if token hasn't migrated yet
        if (!isMigrated[tokenAddress] && !isMigrated[WETH9]) {
            console.log("Registering early buyer:", msg.sender, tokenAddress, amountOut);
            console.log("Registering early buyer:", msg.sender, WETH9, amountOut);
            _addEarlyBuyer(tokenAddress, msg.sender, amountOut);
            _addEarlyBuyer(WETH9, msg.sender, amount);
            emit EarlyBuyerRegistered(msg.sender, tokenAddress, amountOut);
        }

        // 4. Transfer received tokens to the user (THIS WAS MISSING)
        require(IERC20(tokenAddress).transfer(msg.sender, amountOut), "Token transfer to user failed");

        // Check if the market cap is above the threshold
        tokenId = bondingCurve(tokenAddress);
        if (tokenId != 0) {
            console.log("Migrating token:", tokenAddress);
            isMigrated[tokenAddress] = true;
            isMigrated[WETH9] = true;
            console.log("Fee distribution migrated token:", isMigrated[tokenAddress]);
            console.log("Fee distribution migrated WETH:", isMigrated[WETH9]);
        }

        return (amountOut, tokenId);

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

