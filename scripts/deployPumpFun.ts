import { ethers } from 'hardhat';
import fs from 'fs';
import path from 'path';
import NFTManager from '../tools/abi/positionManager.json';

// Uniswap V3 contract addresses
const UNISWAP_ADDRESSES = {
    V3Factory: '0xEcc68469F9c015A217215E19Fb6a183FE27aD1E9',
    NFTManager: '0x0A5af2770A3c10a9db90cceAc2b8f0982Dc965aD',
    SwapRouter: '0x3f65634837F914F18dBc4Db3E9d8Aa8F547f3229',
    Multicall: '0x5ece90e8c5f60fcad38c545907d837E0a6EEf2a6',
    QuoterV2: '0x5C5C20E3722daa2f2c6d68974Bd3aAe6399aAa2F',
    TickLens: '0xA9E08cc7489c341AC7D7593D202C00120e98af00',
    // We'll need to get WETH9 address from the factory
    WETH9: '' // This will be set after getting it from the factory
};

const deploy = async () => {
    const accounts = await ethers.getSigners();
    const deployer = accounts[0];

    // Get WETH9 address from V3Factory
    const nftManagerContract = new ethers.Contract(UNISWAP_ADDRESSES.NFTManager, NFTManager, deployer);
    UNISWAP_ADDRESSES.WETH9 = await nftManagerContract.WETH9();
    console.log('WETH9 address:', UNISWAP_ADDRESSES.WETH9);

    // Get current gas price and add 20% for maxFeePerGas
    const feeData = await ethers.provider.getFeeData();
    const maxFeePerGas = feeData.maxFeePerGas ? feeData.maxFeePerGas.mul(120).div(100) : undefined;
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ? feeData.maxPriorityFeePerGas.mul(120).div(100) : undefined;

    // Deploy MockPriceFeed with $2000 ETH price (8 decimals)
    const MockPriceFeed = await ethers.getContractFactory('MockPriceFeed');
    const mockPriceFeed = await MockPriceFeed.deploy(200000000000, {
        maxFeePerGas,
        maxPriorityFeePerGas,
        gasLimit: 5000000
    });
    await mockPriceFeed.deployed();
    console.log('MockPriceFeed deployed at:', mockPriceFeed.address);
    console.log('Verify MockPriceFeed with:');
    console.log(`npx hardhat verify --network cc3 ${mockPriceFeed.address} 200000000000`);

    // Deploy MultiAMM
    const MultiAMM = await ethers.getContractFactory('MultiAMM');
    const multiAMM = await MultiAMM.deploy(UNISWAP_ADDRESSES.WETH9, {
        maxFeePerGas,
        maxPriorityFeePerGas,
        gasLimit: 5000000
    });
    await multiAMM.deployed();
    console.log('MultiAMM deployed at:', multiAMM.address);
    console.log('Verify MultiAMM with:');
    console.log(`npx hardhat verify --network cc3 ${multiAMM.address} "${UNISWAP_ADDRESSES.WETH9}"`);

    // Deploy PumpFunEVM
    const PumpFunEVM = await ethers.getContractFactory('PumpFunEvm');
    const pumpFunEVM = await PumpFunEVM.deploy(
        UNISWAP_ADDRESSES.V3Factory,
        UNISWAP_ADDRESSES.NFTManager,
        UNISWAP_ADDRESSES.SwapRouter,
        UNISWAP_ADDRESSES.WETH9,
        multiAMM.address,
        mockPriceFeed.address,
        {
            maxFeePerGas,
            maxPriorityFeePerGas,
            gasLimit: 9000000
        }
    );
    await pumpFunEVM.deployed();
    console.log('PumpFunEVM deployed at:', pumpFunEVM.address);
    console.log('Verify PumpFunEVM with:');
    console.log(`npx hardhat verify --network cc3 ${pumpFunEVM.address} "${UNISWAP_ADDRESSES.V3Factory}" "${UNISWAP_ADDRESSES.NFTManager}" "${UNISWAP_ADDRESSES.SwapRouter}" "${UNISWAP_ADDRESSES.WETH9}" "${multiAMM.address}" "${mockPriceFeed.address}"`);

    // Get network info
    const network = await ethers.provider.getNetwork();
    const chainId = network.chainId.toString();

    // Create config structure
    const config = {
        [chainId]: {
            uniswapV3: {
                factory: UNISWAP_ADDRESSES.V3Factory,
                nftManager: UNISWAP_ADDRESSES.NFTManager,
                swapRouter: UNISWAP_ADDRESSES.SwapRouter,
                weth9: UNISWAP_ADDRESSES.WETH9,
                multicall: UNISWAP_ADDRESSES.Multicall,
                quoterV2: UNISWAP_ADDRESSES.QuoterV2,
                tickLens: UNISWAP_ADDRESSES.TickLens
            },
            priceFeed: {
                address: mockPriceFeed.address
            },
            multiAMM: {
                address: multiAMM.address
            },
            pumpFunEVM: {
                address: pumpFunEVM.address
            }
        }
    };

    // Create src directory if it doesn't exist
    const srcDir = path.join(__dirname, '../src');
    if (!fs.existsSync(srcDir)) {
        fs.mkdirSync(srcDir);
    }

    // Write config file
    const configPath = path.join(srcDir, 'config.ts');
    const configContent = `export const config = ${JSON.stringify(config, null, 2)} as const;`;
    fs.writeFileSync(configPath, configContent);
    console.log('Config file written to:', configPath);

    return {
        uniswapAddresses: UNISWAP_ADDRESSES,
        mockPriceFeed,
        multiAMM,
        pumpFunEVM
    };
};

deploy()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
