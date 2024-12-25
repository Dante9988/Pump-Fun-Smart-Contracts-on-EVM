// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "@chainlink/contracts/src/v0.7/interfaces/AggregatorV3Interface.sol";
import "../interfaces/IMultiAMM.sol";
import "../Token.sol";

import "hardhat/console.sol";

library PriceLib {

    function getTokenPriceInUSD(
    address tokenAddress, 
    address WETH9,
    IMultiAMM amm,
    AggregatorV3Interface priceFeed
) internal view returns (uint256) {
    // Get token price in WETH (18 decimals)
    (uint256 priceInWeth, ) = amm.getTokenPrice(tokenAddress, WETH9);
    console.log("Price in WETH from AMM:", priceInWeth);
    
    // Get ETH price in USD (8 decimals)
    (, int256 ethUsdPrice, , , ) = priceFeed.latestRoundData();
    require(ethUsdPrice > 0, "Invalid ETH/USD price");
    console.log("ETH price in USD:", uint256(ethUsdPrice));
    
    // Calculate USD price with 8 decimals:
    // priceInWeth (18 decimals) * ethUsdPrice (8 decimals) / 1e18
    uint256 priceUSD = (priceInWeth * uint256(ethUsdPrice)) / 1e18;
    console.log("Calculated price in USD:", priceUSD);
    
    return priceUSD;
}

   function getMarketCapInUSD(
    address tokenAddress,
    address WETH9,
    IMultiAMM amm,
    AggregatorV3Interface priceFeed
) internal view returns (uint256) {
    // We can see the token price is correct:
    // $0.00034 (34000 with 8 decimals)
    uint256 tokenPriceUSD = getTokenPriceInUSD(tokenAddress, WETH9, amm, priceFeed);  // 8 decimals
    
    // Total supply should be 1 billion = 1_000_000_000 * 1e18
    uint256 totalSupply = IERC20(tokenAddress).totalSupply();  // 18 decimals
    
    
    // Calculate market cap:
    // tokenPriceUSD (8 decimals) * totalSupply (18 decimals) / 1e18
    // = result in 8 decimals
    uint256 marketCap = (tokenPriceUSD * totalSupply) / 1e18;
    
    return marketCap;
}
}
