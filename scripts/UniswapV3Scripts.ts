import { ethers } from 'hardhat';
//import { Wallet } from 'ethers';
import fs from 'fs/promises';
import path from 'path';
import { UniswapV3Deployer } from '../tools/v3-deploy/01_Core';
import { MultiCallDeployer } from '../tools/v3-deploy/02_Multicall';
import { QuoterV2Deployer } from '../tools/v3-deploy/03_QuoterV2';
import { TickLensDeployer } from '../tools/v3-deploy/04_TickLens';
import { TickMath, TICK_SPACINGS, priceToClosestTick, NonfungiblePositionManager } from '@uniswap/v3-sdk';
import * as constant from '../tools/common/const';
import { Token, CurrencyAmount, Percent, TradeType, Fraction } from '@uniswap/sdk-core';
import { SwapRouter, Pool, Route, Trade, SwapQuoter } from '@uniswap/v3-sdk';
import UniswapV3FactoryABI from '../tools/abi/factory.json';
import NonfungiblePositionManagerABI from '../tools/abi/positionManager.json';
import ERC20ABI from '../tools/abi/erc20.json';
import ERC20CustomABI from '../tools/contract_artifacts/TestERC20.json';
import UniswapV3PoolABI from '../tools/abi/pool.json';
import QuoterV2ABI from '@uniswap/v3-periphery/artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json';
import SwapRouterABI from '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json';
import WETH9ABI from '../tools/contract_artifacts/WETH9.json';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { Signer, BigNumber, Contract } from 'ethers';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { getPoolInfo } from '../tools/utils/uniswapUtils';

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

let transaction: TransactionResponse;

const tokens = (n: number) => {
    return ethers.utils.parseUnits(n.toString(), 'ether');
} 

async function main() {
    let accounts = await ethers.getSigners();
    let signer = accounts[0];
    const mintAmount = 1000000;

    console.log(`This is the signer address: ${signer.address}`)
    const deployedContracts = await deployUniswapV3(signer as unknown as HardhatEthersSigner, tokens(mintAmount));
    console.log(`======UniswapV3 deployed successfully======\n`);
    console.log(`${JSON.stringify(deployedContracts, null, 2)}\n`);

    // const priceRatio = Math.log(3 * Math.pow(10, -12)) / Math.log(1.0001);
    // const tick = Math.floor(priceRatio);
    // const sqrtPriceX96 = TickMath.getSqrtRatioAtTick(tick).toString();
    // console.log(`sqrtPriceX96: ${sqrtPriceX96}`);

    // const addresses = {
    //     token1: deployedContracts.ERC20.address,
    //     token2: deployedContracts.WETH9.address,
    // };

    // const poolAddress = await createPool(signer, addresses, FEE_AMOUNT_LOW, sqrtPriceX96);
    // console.log(`======Pool created successfully======\n`);
    // console.log(`Pool address: ${poolAddress}\n`);

    // const poolContract = await getPoolInfo(poolAddress, signer);
    // console.log(`======Pool info retrieved successfully======\n`);
    // console.log(`==============================================\n`);

    // const tokenId = await mint(signer, addresses, FEE_AMOUNT_LOW, '10', '10');
    // console.log(`======Token minted successfully======\n`);
    // console.log(`Token ID: ${tokenId}\n`);

    // const tx = await swap(signer, addresses, '1');
    // console.log(`======Swap successful======\n`);
    // console.log(`Swap Transaction hash: ${tx.hash}\n`);
}

// main();

const artifacts = {
    UniswapV3Factory: UniswapV3FactoryABI,
    NonfungiblePositionManager: NonfungiblePositionManagerABI,
    ERC20: ERC20ABI,
    ERC20Custom: ERC20CustomABI,
    UniswapV3Pool: UniswapV3PoolABI,
    QuoterV2: QuoterV2ABI,
    SwapRouter: SwapRouterABI,
    WETH9: WETH9ABI,
};

const TEST_DIR = path.resolve(__dirname, '../');
const MINT_AMOUNT = BigInt(1_000_000_000 * 10 ** 18);

