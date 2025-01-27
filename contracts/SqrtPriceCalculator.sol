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

        return uint160(r);
    }
}
