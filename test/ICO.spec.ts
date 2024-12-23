import { expect } from 'chai';
import { artifacts, ethers, network } from 'hardhat';
import { TickMath } from '@uniswap/v3-sdk';
import { deployUniswapV3, createPool, mint, swap } from '../scripts/UniswapV3Scripts';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import TokenInterface from '../tools/abi/erc20.json';
import WETH9Interface from '../tools/contract_artifacts/WETH9.json';
import * as constant from '../tools/common/const';
import { Contract, Signer } from 'ethers';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { Token } from '@uniswap/sdk-core';
import * as uniswapAddress from '../tools/common/UniswapV3Address_31337.json';
import DeployedContracts  from '../scripts/interfaces';
import PositionManager from '../tools/abi/positionManager.json';
import { IERC20 } from '../typechain-types/contracts/Token.sol/IERC20';
import { Token__factory } from '../typechain-types';

const FEE_AMOUNT_LOW = {
    FEE_AMOUNT: constant.FEE_AMOUNT.LOW,
    TICK_LOWER: constant.getMinTick(constant.TICK_SPACINGS[constant.FEE_AMOUNT.LOW]),
    TICK_UPPER: constant.getMaxTick(constant.TICK_SPACINGS[constant.FEE_AMOUNT.LOW]),
};
const FEE_AMOUNT_MEDIUM = {
    FEE_AMOUNT: constant.FEE_AMOUNT.MEDIUM,
    TICK_LOWER: constant.getMinTick(constant.TICK_SPACINGS[constant.FEE_AMOUNT.MEDIUM]),
    TICK_UPPER: constant.getMaxTick(constant.TICK_SPACINGS[constant.FEE_AMOUNT.MEDIUM]),
};
const FEE_AMOUNT_HIGH = {
    FEE_AMOUNT: constant.FEE_AMOUNT.HIGH,
    TICK_LOWER: constant.getMinTick(constant.TICK_SPACINGS[constant.FEE_AMOUNT.HIGH]),
    TICK_UPPER: constant.getMaxTick(constant.TICK_SPACINGS[constant.FEE_AMOUNT.HIGH]),
};

const tokens = (n: number) => {
    return ethers.utils.parseUnits(n.toString(), 'ether');
} 

