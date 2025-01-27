// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "hardhat/console.sol";

library FixedPointMath {
    /// @notice Calculates the square root of a number using the Babylonian method
    /// @param x Input value
    /// @return y Square root of x
    function sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}

contract SqrtPriceCalculator {
    using FixedPointMath for uint256;

    uint256 constant Q96 = 2**96;

    /**
 * @dev price1e18 is token1/token0 in 1e18 scale.
 * Example: if real price is 0.05, then price1e18 = 0.05 * 1e18 = 5e16
 */
function calculateSqrtPriceX96(uint256 price1e18) public pure returns (uint160) {
    require(price1e18 > 0, "Price must be > 0");
    
    // Step 1: Shift to Q192 by multiplying by 2^192, then divide out 1e18
    // ratioQ192 = price1e18 * 2^192 / 1e18
    // That is the official way to encode a "1e18 price" into Q192.
    uint256 ratioQ192 = (price1e18 << 192) / 1e18;

    // Step 2: Take the square root to get Q96
    // i.e., sqrtPriceX96 = sqrt(ratioQ192) so the result is a Q96 number.
    uint256 r = FixedPointMath.sqrt(ratioQ192); // your custom sqrt that can handle large numbers
    require(r <= type(uint160).max, "Overflow");
    
    console.log("ratioQ192:", ratioQ192);
    console.log("sqrtPriceX96 from calculateSqrtPriceX96:", r);

    return uint160(r);
}

    // / @notice Calculates sqrtPriceX96 from a given price
    // / @param price The price ratio (e.g., token1/token0) scaled to 18 decimals
    // / @return sqrtPriceX96 The square root price in Q96 format as a uint160
    // function calculateSqrtPriceX96(uint256 price) public pure returns (uint160) {
    //     require(price > 0, "Price must be > 0");
    
    //     // Scale the price to Q96 format (adjust decimals if necessary)
    //     uint256 sqrtPriceX96 = FixedPointMath.sqrt(price * 2**96);
    //     console.log("SqrtPriceX96 from calculateSqrtPriceX96:", sqrtPriceX96);
    
    //     return uint160(sqrtPriceX96);
    // }
    // function calculateSqrtPriceX96(uint256 price) public pure returns (uint160) {
    //     require(price > 0, "Price must be greater than 0");
    
    //     // Compute the square root
    //     uint256 sqrtPrice = price.sqrt();
    //     console.log("Price from AMM:", price);
    //     console.log("SqrtPrice from AMM:", sqrtPrice);
    //     // Compute sqrtPriceX96
    //     uint256 sqrtPriceX96 = (sqrtPrice * Q96);
    //     console.log("SqrtPriceX96 from AMM:", sqrtPriceX96);

    //     // Ensure it fits in uint160
    //     require(sqrtPriceX96 <= type(uint160).max, "sqrtPriceX96 exceeds uint160 range");

    //     return uint160(sqrtPriceX96);
    // }
}
