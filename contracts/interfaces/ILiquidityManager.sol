// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;

interface ILiquidityManager {
    struct MintPositionParams {
        address tokenA;
        address tokenB;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amountA;
        uint256 amountB;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
        uint160 sqrtPriceX96;
    }

    // struct CollectParams {
    //     uint256 tokenId;
    //     address recipient;
    //     uint128 amount0Max;
    //     uint128 amount1Max;
    // }

    struct DistributeFeesParams {
        address token0;
        address token1;
        uint256 amount0;
        uint256 amount1;
        uint256 tokenId;
        address recipient;
        uint128 amount0Max;
        uint128 amount1Max;
    }

    event LiquidityAdded(
        uint256 tokenId,
        address poolAddress,
        address tokenA,
        address tokenB
    );

    event PoolCreated(address indexed poolAddress);

    function getTokenPrice(address tokenAddress, address tokenB) external view returns (uint256 priceAinB, uint256 priceBinA);

    function getOwnerShares(address tokenAddress) external view returns (uint256, uint256);

    function addWhitelistedUser(address user) external;

    function removeWhitelistedUser(address user) external;

    function createPool(
        address tokenA,
        address tokenB,
        uint24 fee,
        uint256 amountA,
        uint256 amountB,
        uint160 sqrtPriceX96
    ) external returns (address poolAddress);

    function mintPosition(
        MintPositionParams calldata params
    ) external returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);

    function bundleLiquidity(
        MintPositionParams calldata params
    ) external returns (address poolAddress, uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);
}
