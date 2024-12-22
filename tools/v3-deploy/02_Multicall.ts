import { Contract } from 'ethers';
import { deployContract } from '../common/contractDeployer';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

import MultiCallFactory from '@uniswap/v3-periphery/artifacts/contracts/lens/UniswapInterfaceMulticall.sol/UniswapInterfaceMulticall.json';

class MultiCallDeployer {
    private deployer: HardhatEthersSigner;

    constructor(deployer: HardhatEthersSigner) {
        this.deployer = deployer;
    }

    async deploy(): Promise<Contract> {
        return await deployContract(
            MultiCallFactory.abi,
            MultiCallFactory.bytecode,
            [],
            this.deployer,
        );
    }
}

export { MultiCallDeployer };