import { Contract } from 'ethers';
import { deployContract } from '../common/contractDeployer';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import TickLensFactory from '@uniswap/v3-periphery/artifacts/contracts/lens/TickLens.sol/TickLens.json';


class TickLensDeployer {
    private deployer: HardhatEthersSigner;

    constructor(deployer: HardhatEthersSigner) {
        this.deployer = deployer;
    }

    async deploy(): Promise<Contract> {
        return await deployContract(
            TickLensFactory.abi,
            TickLensFactory.bytecode,
            [],
            this.deployer,
        );
    }
}

export { TickLensDeployer };