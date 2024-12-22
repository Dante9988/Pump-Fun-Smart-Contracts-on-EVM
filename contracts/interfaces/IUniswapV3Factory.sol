// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;

interface IUniswapV3Factory {
    /// @notice Emitted when a fee amount is enabled for pool creation
    event FeeAmountEnabled(
        uint24 indexed fee,
        int24 indexed tickSpacing
    );

    /// @notice Emitted when the owner of the factory is changed
    event OwnerChanged(
        address indexed oldOwner,
        address indexed newOwner
    );

    /// @notice Emitted when a pool is created
    event PoolCreated(
        address indexed token0,
        address indexed token1,
        uint24 indexed fee,
        int24 tickSpacing,
        address pool
    );

    /// @notice Creates a pool for the given two tokens and fee
    /// @param tokenA The first token of the pool by address sort order
    /// @param tokenB The second token of the pool by address sort order
    /// @param fee The fee collected upon every swap in the pool, denominated in hundredths of a bip
    /// @return pool The address of the newly created pool
    function createPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) external returns (address pool);

    /// @notice Enables a fee amount with the given tickSpacing
    /// @param fee The fee amount to enable, denominated in hundredths of a bip
    /// @param tickSpacing The spacing between ticks to be enforced for all pools created with the given fee amount
    function enableFeeAmount(uint24 fee, int24 tickSpacing) external;

    /// @notice Returns the tick spacing for a given fee amount, if enabled, or 0 if not enabled
    /// @param fee The fee amount to look up the tick spacing for
    /// @return The tick spacing
    function feeAmountTickSpacing(uint24 fee) external view returns (int24);

    /// @notice Returns the pool address for a given pair of tokens and a fee
    /// @param tokenA The first token of the pool by address sort order
    /// @param tokenB The second token of the pool by address sort order
    /// @param fee The fee collected upon every swap in the pool
    /// @return pool The pool address
    function getPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) external view returns (address pool);

    /// @notice Returns the current owner of the factory
    /// @return The address of the factory owner
    function owner() external view returns (address);

    /// @notice Returns the parameters of the factory
    /// @return factory The factory address
    /// @return token0 The first token of the pool by address sort order
    /// @return token1 The second token of the pool by address sort order
    /// @return fee The fee collected upon every swap in the pool
    /// @return tickSpacing The spacing between ticks
    function parameters() external view returns (
        address factory,
        address token0,
        address token1,
        uint24 fee,
        int24 tickSpacing
    );

    /// @notice Updates the owner of the factory
    /// @param _owner The new owner of the factory
    function setOwner(address _owner) external;
}