describe('ICO', () => {

    let accounts: any;
    let deployer: HardhatEthersSigner;
    let nonWhitelisted: HardhatEthersSigner;
    let uniswapV3: DeployedContracts;
    let ico: Contract;
    let liquidityProvider: any;
    let mintParams: any;
    let multiAMM: Contract;
    let signers: any;
    let signer: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let transaction: TransactionResponse;
    beforeEach(async () => {
        signers = await ethers.getSigners();
        signer = signers[0];
        user1 = signers[1];
        user2 = signers[2];
        accounts = await ethers.getSigners();
        deployer = accounts[0];
        nonWhitelisted = accounts[1];
        uniswapV3 = await deployUniswapV3(deployer, ethers.utils.parseUnits('1000000000', 18));

        const MultiAMM = await ethers.getContractFactory('MultiAMM');
        multiAMM = await MultiAMM.deploy(uniswapV3.WETH9.address);
        await multiAMM.deployed();

        console.log(`MultiAMM deployed at: ${multiAMM.address}`);

        const LiquidityProvider = await ethers.getContractFactory('LiquidityProvider');
        liquidityProvider = await LiquidityProvider.deploy(
            uniswapV3.V3Factory.address, 
            uniswapV3.NFTManager.address, 
            uniswapV3.SwapRouter.address,
            uniswapV3.WETH9.address,
            multiAMM.address
        );
        ico = await liquidityProvider.deployed();

        // Wrap ETH to WETH
        let wrapTxn = await uniswapV3.WETH9.deposit({ value: tokens(1000) });
        await wrapTxn.wait();
        console.log(`Wrapped ETH to WETH at: ${wrapTxn.hash}`);

    });

    describe('Success', () => {
        it(`should create a pool`, async () => {
            const currentBlockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
            const deadline = Math.floor(currentBlockTimestamp) + 60 * 20;

            const priceRatio = Math.log(3 * Math.pow(10, -12)) / Math.log(1.0001);
            const tick = Math.floor(priceRatio);
            const sqrtPriceX96 = TickMath.getSqrtRatioAtTick(tick).toString();

            const chainId = await ethers.provider.getNetwork().then((network: any) => network.chainId);
            const token1 = new Token(
                chainId,
                uniswapV3.WETH9.address,
                await uniswapV3.WETH9.decimals(),
                await uniswapV3.WETH9.symbol(),
                await uniswapV3.WETH9.name()
            );

            const token2 = new Token(
                chainId,
                uniswapV3.ERC20.address,
                await uniswapV3.ERC20.decimals(),
                await uniswapV3.ERC20.symbol(),
                await uniswapV3.ERC20.name()
            );

            const sortedTokens = constant.sortedTokens(token1, token2);

            let mintParams = {
                tokenA: sortedTokens[0].address,
                tokenB: sortedTokens[1].address,
                fee: FEE_AMOUNT_LOW.FEE_AMOUNT,
                tickLower: FEE_AMOUNT_LOW.TICK_LOWER,
                tickUpper: FEE_AMOUNT_LOW.TICK_UPPER,
                amountA: tokens(100),
                amountB: tokens(100),
                amount0Min: tokens(0),
                amount1Min: tokens(0),
                recipient: await deployer.getAddress(),
                deadline: deadline,
                sqrtPriceX96: sqrtPriceX96,
            }

            const transaction = await ico.connect(deployer as unknown as Signer).createPool(
                sortedTokens[0].address,
                sortedTokens[1].address,
                FEE_AMOUNT_LOW.FEE_AMOUNT,
                tokens(100),
                tokens(100),
                sqrtPriceX96,
            );

            await transaction.wait();
            expect(transaction).to.not.be.null;
            expect(transaction).to.not.be.undefined;
            console.log(`Pool created at: ${transaction.hash}`);

            console.log(`Token0: ${sortedTokens[0].address}`);
            console.log(`Token1: ${sortedTokens[1].address}`);

            const events = await ico.queryFilter(ico.filters.PoolCreated(), 0, "latest");

            events.forEach((event, index) => {
                console.log(`\n=== Event #${index} ===`);
                console.log("Block Number:", event.blockNumber);
                console.log("Transaction Hash:", event.transactionHash);
                console.log("Pool Address:", event.args?.poolAddress);
            });

            // approve the NFTManager to spend the tokens
            let approveTxn = await uniswapV3.WETH9.approve(uniswapV3.NFTManager.address, tokens(10000));
            await approveTxn.wait();
            console.log(`Approved NFTManager to spend WETH9 at: ${approveTxn.hash}`);

            approveTxn = await uniswapV3.ERC20.approve(uniswapV3.NFTManager.address, tokens(10000));
            await approveTxn.wait();
            console.log(`Approved NFTManager to spend ERC20 at: ${approveTxn.hash}`);

            // approve ICO to spend the tokens
            approveTxn = await uniswapV3.WETH9.approve(ico.address, tokens(10000));
            await approveTxn.wait();
            console.log(`Approved ICO to spend WETH9 at: ${approveTxn.hash}`);

            approveTxn = await uniswapV3.ERC20.approve(ico.address, tokens(10000));
            await approveTxn.wait();
            console.log(`Approved ICO to spend ERC20 at: ${approveTxn.hash}`);

            // Double check approvals
            console.log('Allowances:');
            console.log('WETH allowance:', ethers.utils.formatEther(await uniswapV3.WETH9.allowance(await deployer.getAddress(), ico.address)));
            console.log('ERC20 allowance:', ethers.utils.formatEther(await uniswapV3.ERC20.allowance(await deployer.getAddress(), ico.address)));

            // Also check balances
            console.log('\nBalances:');
            console.log('WETH:', ethers.utils.formatEther(await uniswapV3.WETH9.balanceOf(await deployer.getAddress())));
            console.log('ERC20:', ethers.utils.formatEther(await uniswapV3.ERC20.balanceOf(await deployer.getAddress())));

            console.log(`Deployer address: ${await deployer.getAddress()}`);

            console.log(`Minting position with params: ${JSON.stringify(mintParams)}`);

            let txn: TransactionResponse;
            try {
                txn = await ico.connect(deployer as unknown as Signer).mintPosition(mintParams, { gasLimit: 3000000 })
                await txn.wait();
                expect(txn).to.not.be.null;
                expect(txn).to.not.be.undefined;
                console.log(`Minted at: ${txn.hash}`);
            } catch (error) {
                console.log(error);
            }
        });

        it(`should bundle liquidity`, async () => {
            const currentBlockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
            const deadline = Math.floor(currentBlockTimestamp) + 60 * 20;

            const priceRatio = Math.log(3 * Math.pow(10, -12)) / Math.log(1.0001);
            const tick = Math.floor(priceRatio);
            const sqrtPriceX96 = TickMath.getSqrtRatioAtTick(tick).toString();

            const chainId = await ethers.provider.getNetwork().then((network: any) => network.chainId);
            const token1 = new Token(
                chainId,
                uniswapV3.WETH9.address,
                await uniswapV3.WETH9.decimals(),
                await uniswapV3.WETH9.symbol(),
                await uniswapV3.WETH9.name()
            );

            const token2 = new Token(
                chainId,
                uniswapV3.ERC20.address,
                await uniswapV3.ERC20.decimals(),
                await uniswapV3.ERC20.symbol(),
                await uniswapV3.ERC20.name()
            );

            const sortedTokens = constant.sortedTokens(token1, token2);

            // approve ICO to spend the tokens
            let approveTxn = await uniswapV3.WETH9.approve(ico.address, tokens(10000));
            await approveTxn.wait();
            console.log(`Approved ICO to spend WETH9 at: ${approveTxn.hash}`);

            approveTxn = await uniswapV3.ERC20.approve(ico.address, tokens(10000));
            await approveTxn.wait();
            console.log(`Approved ICO to spend ERC20 at: ${approveTxn.hash}`);

            // Double check approvals
            console.log('Allowances:');
            console.log('WETH allowance:', ethers.utils.formatEther(await uniswapV3.WETH9.allowance(await deployer.getAddress(), ico.address)));
            console.log('ERC20 allowance:', ethers.utils.formatEther(await uniswapV3.ERC20.allowance(await deployer.getAddress(), ico.address)));

            const mintParams = {
                tokenA: sortedTokens[0].address,
                tokenB: sortedTokens[1].address,
                fee: FEE_AMOUNT_LOW.FEE_AMOUNT,
                tickLower: FEE_AMOUNT_LOW.TICK_LOWER,
                tickUpper: FEE_AMOUNT_LOW.TICK_UPPER,
                amountA: tokens(100),
                amountB: tokens(100),
                amount0Min: tokens(0),
                amount1Min: tokens(0),
                recipient: await deployer.getAddress(),
                deadline: deadline,
                sqrtPriceX96: sqrtPriceX96,
            }

            const transaction = await ico.connect(deployer as unknown as Signer).bundleLiquidity(
                mintParams
            );

            await transaction.wait();
            expect(transaction).to.not.be.null;
            expect(transaction).to.not.be.undefined;
            console.log(`Pool created at: ${transaction.hash}`);

            let events = await ico.queryFilter(ico.filters.PoolCreated(), 0, "latest");

            events.forEach((event, index) => {
                console.log(`\n=== Event #${index} ===`);
                console.log("Block Number:", event.blockNumber);
                console.log("Transaction Hash:", event.transactionHash);
                console.log("Pool Address:", event.args?.poolAddress);
            });
            expect(events.length).to.be.greaterThan(0);
            expect(events[0].args?.poolAddress).to.not.be.null;

            events = await ico.queryFilter(ico.filters.LiquidityAdded(), 0, "latest");

            events.forEach((event, index) => {
                console.log(`\n=== Event #${index} ===`);
                console.log("Block Number:", event.blockNumber);
                console.log("Transaction Hash:", event.transactionHash);
                console.log("Pool Address:", event.args?.poolAddress);
                console.log("TokenId:", event.args?.tokenId);
                console.log("TokenA:", event.args?.tokenA);
                console.log("TokenB:", event.args?.tokenB);
            });
            expect(events.length).to.be.greaterThan(0);
            expect(events[0].args?.tokenId).to.not.be.null;
            expect(events[0].args?.poolAddress).to.not.be.null;
            expect(events[0].args?.tokenA).to.not.be.null;
            expect(events[0].args?.tokenB).to.not.be.null;
        });

        it(`should create a token`, async () => {
            const tokenParams = {
                name: "Sad Ethereum",
                symbol: "SADETH",
                decimals: 18,
                totalSupply: tokens(1000000000),
            }

            let transaction = await ico.connect(deployer as unknown as Signer).createToken(tokenParams);
            await transaction.wait();
            expect(transaction).to.not.be.null;
            expect(transaction).to.not.be.undefined;
            console.log(`Token created at: ${transaction.hash}`);

            let events = await ico.queryFilter(ico.filters.TokenCreated(), 0, "latest");
            expect(events.length).to.be.greaterThan(0);
            expect(events[0].args?.tokenAddress).to.not.be.null;
            expect(events[0].args?.owner).to.not.be.null;

            
        });

    });

    describe('Failure', async () => {

        it('should fail with non whitelisted user', async () => {
            const currentBlockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
            const deadline = Math.floor(currentBlockTimestamp) + 60 * 20;

            const priceRatio = Math.log(3 * Math.pow(10, -12)) / Math.log(1.0001);
            const tick = Math.floor(priceRatio);
            const sqrtPriceX96 = TickMath.getSqrtRatioAtTick(tick).toString();

            const chainId = await ethers.provider.getNetwork().then((network: any) => network.chainId);
            const token1 = new Token(
                chainId,
                uniswapV3.WETH9.address,
                await uniswapV3.WETH9.decimals(),
                await uniswapV3.WETH9.symbol(),
                await uniswapV3.WETH9.name()
            );

            const token2 = new Token(
                chainId,
                uniswapV3.ERC20.address,
                await uniswapV3.ERC20.decimals(),
                await uniswapV3.ERC20.symbol(),
                await uniswapV3.ERC20.name()
            );

            const sortedTokens = constant.sortedTokens(token1, token2);

            let mintParams = {
                tokenA: sortedTokens[0].address,
                tokenB: sortedTokens[1].address,
                fee: FEE_AMOUNT_HIGH.FEE_AMOUNT,
                tickLower: FEE_AMOUNT_HIGH.TICK_LOWER,
                tickUpper: FEE_AMOUNT_HIGH.TICK_UPPER,
                amountA: tokens(100),
                amountB: tokens(100),
                amount0Min: tokens(0),
                amount1Min: tokens(0),
                recipient: await deployer.getAddress(),
                deadline: deadline,
                sqrtPriceX96: sqrtPriceX96,
            }

            await expect(ico.connect(nonWhitelisted as unknown as Signer).bundleLiquidity(mintParams)).to.be.revertedWith('Only whitelisted users can call this function');
        });
    });

    // describe('View', async () => {

    //     let tokenAddress: string;
    //     let transaction: TransactionResponse;

    //     beforeEach(async () => {
    //         const tokenParams = {
    //             name: "Sad Ethereum",
    //             symbol: "SADETH",
    //             decimals: 18
    //         }
    //         console.log(`Token params: ${JSON.stringify(tokenParams)}`);
    //         transaction = await ico.connect(deployer as unknown as Signer).createTokenAndPool(tokenParams);
    //         await transaction.wait();
    //     });

    //     it(`should add liquidity at zero price`, async () => {
    //         expect(transaction).to.not.be.null;
    //         expect(transaction).to.not.be.undefined;
    //         console.log(`Token and pool created at: ${transaction.hash}`);

    //         const events = await ico.queryFilter(ico.filters.TokenCreated(), 0, "latest");
    //         console.log(`Events: ${events}`);
    //         expect(events.length).to.be.greaterThan(0);
    //         expect(events[0].args?.tokenAddress).to.not.be.null;
    //         expect(events[0].args?.owner).to.not.be.null;

    //         console.log(`Token address: ${events[0].args?.tokenAddress}`);
    //         tokenAddress = events[0].args?.tokenAddress;
    //     });

    //     it('should make a first swap', async () => {

    //         const owner = deployer;
    //         const tokenA = new ethers.Contract(tokenAddress, TokenInterface, deployer as unknown as Signer);
    //         const tokenB = new ethers.Contract(uniswapV3.WETH9.address, WETH9Interface.abi, deployer as unknown as Signer);
    //         const buyAmountInWei = ethers.utils.parseUnits("1", 11);
    //         const expectedTokens = ethers.utils.parseEther("1"); // 1 token

    //         let approveTxn = await tokenB.approve(ico.address, buyAmountInWei);
    //         await approveTxn.wait();
    //         console.log("ICO approveTxn:", approveTxn);
      
    //         approveTxn = await tokenB.approve(multiAMM.address, buyAmountInWei);
    //         await approveTxn.wait();
    //         console.log("MultiAMM approveTxn:", approveTxn);


    //         const balanceABefore = await tokenA.balanceOf(owner.address);
    //         const balanceBBefore = await tokenB.balanceOf(owner.address);
      
    //         const contractBalanceA = await tokenA.balanceOf(multiAMM.address);
    //         const contractBalanceB = await tokenB.balanceOf(multiAMM.address);
    //         console.log("contractBalanceA:", contractBalanceA);
    //         console.log("contractBalanceB:", contractBalanceB);
    //         const poolId = await multiAMM._getPoolId(tokenA.address, tokenB.address);
    //         console.log("poolId:", poolId);
    //         const pool = await multiAMM.pools(poolId);
    //         console.log("pool:", pool);
    //         const zeroPriceActive = pool.zeroPriceActive;
    //         console.log("zeroPriceActive:", zeroPriceActive);
      
    //         await ico.connect(owner as unknown as Signer).buyToken(
    //           tokenA.address,
    //           buyAmountInWei
    //         );
      
    //         const balanceAAfter = await tokenA.balanceOf(owner.address);
    //         const balanceBAfter = await tokenB.balanceOf(owner.address);
      
    //         // Check received tokens
    //         expect(balanceAAfter.sub(balanceABefore)).to.equal(expectedTokens);
    //         // Check spent tokenB
    //         expect(balanceBBefore.sub(balanceBAfter)).to.equal(buyAmountInWei);
      
    //         // Check pool state
    //         const [balA, balB, K] = await multiAMM.getPoolBalances(tokenA.address, tokenB.address);
    //         console.log("balA:", balA);
    //         console.log("balB:", balB);
    //         console.log("K:", K);
    //         //expect(balB).to.equal(buyAmountInWei);
    //     });
    // });

    describe('View', async () => {
        let tokenAddress: string;
        let IERC20: Token__factory;
    
        // Create token and add liquidity before running tests
        beforeEach(async () => {
            const tokenParams = {
                name: "Sad Ethereum",
                symbol: "SADETH",
                decimals: 18
            }

            IERC20 = await ethers.getContractFactory("Token");
    
            const transaction = await ico.connect(deployer as unknown as Signer).createTokenAndPool(tokenParams);
            await transaction.wait();
    
            const events = await ico.queryFilter(ico.filters.TokenCreated(), 0, "latest");
            tokenAddress = events[0].args?.tokenAddress;
            console.log(`Token created at address: ${tokenAddress}`);
    
            // Verify pool setup
            const [balA, balB, K] = await multiAMM.getPoolBalances(tokenAddress, uniswapV3.WETH9.address);
            console.log("Initial pool state:", {
                balanceA: ethers.utils.formatEther(balA),
                balanceB: ethers.utils.formatEther(balB),
                K: K.toString()
            });
        });
    
        it('should verify pool creation', async () => {
            expect(tokenAddress).to.not.be.undefined;
            
            // Log the pool ID we're checking
            const poolId = await multiAMM._getPoolId(tokenAddress, uniswapV3.WETH9.address);
            console.log("Pool ID:", poolId);
            
            // Get the actual pool struct
            const pool = await multiAMM.pools(poolId);
            console.log("Direct pool access:", {
                tokenBalanceA: pool.tokenBalanceA.toString(),
                tokenBalanceB: pool.tokenBalanceB.toString(),
                K: pool.K.toString(),
                totalShares: pool.totalShares.toString(),
                zeroPriceActive: pool.zeroPriceActive
            });
        
            // Check both possible token orderings
            const [balA1, balB1, K1] = await multiAMM.getPoolBalances(tokenAddress, uniswapV3.WETH9.address);
            console.log("Order 1 (token, WETH):", {
                balA: balA1.toString(),
                balB: balB1.toString(),
                K: K1.toString()
            });
        
            const [balA2, balB2, K2] = await multiAMM.getPoolBalances(uniswapV3.WETH9.address, tokenAddress);
            console.log("Order 2 (WETH, token):", {
                balA: balA2.toString(),
                balB: balB2.toString(),
                K: K2.toString()
            });
        
            // Check actual token balances
            const tokenBalance = await IERC20.attach(tokenAddress).balanceOf(multiAMM.address);
            const wethBalance = await IERC20.attach(uniswapV3.WETH9.address).balanceOf(multiAMM.address);
            console.log("Actual token balances in AMM:", {
                token: tokenBalance.toString(),
                WETH: wethBalance.toString()
            });
        });
    
        it('should make a first swap', async () => {
            // Initial state check
            const poolId = await multiAMM._getPoolId(tokenAddress, uniswapV3.WETH9.address);
            const poolBefore = await multiAMM.pools(poolId);
            console.log("Pool state before swap:", {
                tokenBalanceA: ethers.utils.formatEther(poolBefore.tokenBalanceA),
                tokenBalanceB: ethers.utils.formatEther(poolBefore.tokenBalanceB),
                K: poolBefore.K.toString(),
                zeroPriceActive: poolBefore.zeroPriceActive
            });
        
            // Check initial balances
            const deployerWETHBefore = await uniswapV3.WETH9.balanceOf(deployer.address);
            const deployerTokenBefore = await IERC20.attach(tokenAddress).balanceOf(deployer.address);
            const ammWETHBefore = await uniswapV3.WETH9.balanceOf(multiAMM.address);
            const ammTokenBefore = await IERC20.attach(tokenAddress).balanceOf(multiAMM.address);
        
            console.log("Balances before swap:", {
                deployer: {
                    WETH: ethers.utils.formatEther(deployerWETHBefore),
                    token: ethers.utils.formatEther(deployerTokenBefore)
                },
                amm: {
                    WETH: ethers.utils.formatEther(ammWETHBefore),
                    token: ethers.utils.formatEther(ammTokenBefore)
                }
            });
        
            // Prepare swap
            const swapAmount = ethers.utils.parseUnits('1', 15);
            console.log("Attempting to swap:", ethers.utils.formatUnits(swapAmount, 11), "WETH");
            
            // Check allowances
            const allowanceBefore = await uniswapV3.WETH9.allowance(deployer.address, ico.address);
            console.log("ICO allowance before:", ethers.utils.formatEther(allowanceBefore));
            
            // Approve and swap
            await uniswapV3.WETH9.connect(deployer as unknown as Signer).approve(ico.address, ethers.utils.parseUnits('100000', 18));
            await uniswapV3.WETH9.connect(deployer as unknown as Signer).approve(multiAMM.address, ethers.utils.parseUnits('100000', 18));
            const allowanceAfter = await uniswapV3.WETH9.allowance(deployer.address, ico.address);
            const allowanceAfterMultiAMM = await uniswapV3.WETH9.allowance(deployer.address, multiAMM.address);  
            console.log("ICO allowance after:", ethers.utils.formatEther(allowanceAfter));
            console.log("MultiAMM allowance after:", ethers.utils.formatEther(allowanceAfterMultiAMM));
            
            const transaction = await ico.connect(deployer as unknown as Signer).buyToken(
                tokenAddress, 
                swapAmount
            );
            
            const receipt = await transaction.wait();
            console.log("Swap transaction:", {
                hash: transaction.hash,
                gasUsed: receipt.gasUsed.toString()
            });
        
            // Check final state
            const poolAfter = await multiAMM.pools(poolId);
            console.log("Pool state after swap:", {
                tokenBalanceA: ethers.utils.formatEther(poolAfter.tokenBalanceA),
                tokenBalanceB: ethers.utils.formatEther(poolAfter.tokenBalanceB),
                K: poolAfter.K.toString(),
                zeroPriceActive: poolAfter.zeroPriceActive
            });
        
            // Check final balances
            const deployerWETHAfter = await uniswapV3.WETH9.balanceOf(deployer.address);
            const deployerTokenAfter = await IERC20.attach(tokenAddress).balanceOf(deployer.address);
            const ammWETHAfter = await uniswapV3.WETH9.balanceOf(multiAMM.address);
            const ammTokenAfter = await IERC20.attach(tokenAddress).balanceOf(multiAMM.address);
        
            console.log("Balances after swap:", {
                deployer: {
                    WETH: ethers.utils.formatEther(deployerWETHAfter),
                    token: ethers.utils.formatEther(deployerTokenAfter),
                    WETHDiff: ethers.utils.formatEther(deployerWETHAfter.sub(deployerWETHBefore)),
                    tokenDiff: ethers.utils.formatEther(deployerTokenAfter.sub(deployerTokenBefore))
                },
                amm: {
                    WETH: ethers.utils.formatEther(ammWETHAfter),
                    token: ethers.utils.formatEther(ammTokenAfter),
                    WETHDiff: ethers.utils.formatEther(ammWETHAfter.sub(ammWETHBefore)),
                    tokenDiff: ethers.utils.formatEther(ammTokenAfter.sub(ammTokenBefore))
                }
            });
        
            // Verify expectations
            expect(deployerTokenAfter).to.be.gt(deployerTokenBefore, "Should have received tokens");
            expect(deployerWETHAfter).to.be.lt(deployerWETHBefore, "Should have spent WETH");
            expect(ammWETHAfter).to.be.gt(ammWETHBefore, "AMM should have received WETH");
            expect(ammTokenAfter).to.be.lt(ammTokenBefore, "AMM should have sent tokens");
        });


    });
});
