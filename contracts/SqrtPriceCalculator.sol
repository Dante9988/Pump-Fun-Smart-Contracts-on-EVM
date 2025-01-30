// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "@uniswap/v3-core/contracts/libraries/TickMath.sol";
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
    uint24 constant FEE_LOW = 500;
    uint24 constant FEE_MEDIUM = 3000;
    uint24 constant FEE_HIGH = 10000;
    int24 constant FULL_RANGE_LOWER_10000 = -887200; 
    int24 constant FULL_RANGE_UPPER_10000 =  887200;

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

    function getTickSpacing(uint24 fee) internal pure returns (int24) {
        if (fee == FEE_LOW) return 10;
        if (fee == FEE_MEDIUM) return 60;
        if (fee == FEE_HIGH) return 200;
        revert("Invalid fee");
    }
}
