// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

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

    /// @notice Calculates sqrtPriceX96 from a given price
    /// @param price The price ratio (e.g., token1/token0) scaled to 18 decimals
    /// @return sqrtPriceX96 The square root price in Q96 format as a uint160
    function calculateSqrtPriceX96(uint256 price) public pure returns (uint160) {
        require(price > 0, "Price must be greater than 0");

        // Scale the price (e.g., 1e18 for fixed-point representation)
        uint256 scaledPrice = price * 1e18;

        // Compute the square root
        uint256 sqrtPrice = scaledPrice.sqrt();

        // Compute sqrtPriceX96
        uint256 sqrtPriceX96 = (sqrtPrice * 2**96) / 1e9;

        // Ensure it fits in uint160
        require(sqrtPriceX96 <= type(uint160).max, "sqrtPriceX96 exceeds uint160 range");

        return uint160(sqrtPriceX96);
    }
}
