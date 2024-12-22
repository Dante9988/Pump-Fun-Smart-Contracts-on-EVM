import { linkLibraries } from '../common/linkLibraries';
import { deployContract } from '../common/contractDeployer';
import { utils, Contract } from 'ethers';
import UniswapV3Factory from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json';
import UniswapV3PoolArtifact from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json';
import SwapRouter from '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json';
import NFTDescriptor from '@uniswap/v3-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json';
import NonfungibleTokenPositionDescriptor from '@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json';
import NonfungiblePositionManager from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json';
import WETH9 from '../contract_artifacts/WETH9.json';
import ERC20Custom from '../contract_artifacts/TestERC20.json';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

class UniswapV3Deployer {
    private deployer: HardhatEthersSigner;

    constructor(deployer: HardhatEthersSigner) {
        this.deployer = deployer;
    }
    async deployFactory(): Promise<Contract> {
        const V3Factory = await deployContract(
            UniswapV3Factory.abi,
            UniswapV3Factory.bytecode,
            [],
            this.deployer,
        );
        return V3Factory;
    }
    async SwapRouter(factoryAddress: string, weth9Address: string): Promise<Contract> {
        return await deployContract(
            SwapRouter.abi,
            SwapRouter.bytecode,
            [factoryAddress, weth9Address],
            this.deployer
        );
    }

    async deployNFTDescriptorLibrary(): Promise<Contract> {
        return await deployContract(
            NFTDescriptor.abi,
            NFTDescriptor.bytecode,
            [],
            this.deployer,
        );
    }

    async deployPositionDescriptor(nftDescriptorLibraryAddress: string, weth9Address: string): Promise<Contract> {
        const linkedBytecode = linkLibraries(
            NonfungibleTokenPositionDescriptor.bytecode,
            {
                'NFTDescriptor.sol': {
                    NFTDescriptor: [
                        {
                            length: 20,
                            start: 1681,
                        },
                    ],
                },
            },
            {
                NFTDescriptor: nftDescriptorLibraryAddress,
            },
        );
        return await deployContract(
            NonfungibleTokenPositionDescriptor.abi,
            linkedBytecode,
            [weth9Address, utils.formatBytes32String('TEST')],
            this.deployer,
        );
    }

    async deployNonfungiblePositionManager(factoryAddress: string, weth9Address: string, positionDescriptorAddress: string): Promise<Contract> {
        return await deployContract(
            NonfungiblePositionManager.abi,
            NonfungiblePositionManager.bytecode,
            [factoryAddress, weth9Address, positionDescriptorAddress],
            this.deployer,
        );
    }

    async deployWETH9(): Promise<Contract> {
        return await deployContract(WETH9.abi, WETH9.bytecode, [], this.deployer);
    }

    async deployERC20(mintAmount: any): Promise<Contract> {
        return await deployContract(
            ERC20Custom.abi,
            ERC20Custom.bytecode,
            [mintAmount, 'TEST-TOKEN', 'TT'],
            this.deployer,
        );
    }

    async deployERC20Custom(mintAmount: any, name: string, symbol: string): Promise<Contract> {
        return await deployContract(
            ERC20Custom.abi,
            ERC20Custom.bytecode,
            [mintAmount, name, symbol],
            this.deployer,
        );
    }
}

export { UniswapV3Deployer };