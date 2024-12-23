// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "hardhat/console.sol";
import "./Token.sol";
import "./interfaces/IMultiAMM.sol";
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

    struct TokenParams {
        string name;
        string symbol;
        uint8 decimals;
    }
    
    IUniswapV3Factory public immutable factory;
    INonfungiblePositionManager public immutable nonfungiblePositionManager;
    ISwapRouter public immutable swapRouter;
    IMultiAMM public immutable amm;
    address public owner;
    mapping(address => bool) public whitelisted;
    address[] public createdTokens;
    address public WETH9;

    // Token address => owner address
    mapping(address => address[]) public tokenOwners;

    // Event declaration
    event PoolCreated(address indexed poolAddress);
    event LiquidityAdded(
        uint256 tokenId,
        address poolAddress,
        address tokenA,
        address tokenB
    );

    event TokenCreated(address indexed tokenAddress, address indexed owner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    modifier onlyWhitelisted() {
        require(whitelisted[msg.sender], "Only whitelisted users can call this function");
        _;
    }

    constructor(address _factory, 
    address _nonfungiblePositionManager, 
    address _swapRouter,
    address _weth9,
    IMultiAMM _amm
    ) {
        factory = IUniswapV3Factory(_factory);
        nonfungiblePositionManager = INonfungiblePositionManager(_nonfungiblePositionManager);
        swapRouter = ISwapRouter(_swapRouter);
        owner = msg.sender;
        whitelisted[owner] = true;
        WETH9 = _weth9;
        amm = _amm;
    }

    function addWhitelistedUser(address user) external onlyOwner {
        whitelisted[user] = true;
    }

    function removeWhitelistedUser(address user) external onlyOwner {
        whitelisted[user] = false;
    }

    function getOwnerShares(address tokenAddress) external view returns (uint256, uint256) {
        return amm.getUserShare(tokenAddress, WETH9, msg.sender);
    }

    function getTokenPrice(address tokenAddress, address tokenB) external view returns (uint256 priceAinB, uint256 priceBinA) {
        return amm.getTokenPrice(tokenAddress, tokenB);
    }

    function createToken(TokenParams calldata params) external returns (address tokenAddress) {
        require(msg.sender != address(0), "Invalid sender");

        Token token = new Token(params.name, params.symbol, params.decimals, address(this));
        tokenAddress = address(token);
        require(tokenAddress != address(0), "Token creation failed");
        createdTokens.push(tokenAddress);
        tokenOwners[tokenAddress].push(msg.sender);
        emit TokenCreated(tokenAddress, msg.sender);
    }

    function createTokenAndPool(TokenParams calldata params) external returns (address tokenAddress) {
        tokenAddress = this.createToken(params);
        uint256 balance = IERC20(tokenAddress).balanceOf(address(this));
        console.log('Balance before addLiquidity:', balance);
        console.log('Token address:', tokenAddress);
    
        amm.addLiquidityAtZeroPrice(
            tokenAddress, balance
        );
        bytes32 poolId = amm._getPoolId(tokenAddress, WETH9);
        IMultiAMM.Pool memory pool = amm.pools(poolId);
        console.log('Pool tokenBalanceA:', pool.tokenBalanceA);
        console.log('Pool tokenBalanceB:', pool.tokenBalanceB);
        console.log('Pool K:', pool.K);
        console.log('Pool totalShares:', pool.totalShares);
        console.log('Pool zeroPriceActive:', pool.zeroPriceActive);
        console.log('Balance after addLiquidity:', IERC20(tokenAddress).balanceOf(address(this)));
        return tokenAddress;
    }

    function buyToken(address tokenAddress, uint256 amount) external returns (uint256 amountOut) {
        // First, transfer WETH from user to this contract
        require(IERC20(WETH9).transferFrom(msg.sender, address(this), amount), "WETH transfer failed");
    
        // Then approve AMM to spend the WETH
        require(IERC20(WETH9).approve(address(amm), amount), "WETH approval failed");
        
        amountOut = amm.swapExactTokenBforTokenA(tokenAddress, WETH9, amount);
        // 4. Transfer received tokens to the user (THIS WAS MISSING)
        require(IERC20(tokenAddress).transfer(msg.sender, amountOut), "Token transfer to user failed");
        return amountOut;
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

        if (factory.getPool(tokenA, tokenB, fee) == address(0)) {
            poolAddress = nonfungiblePositionManager.createAndInitializePoolIfNecessary(
                tokenA,
                tokenB,
                fee,
                sqrtPriceX96
            );
            require(poolAddress != address(0), "Pool creation failed.");
            console.log('Pool created at:', poolAddress);
            
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
        
        (address token0, address token1) = _sortTokens(params.tokenA, params.tokenB);
        (uint256 amount0Desired, uint256 amount1Desired) = _getAmountsForSortedTokens(
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


    function bundleLiquidity(MintPositionParams calldata params) external onlyWhitelisted returns (address poolAddress, uint256 tokenId) 
    {
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

    function _getAmountsForSortedTokens(
        address token0,
        address tokenA,
        uint256 amountA,
        uint256 amountB
    ) internal pure returns (uint256 amount0, uint256 amount1) {
        amount0 = token0 == tokenA ? amountA : amountB;
        amount1 = token0 == tokenA ? amountB : amountA;
    }

    function _sortTokens(address tokenA, address tokenB) internal pure returns (address token0, address token1) {
        require(tokenA != tokenB, 'IDENTICAL_ADDRESSES');
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), 'ZERO_ADDRESS');
    }
}
