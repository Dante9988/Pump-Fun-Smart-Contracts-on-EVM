import { Contract } from 'ethers';
import { deployContract } from '../common/contractDeployer';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

import QuoterV2Factory from '@uniswap/v3-periphery/artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json';

class QuoterV2Deployer {
    private deployer: HardhatEthersSigner;

    constructor(deployer: HardhatEthersSigner) {
        this.deployer = deployer;
    }

    async deploy(factoryAddress: string, weth9Address: string): Promise<Contract> {
        return await deployContract(
            QuoterV2Factory.abi,
            QuoterV2Factory.bytecode,
            [factoryAddress, weth9Address],
            this.deployer,
        );
    }
}

export { QuoterV2Deployer };