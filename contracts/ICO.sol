// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "hardhat/console.sol";
import "./Token.sol";
import "./interfaces/IUniswapV3Pools.sol";
import "./interfaces/IUniswapV3Factory.sol";
import "./interfaces/INonfungiblePositionManager.sol";
import "@uniswap/v3-periphery/contracts/base/Multicall.sol";

contract LiquidityProvider {

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
    
    IUniswapV3Factory public immutable factory;
    INonfungiblePositionManager public immutable nonfungiblePositionManager;
    ISwapRouter public immutable swapRouter;

    // Event declaration
    event PoolCreated(address indexed poolAddress);
    event LiquidityAdded(
        uint256 tokenId,
        address poolAddress,
        address tokenA,
        address tokenB
    );

    constructor(address _factory, 
    address _nonfungiblePositionManager, 
    address _swapRouter
    ) {
        factory = IUniswapV3Factory(_factory);
        nonfungiblePositionManager = INonfungiblePositionManager(_nonfungiblePositionManager);
        swapRouter = ISwapRouter(_swapRouter);
    }

    function createPool(
        address tokenA,
        address tokenB,
        uint24 fee,
        uint256 amountA,
        uint256 amountB,
        uint160 sqrtPriceX96
    ) public returns (
        address poolAddress
    ) {
        require(tokenA != tokenB, "Identical addresses");
        require(amountA > 0 && amountB > 0, "Amounts must be greater than 0");
        require(tokenA != address(0) && tokenB != address(0), "Invalid token addresses");
        require(tokenA < tokenB);

        console.log('TokenA', tokenA);
        console.log('TokenB', tokenB);
        console.log('Fee', fee);
        console.log('SqrtPriceX96', sqrtPriceX96);
        if (factory.getPool(tokenA, tokenB, fee) == address(0)) {
            poolAddress = nonfungiblePositionManager.createAndInitializePoolIfNecessary(
                tokenA,
                tokenB,
                fee,
                sqrtPriceX96
            );
            require(poolAddress != address(0), "Pool creation failed.");
            console.log('Pool created at:', poolAddress);
            // Add this line to emit the event
            emit PoolCreated(poolAddress);
        } else {
            poolAddress = factory.getPool(tokenA, tokenB, fee);
        }

        return poolAddress;
    }

    function mintPosition(
        MintPositionParams calldata params
    ) public returns (uint256 tokenId) {
        address poolAddress = factory.getPool(params.tokenA, params.tokenB, params.fee);
        require(poolAddress != address(0), "Pool does not exist");

        // Transfer tokens to this contract first
        require(IERC20(params.tokenA).transferFrom(msg.sender, address(this), params.amountA), "Transfer A failed");
        require(IERC20(params.tokenB).transferFrom(msg.sender, address(this), params.amountB), "Transfer B failed");

        // Approve tokens for the position manager
        require(IERC20(params.tokenA).approve(address(nonfungiblePositionManager), params.amountA), "Token A approval failed");
        require(IERC20(params.tokenB).approve(address(nonfungiblePositionManager), params.amountB), "Token B approval failed");
        
        (address token0, address token1) = sortTokens(params.tokenA, params.tokenB);
        (uint256 amount0Desired, uint256 amount1Desired) = getAmountsForSortedTokens(
            token0,
            params.tokenA,
            params.amountA,
            params.amountB
        );

        INonfungiblePositionManager.MintParams memory mintParams = INonfungiblePositionManager.MintParams({
            token0: token0,
            token1: token1,
            fee: params.fee,
            tickLower: params.tickLower,
            tickUpper: params.tickUpper,
            amount0Desired: amount0Desired,
            amount1Desired: amount1Desired,
            amount0Min: params.amount0Min,
            amount1Min: params.amount1Min,
            recipient: params.recipient,
            deadline: params.deadline
        });

        (tokenId, , , ) = nonfungiblePositionManager.mint(mintParams);
        require(tokenId != 0, "Minting position failed");
        console.log('TokenId:', tokenId);

        emit LiquidityAdded(
            tokenId,
            poolAddress,
            params.tokenA,
            params.tokenB
        );

        return tokenId;
    }

        function sortTokens(address tokenA, address tokenB) internal pure returns (address token0, address token1) {
        require(tokenA != tokenB, 'IDENTICAL_ADDRESSES');
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), 'ZERO_ADDRESS');
    }

    function getAmountsForSortedTokens(
        address token0,
        address tokenA,
        uint256 amountA,
        uint256 amountB
    ) internal pure returns (uint256 amount0, uint256 amount1) {
        amount0 = token0 == tokenA ? amountA : amountB;
        amount1 = token0 == tokenA ? amountB : amountA;
    }
}