// initial ratio of token A and B
const sqrt = TickMath.getSqrtRatioAtTick(-275462);
const sqrt10 = TickMath.getSqrtRatioAtTick(10);

interface DeployedContracts {
    WETH9: Contract;
    ERC20: Contract;
    V3Factory: Contract;
    NFTManager: Contract;
    QuoterV2: Contract;
    MultiCall: Contract;
    SwapRouter: Contract;
}

export interface Addresses {
    token1: string;
    token2: string;
}

interface FeeAmountProperties {
    FEE_AMOUNT: number;
    TICK_LOWER: number;
    TICK_UPPER: number;
}

export async function deployUniswapV3(signer: HardhatEthersSigner, mintAmount: BigNumber): Promise<DeployedContracts> {
    console.log('Deploying with address:', await signer.getAddress());
    const v3Deployer = new UniswapV3Deployer(signer);
    const multiCallDeployer = new MultiCallDeployer(signer);
    const quoterV2Deployer = new QuoterV2Deployer(signer);
    const tickLensDeployer = new TickLensDeployer(signer);

    const WETH9 = await v3Deployer.deployWETH9();
    const ERC20 = await v3Deployer.deployERC20(mintAmount);
    console.log(`WETH: ${WETH9.address}`);
    console.log(`ERC20: ${ERC20.address}`);

    const V3Factory = await v3Deployer.deployFactory();
    const NFTDescriptor = await v3Deployer.deployNFTDescriptorLibrary();
    const PositionDescriptor = await v3Deployer.deployPositionDescriptor(NFTDescriptor.address, WETH9.address);
    const NFTPositionManager = await v3Deployer.deployNonfungiblePositionManager(
        V3Factory.address,
        WETH9.address,
        PositionDescriptor.address,
    );
    console.log(`PositionDescriptor: ${PositionDescriptor.address}`);
    const SwapRouter = await v3Deployer.SwapRouter(V3Factory.address, WETH9.address);
    console.log(`V3Factory: ${V3Factory.address}`);
    console.log(`NFTManager: ${NFTPositionManager.address}`);
    console.log(`V3SwapRouter: ${SwapRouter.address}`);

    const multiCall = await multiCallDeployer.deploy();
    console.log(`multiCall: ${multiCall.address}`);

    const quoterV2 = await quoterV2Deployer.deploy(V3Factory.address, WETH9.address);
    console.log(`QuoterV2: ${quoterV2.address}`);

    const tickLens = await tickLensDeployer.deploy();
    console.log(`TickLens: ${tickLens.address}`);
    console.log(`======UniswapV3 deployed successfully======`);

    const WETH9Contract = await ethers.getContractAt(artifacts.WETH9.abi, WETH9.address, signer as unknown as Signer);
    const ERC20Contract = await ethers.getContractAt(artifacts.ERC20, ERC20.address, signer as unknown as Signer);
    
    let transaction = await ERC20Contract.approve(NFTPositionManager.address, MINT_AMOUNT);
    await transaction.wait();
    console.log(`ERC20 approve transaction hash: ${transaction.hash}`);

    transaction = await WETH9Contract.deposit({ value: ethers.utils.parseUnits("0.01", 18) });
    await transaction.wait();
    console.log(`WETH9 deposit transaction hash: ${transaction.hash}`);

    transaction = await WETH9Contract.approve(NFTPositionManager.address, BigInt(10000) * BigInt(10 ** 18));
    await transaction.wait();
    console.log(`WETH9 approve transaction hash: ${transaction.hash}`);

    // save all the contract addresses to a json file
    const outputFilePath = `${TEST_DIR}/tools/common/UniswapV3Address_${(await ethers.provider.getNetwork()).chainId}.json`;
    const output = {
        WETH9: WETH9.address,
        ERC20: ERC20.address,
        V3Factory: V3Factory.address,
        NFTManager: NFTPositionManager.address,
        V3SwapRouter: SwapRouter.address,
        multiCall: multiCall.address,
        QuoterV2: quoterV2.address,
        TickLens: tickLens.address,
        DeployerAddress: await signer.getAddress(),
        PositionDescriptor: PositionDescriptor.address,
    };
    await fs.writeFile(outputFilePath, JSON.stringify(output, null, 2));
    
    return {
        WETH9,
        ERC20,
        V3Factory,
        NFTManager: NFTPositionManager,
        QuoterV2: quoterV2,
        MultiCall: multiCall,
        SwapRouter,
    };
}

