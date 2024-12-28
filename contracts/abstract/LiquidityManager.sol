// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;

import "@uniswap/v3-core/contracts/libraries/TickMath.sol";
import "../interfaces/IUniswapV3Factory.sol";
import "../interfaces/INonfungiblePositionManager.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "../interfaces/IMultiAMM.sol";
import "../libs/PriceLib.sol"; 
import "../interfaces/ILiquidityManager.sol";

abstract contract LiquidityManager is ILiquidityManager {
    using PriceLib for address;

    IUniswapV3Factory public immutable factory;
    INonfungiblePositionManager public immutable nonfungiblePositionManager;
    ISwapRouter public immutable swapRouter;
    IMultiAMM public immutable amm;
    address public immutable WETH9;
    address public owner;
    mapping(address => bool) public whitelisted;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    modifier onlyWhitelisted() {
        require(whitelisted[msg.sender], "Only whitelisted users can call this function");
        _;
    }

    constructor(
        address _factory,
        address _nonfungiblePositionManager,
        address _swapRouter,
        address _weth9,
        IMultiAMM _amm 
    ) {
        factory = IUniswapV3Factory(_factory);
        nonfungiblePositionManager = INonfungiblePositionManager(_nonfungiblePositionManager);
        swapRouter = ISwapRouter(_swapRouter);
        WETH9 = _weth9;
        amm = _amm;
        owner = msg.sender;
        whitelisted[owner] = true;
    }

    function getOwnerShares(address tokenAddress) external view override returns (uint256, uint256) {
        return amm.getUserShare(tokenAddress, WETH9, msg.sender);
    }

    function getTokenPrice(address tokenAddress, address tokenB) external view override returns (uint256 priceAinB, uint256 priceBinA) {
        return amm.getTokenPrice(tokenAddress, tokenB);
    }

    function addWhitelistedUser(address user) external override onlyOwner {
        whitelisted[user] = true;
    }

    function removeWhitelistedUser(address user) external override onlyOwner {
        whitelisted[user] = false;
    }

    function createPool(
        address tokenA,
        address tokenB,
        uint24 fee,
        uint256 amountA,
        uint256 amountB,
        uint160 sqrtPriceX96
    ) public virtual override onlyWhitelisted returns (
        address poolAddress
    ) {
        require(tokenA != tokenB, "Identical addresses");
        require(amountA > 0 && amountB > 0, "Amounts must be greater than 0");
        require(tokenA != address(0) && tokenB != address(0), "Invalid token addresses");
        require(tokenA < tokenB);

        if (factory.getPool(tokenA, tokenB, fee) == address(0)) {
            poolAddress = nonfungiblePositionManager.createAndInitializePoolIfNecessary(
                tokenA,
                tokenB,
                fee,
                sqrtPriceX96
            );
            require(poolAddress != address(0), "Pool creation failed.");
            
            emit PoolCreated(poolAddress);
        } else {
            poolAddress = factory.getPool(tokenA, tokenB, fee);
        }

        return poolAddress;
    }

    function mintPosition(
        MintPositionParams calldata params
    ) public virtual override onlyWhitelisted returns (uint256 tokenId) {
        address poolAddress = factory.getPool(params.tokenA, params.tokenB, params.fee);
        require(poolAddress != address(0), "Pool does not exist");

        // Transfer tokens to this contract first
        require(IERC20(params.tokenA).transferFrom(msg.sender, address(this), params.amountA), "Transfer A failed");
        require(IERC20(params.tokenB).transferFrom(msg.sender, address(this), params.amountB), "Transfer B failed");

        // Approve tokens for the position manager
        require(IERC20(params.tokenA).approve(address(nonfungiblePositionManager), params.amountA), "Token A approval failed");
        require(IERC20(params.tokenB).approve(address(nonfungiblePositionManager), params.amountB), "Token B approval failed");

        // Sort tokens
        require(params.tokenA != params.tokenB, 'IDENTICAL_ADDRESSES');
        (address token0, address token1) = params.tokenA < params.tokenB 
            ? (params.tokenA, params.tokenB) 
            : (params.tokenB, params.tokenA);
        require(token0 != address(0), 'ZERO_ADDRESS');

        // Determine amounts based on sorted tokens
        (uint256 amount0Desired, uint256 amount1Desired) = token0 == params.tokenA 
            ? (params.amountA, params.amountB)
            : (params.amountB, params.amountA);

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

        emit LiquidityAdded(
            tokenId,
            poolAddress,
            params.tokenA,
            params.tokenB
        );

        return tokenId;
    }

    function bundleLiquidity(
        MintPositionParams calldata params
    ) public virtual override onlyWhitelisted returns (address poolAddress, uint256 tokenId) {
        poolAddress = createPool(
            params.tokenA,
            params.tokenB,
            params.fee,
            params.amountA,
            params.amountB,
            params.sqrtPriceX96
        );
        require(poolAddress != address(0), "Pool creation failed");
        
        tokenId = mintPosition(params);
        require(tokenId != 0, "Minting position failed");
    }
}
