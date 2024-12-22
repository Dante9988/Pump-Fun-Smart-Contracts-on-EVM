import { expect } from 'chai';
import { ethers, network } from 'hardhat';
import { TickMath } from '@uniswap/v3-sdk';
import { deployUniswapV3, createPool, mint, swap } from '../scripts/UniswapV3Scripts';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { TransactionResponse } from '@ethersproject/abstract-provider';

import * as constant from '../tools/common/const';
import { Contract, Signer } from 'ethers';
import { Token } from '@uniswap/sdk-core';
import * as uniswapAddress from '../tools/common/UniswapV3Address_31337.json';
import DeployedContracts  from '../scripts/interfaces';
import PositionManager from '../tools/abi/positionManager.json';

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

    let deployer: HardhatEthersSigner;
    let uniswapV3: DeployedContracts;
    let ico: Contract;
    let liquidityProvider: any;
    before(async () => {
        deployer = await ethers.provider.getSigner();
        uniswapV3 = await deployUniswapV3(deployer, ethers.utils.parseEther('1000000'));

        const LiquidityProvider = await ethers.getContractFactory('LiquidityProvider');
        liquidityProvider = await LiquidityProvider.deploy(
            uniswapV3.V3Factory.address, 
            uniswapV3.NFTManager.address, 
            uniswapV3.SwapRouter.address
        );
        ico = await liquidityProvider.deployed();

        // Wrap ETH to WETH
        let wrapTxn = await uniswapV3.WETH9.deposit({ value: tokens(1000) });
        await wrapTxn.wait();
        console.log(`Wrapped ETH to WETH at: ${wrapTxn.hash}`);

    });

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

});