export async function createPool(
    signer: HardhatEthersSigner,
    addresses: Addresses,
    FEE_AMOUNT_PROPERTIES: FeeAmountProperties,
    sqrtPriceX96: string
): Promise<string> {
    const addressBookPath = `${TEST_DIR}/tools/common/UniswapV3Address_${(await ethers.provider.getNetwork()).chainId}.json`;
    const addressBook = require(addressBookPath);

    const V3Factory = new ethers.Contract(addressBook.V3Factory, artifacts.UniswapV3Factory, signer as unknown as Signer);
    const NFTPositionManager = new ethers.Contract(addressBook.NFTManager, artifacts.NonfungiblePositionManager, signer as unknown as Signer);
    const token1 = new ethers.Contract(addresses.token1, artifacts.ERC20, signer as unknown as Signer);
    const token2 = new ethers.Contract(addresses.token2, artifacts.ERC20, signer as unknown as Signer);

    const token1Decimals = await token1.decimals();
    const token2Decimals = await token2.decimals();

    const balanceOfSigner = await token1.balanceOf(await signer.getAddress());
    console.log('Balance of signer of token1 is:', balanceOfSigner.toString());
    const balanceOfSigner2 = await token2.balanceOf(await signer.getAddress());
    console.log('Balance of signer of token2 is:', balanceOfSigner2.toString());

    const tokenPair = constant.sortedTokens(token1, token2);
    console.log('Token0:', tokenPair[0].address);
    console.log('Token1:', tokenPair[1].address);

    const txn = await NFTPositionManager.createAndInitializePoolIfNecessary(
        tokenPair[0].address,
        tokenPair[1].address,
        FEE_AMOUNT_PROPERTIES.FEE_AMOUNT,
        sqrtPriceX96,
        { gasLimit: 30000000 }
    );

    const poolAddress = await V3Factory.getPool(
        tokenPair[0].address,
        tokenPair[1].address,
        FEE_AMOUNT_PROPERTIES.FEE_AMOUNT
    );

    const output = {
        ...addressBook,
        PoolAddress: poolAddress,
    };
    await fs.writeFile(addressBookPath, JSON.stringify(output, null, 2));

    const updatedData = await fs.readFile(addressBookPath, 'utf8');
    const parsedData = JSON.parse(updatedData);

    if (parsedData.PoolAddress === poolAddress) {
        console.log('PoolAddress written successfully:', parsedData.PoolAddress);
    } else {
        console.error('Error: PoolAddress not written correctly.');
    }

    return poolAddress;
}

