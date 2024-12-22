import { ethers } from 'hardhat';
import { Contract, ContractFactory, Signer } from 'ethers';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

async function deployContract(
    abi: any[],
    bytecode: string,
    deployParams: any[],
    actor: HardhatEthersSigner
): Promise<Contract> {
    const factory: ContractFactory = new ethers.ContractFactory(abi, bytecode, actor as unknown as Signer); // TODO: fix this
    return await factory.deploy(...deployParams);
}

export { deployContract };
