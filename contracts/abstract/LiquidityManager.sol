// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;

import "@uniswap/v3-core/contracts/libraries/TickMath.sol";
import "../interfaces/IUniswapV3Factory.sol";
import "../interfaces/IUniswapV3Pools.sol";
import "../interfaces/INonfungiblePositionManager.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "../interfaces/IMultiAMM.sol";
import "../libs/PriceLib.sol"; 
import "../interfaces/ILiquidityManager.sol";
import "hardhat/console.sol";

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
        IMultiAMM _amm,
        address _ico
    ) {
        factory = IUniswapV3Factory(_factory);
        nonfungiblePositionManager = INonfungiblePositionManager(_nonfungiblePositionManager);
        swapRouter = ISwapRouter(_swapRouter);
        WETH9 = _weth9;
        amm = _amm;
        owner = msg.sender;
        whitelisted[owner] = true;
        whitelisted[_ico] = true;
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

        // Sort tokens for pool creation
        (address token0, address token1) = tokenA < tokenB 
            ? (tokenA, tokenB) 
            : (tokenB, tokenA);

        console.log("SqrtPriceX96 from createPool:", sqrtPriceX96);
        console.log("Token0 Amount from createPool:", amountA);
        console.log("Token1 Amount from createPool:", amountB);

        if (factory.getPool(tokenA, tokenB, fee) == address(0)) {
            poolAddress = nonfungiblePositionManager.createAndInitializePoolIfNecessary(
                token0,
                token1,
                fee,
                sqrtPriceX96
            );
            require(poolAddress != address(0), "Pool creation failed.");

            IUniswapV3Pool pool = IUniswapV3Pool(poolAddress);
            (uint160 actualSqrtPrice, , , , , , ) = pool.slot0();
            console.log("Pool's Actual sqrtPriceX96:", actualSqrtPrice);
            
            emit PoolCreated(poolAddress);
        } else {
            poolAddress = factory.getPool(tokenA, tokenB, fee);
        }

        return poolAddress;
    }

    function mintPosition(
        MintPositionParams calldata params
    ) public virtual override onlyWhitelisted returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1) {
        address poolAddress = factory.getPool(params.tokenA, params.tokenB, params.fee);
        require(poolAddress != address(0), "Pool does not exist");

        // Transfer tokens to this contract first
        require(IERC20(params.tokenA).transferFrom(msg.sender, address(this), params.amountA), "Transfer A failed");
        require(IERC20(params.tokenB).transferFrom(msg.sender, address(this), params.amountB), "Transfer B failed");

        // Approve tokens for the position manager
        require(IERC20(params.tokenA).approve(address(nonfungiblePositionManager), params.amountA), "Token A approval failed");
        require(IERC20(params.tokenB).approve(address(nonfungiblePositionManager), params.amountB), "Token B approval failed");

        console.log("Allowence of NFT position manager for tokenA:", IERC20(params.tokenA).allowance(address(this), address(nonfungiblePositionManager)));
        console.log("Allowence of NFT position manager for tokenB:", IERC20(params.tokenB).allowance(address(this), address(nonfungiblePositionManager)));

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

        console.log("Balance token0 of this contract: ", IERC20(token0).balanceOf(address(this)));
        console.log("Balance token1 of this contract: ", IERC20(token1).balanceOf(address(this)));
        console.log("Balance of ICO contract:", IERC20(token0).balanceOf(address(this)));
        console.log("Balance of ICO contract:", IERC20(token1).balanceOf(address(this)));
        console.log("Liquidity manager address:", address(this));

        console.log("Token0: address", token0);
        console.log("Token1: address", token1);
        console.log("Token0: symbol", IERC20(token0).symbol());
        console.log("Token1: symbol", IERC20(token1).symbol());

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

        console.log("=== MINT PARAMS ===");
        console.log("token0:", token0);
        console.log("token1:", token1);
        console.log("fee:", params.fee);
        // console.log("tickLower:", params.tickLower);
        // console.log("tickUpper:", params.tickUpper);
        console.log("amount0Desired (raw):", amount0Desired);
        console.log("amount0Desired (adjusted):", amount0Desired / 1e18);
        console.log("amount1Desired (raw):", amount1Desired);
        console.log("amount1Desired (adjusted):", amount1Desired / 1e18);
        console.log("amount0Min:", params.amount0Min);
        console.log("amount1Min:", params.amount1Min);

        (tokenId, liquidity, amount0, amount1) = nonfungiblePositionManager.mint(mintParams);
        require(tokenId != 0, "Minting position failed");

        console.log("=== MINT RESULTS ===");
        console.log("Liquidity:", liquidity);
        console.log("Amount0 (raw):", amount0);
        console.log("Amount0 (adjusted):", amount0 / 1e18);
        console.log("Amount1 (raw):", amount1);
        console.log("Amount1 (adjusted):", amount1 / 1e18);

        emit LiquidityAdded(
            tokenId,
            poolAddress,
            params.tokenA,
            params.tokenB
        );
    }

    function bundleLiquidity(
        MintPositionParams calldata params
    ) public virtual override onlyWhitelisted returns (address poolAddress, uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1) {
        poolAddress = createPool(
            params.tokenA,
            params.tokenB,
            params.fee,
            params.amountA,
            params.amountB,
            params.sqrtPriceX96
        );
        require(poolAddress != address(0), "Pool creation failed");
        console.log("Pool address from bundleLiquidity:", poolAddress);
        
        (tokenId, liquidity, amount0, amount1) = mintPosition(params);
        require(tokenId != 0, "Minting position failed");
    }
}