export async function mint(
    signer: HardhatEthersSigner,
    addresses: Addresses,
    FEE_AMOUNT_PROPERTIES: FeeAmountProperties,
    amount0: string,
    amount1: string
): Promise<string> {
    const addressBookPath = `${TEST_DIR}/tools/common/UniswapV3Address_${(await ethers.provider.getNetwork()).chainId}.json`;
    const addressBook = require(addressBookPath);
    const address = await signer.getAddress();
    const currentBlockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
    const deadline = Math.floor(currentBlockTimestamp) + 60 * 20;
    const gasPrice = await signer.provider.getGasPrice();
    console.log(`==============================================`);
    console.log(`Gas price: ${gasPrice}`);
    console.log(`==============================================`);

    const Token1Contract = new ethers.Contract(
        addresses.token1,
        addresses.token1.toLowerCase() === addressBook.WETH9.toLowerCase() ? artifacts.WETH9.abi : artifacts.ERC20,
        signer as unknown as Signer 
    );
    const Token2Contract = new ethers.Contract(
        addresses.token2,
        addresses.token2.toLowerCase() === addressBook.WETH9.toLowerCase() ? artifacts.WETH9.abi : artifacts.ERC20,
        signer as unknown as Signer 
    );

    const token1Decimals = await Token1Contract.decimals();
    const token2Decimals = await Token2Contract.decimals();

    console.log('Token1:', {
        address: addresses.token1,
        isWETH: addresses.token1.toLowerCase() === addressBook.WETH9.toLowerCase(),
        decimals: token1Decimals,
    });

    console.log('Token2:', {
        address: addresses.token2,
        isWETH: addresses.token2.toLowerCase() === addressBook.WETH9.toLowerCase(),
        decimals: token2Decimals,
    });

    amount0 = (Number(amount0) * 2).toString();
    amount1 = (Number(amount1) * 2).toString();
    console.log(`Amount0: ${amount0}\n`);
    console.log(`Amount1: ${amount1}\n`);

    const AMOUNT_0_DESIRED = ethers.utils.parseUnits(amount0, token1Decimals);
    console.log(`${await Token1Contract.symbol()} decimals: ${token1Decimals}\n`);
    const AMOUNT_1_DESIRED = ethers.utils.parseUnits(amount1, token2Decimals);
    console.log(`${await Token2Contract.symbol()} decimals: ${token2Decimals}\n`);
    const AMOUNT_0_MIN = ethers.utils.parseUnits('0', token1Decimals);
    const AMOUNT_1_MIN = ethers.utils.parseUnits('0', token2Decimals);
    const tokenPair = constant.sortedTokens(Token1Contract, Token2Contract);

    let balance = await Token1Contract.balanceOf(address);
    console.log(`${await Token1Contract.symbol()} balance: ${balance}\n`);
    balance = await Token2Contract.balanceOf(address);
    console.log(`${await Token2Contract.symbol()} balance: ${balance}\n`);

    transaction = await Token1Contract.approve(addressBook.NFTManager, AMOUNT_0_DESIRED);
    await transaction.wait();
    console.log(`${await Token1Contract.symbol()} Approve transaction hash: ${transaction.hash}\n`);
    transaction = await Token2Contract.approve(addressBook.NFTManager, AMOUNT_1_DESIRED);
    await transaction.wait();
    console.log(`${await Token2Contract.symbol()} Approve transaction hash: ${transaction.hash}\n`);

    const overrides = {
        gasLimit: 4000000,
        gasPrice: gasPrice.mul(2),
    };
    const NFTPositionManager = new ethers.Contract(
        addressBook.NFTManager,
        artifacts.NonfungiblePositionManager,
        signer as unknown as Signer
    );
    console.log('Sending mint transaction...\n');
    let txn;

    try {
        txn = await NFTPositionManager.mint(
            [
                tokenPair[0].address,
                tokenPair[1].address,
                FEE_AMOUNT_PROPERTIES.FEE_AMOUNT,
                FEE_AMOUNT_PROPERTIES.TICK_LOWER,
                FEE_AMOUNT_PROPERTIES.TICK_UPPER,
                AMOUNT_0_DESIRED.toString(),
                AMOUNT_1_DESIRED.toString(),
                AMOUNT_0_MIN.toString(),
                AMOUNT_1_MIN.toString(),
                address,
                deadline.toString(),
            ],
            overrides
        );
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.log('Error message:', error.message);
        }
        console.error('Error during mint transaction:', error);
        throw error;
    }

    const receipt = await txn.wait();
    const events = receipt.events.filter((e: { event: string; }) => e.event === 'IncreaseLiquidity');
    let tokenId;
    if (events.length > 0) {
        tokenId = events[0].args.tokenId;
        console.log(`Token ID: ${tokenId.toString()}\n`);
        process.env.TOKEN_ID = tokenId.toString();
    }
    console.log(`Transaction successful: ${txn.hash}\n`);
    return tokenId.toString();
}

export async function swap(
    signer: HardhatEthersSigner,
    addresses: Addresses,
    poolAddress: string,
    amountInOverride: string | null = null,
    exactInput: boolean = true
): Promise<TransactionResponse> {
    try {

        const network = await signer.provider!.getNetwork();
        const addressBookPath = path.resolve(__dirname, `../tools/common/UniswapV3Address_${network.chainId}.json`);
        const addressBook = require(addressBookPath);
        console.log(`Chain ID: ${network.chainId}\n`);

        const currentBlockTimestamp = (await signer.provider!.getBlock('latest')).timestamp;
        const deadline = Math.floor(currentBlockTimestamp) + 60 * 20;
        const gasPrice = await signer.provider!.getGasPrice();

        const tokenSymbol_Contract = new ethers.Contract(
            addresses.token1,
            addresses.token1.toLowerCase() === addressBook.WETH9.toLowerCase() ? artifacts.WETH9.abi : artifacts.ERC20,
            signer as unknown as Signer
        );
        const tokenSymbol2_Contract = new ethers.Contract(
            addresses.token2,
            addresses.token2.toLowerCase() === addressBook.WETH9.toLowerCase() ? artifacts.WETH9.abi : artifacts.ERC20,
            signer as unknown as Signer
        );

        const token1Decimals = await tokenSymbol_Contract.decimals();
        const token2Decimals = await tokenSymbol2_Contract.decimals();

        console.log('Token Details:', {
            token1: {
                symbol: await tokenSymbol_Contract.symbol(),
                decimals: token1Decimals,
                isWETH: addresses.token1.toLowerCase() === addressBook.WETH9.toLowerCase(),
            },
            token2: {
                symbol: await tokenSymbol2_Contract.symbol(),
                decimals: token2Decimals,
                isWETH: addresses.token2.toLowerCase() === addressBook.WETH9.toLowerCase(),
            },
        });

        const amountIn = amountInOverride || '10.0';
        const amount = ethers.utils.parseUnits(amountIn.toString(), token1Decimals);

        const tokenSymbol_Token = new Token(
            network.chainId,
            addresses.token1,
            token1Decimals,
            await tokenSymbol_Contract.symbol(),
            'Token 1'
        );
        const tokenSymbol2_Token = new Token(
            network.chainId,
            addresses.token2,
            token2Decimals,
            await tokenSymbol2_Contract.symbol(),
            'Token 2'
        );

        console.log('Swap PoolAddress', poolAddress);

        const poolContract = new ethers.Contract(poolAddress, artifacts.UniswapV3Pool, signer as unknown as Signer);
        const [token0, token1, fee, tickSpacing, liquidity, slot0] = await Promise.all([
            poolContract.token0(),
            poolContract.token1(),
            poolContract.fee(),
            poolContract.tickSpacing(),
            poolContract.liquidity(),
            poolContract.slot0(),
        ]);

        const sqrtPriceX96 = slot0[0];
        const tickCurrent = slot0[1];
        console.log('Pool Token0:', token0);
        console.log('Pool Token1:', token1);
        console.log('Fee:', fee);
        console.log('TickSpacing:', tickSpacing);
        console.log('Liquidity:', liquidity.toString());
        console.log('Current sqrtPriceX96:', sqrtPriceX96.toString());
        console.log('Current tick:', tickCurrent);

        const priceBefore = (Number(sqrtPriceX96) * Number(sqrtPriceX96) * (10 ** -18)) / (2 ** 192);
        const priceInWETH = token0 < token1 ? priceBefore : 1/priceBefore;
        console.log('Price before swap (in WETH):', priceInWETH.toFixed(18));  // Should show: ~0.000000030315789473

        const observedPrice = (Number(sqrtPriceX96) ** 2 * 10 ** -18) / (2 ** 192);
        console.log('Observed price from pool:', observedPrice);

        const swapPool = new Pool(
            tokenSymbol_Token,
            tokenSymbol2_Token,
            fee,
            sqrtPriceX96.toString(),
            liquidity.toString(),
            tickCurrent
        );

        const swapRoute = new Route([swapPool], tokenSymbol_Token, tokenSymbol2_Token);

        const { calldata } = SwapQuoter.quoteCallParameters(
            swapRoute,
            CurrencyAmount.fromRawAmount(
                tokenSymbol_Token,
                ethers.utils.parseUnits(amountIn.toString(), tokenSymbol_Token.decimals).toString()
            ),
            exactInput ? TradeType.EXACT_INPUT : TradeType.EXACT_OUTPUT,
            {
                useQuoterV2: true,
            }
        );

        let quoteCallReturnData;
        try {
            quoteCallReturnData = await signer.provider!.call({
                to: addressBook.QuoterV2,
                data: calldata,
            });
        } catch (error) {
            console.error('Error during provider.call:', error);
            throw error;
        }

        if (!quoteCallReturnData || quoteCallReturnData === '0x') {
            throw new Error('QuoterV2 returned empty data');
        }

        const decoded = ethers.utils.defaultAbiCoder.decode(['uint256', 'uint160', 'uint32'], quoteCallReturnData);
        const amountOut = decoded[0];
        const expectedOut = Number(amountIn) / observedPrice;
        console.log('Raw amount out:', amountOut.toString());
        console.log('Input amount:', amountIn, 'WETH');
        console.log('Expected tokens out:', expectedOut.toString());

        const formattedAmountOut = ethers.utils.formatUnits(amountOut, token2Decimals);
        console.log('Amount out:', formattedAmountOut);

        if (Math.abs(Number(amountOut) - expectedOut) > expectedOut * 0.05) {
            console.warn('Significant deviation detected in expected output.');
        }
        const adjustedAmountOut = amountOut.div(100);

        transaction = await tokenSymbol_Contract.approve(
            addressBook.V3SwapRouter,
            amount
        );
        await transaction.wait();
        console.log(`${await tokenSymbol_Contract.symbol()} Approve transaction hash: ${transaction.hash}`);

        transaction = await tokenSymbol2_Contract.approve(
            addressBook.V3SwapRouter,
            adjustedAmountOut
        );
        await transaction.wait();
        console.log(`${await tokenSymbol2_Contract.symbol()} Approve transaction hash: ${transaction.hash}`);

        const options = {
            slippageTolerance: new Percent(50, 10000), // 0.50%
            deadline: deadline,
            recipient: await signer.getAddress(),
        };

        const trade = Trade.createUncheckedTrade({
            route: swapRoute,
            inputAmount: CurrencyAmount.fromRawAmount(
                tokenSymbol_Token,
                ethers.utils.parseUnits(amountIn.toString(), tokenSymbol_Token.decimals).toString()
            ),
            outputAmount: CurrencyAmount.fromRawAmount(tokenSymbol2_Token, adjustedAmountOut.toString()),
            tradeType: TradeType.EXACT_INPUT,
        });

        const methodParameters = SwapRouter.swapCallParameters([trade], options);
        const tx = {
            data: methodParameters.calldata,
            to: addressBook.V3SwapRouter,
            value: methodParameters.value,
            from: await signer.getAddress(),
            gasPrice: gasPrice,
            gasLimit: 4000000,
        };

        const txResponse = await signer.sendTransaction(tx);
        console.log('Transaction hash:', txResponse.hash);

        const balance1 = await tokenSymbol_Contract.balanceOf(await signer.getAddress());
        const balance2 = await tokenSymbol2_Contract.balanceOf(await signer.getAddress());
        console.log(
            `Balance ${await tokenSymbol_Contract.symbol()}:`,
            ethers.utils.formatUnits(balance1, token1Decimals)
        );
        console.log(
            `Balance ${await tokenSymbol2_Contract.symbol()}:`,
            ethers.utils.formatUnits(balance2, token2Decimals)
        );
        return txResponse;
    } catch (error: any) {
        if (error.message.includes('STF')) {
            console.error(
                'Swap failed due to insufficient funds or allowance. Try swapping the other way around:',
                error.message
            );
        } else {
            console.error('An unexpected error occurred:', error.message);
        }
        throw error;
    }
}
