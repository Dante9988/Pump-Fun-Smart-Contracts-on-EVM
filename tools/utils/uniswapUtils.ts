import { ethers } from 'hardhat';
import { Contract, BigNumber, Signer } from 'ethers';
import UniswapV3Pool from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json';
import UniswapV3Factory from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

interface Slot0 {
    sqrtPriceX96: BigNumber;
    tick: number;
    observationIndex: number;
    observationCardinality: number;
    observationCardinalityNext: number;
    feeProtocol: number;
    unlocked: boolean;
}

const checkPoolLiquidity = async (
    factoryAddress: string,
    tokenA: string,
    tokenB: string,
    fee: number
): Promise<void> => {
    const factory: Contract = await ethers.getContractAt(UniswapV3Factory.abi, factoryAddress);
    const poolAddress: string = await factory.getPool(tokenA, tokenB, fee);
    const pool: Contract = await ethers.getContractAt(UniswapV3Pool.abi, poolAddress);

    const slot0: Slot0 = await pool.slot0();
    const liquidity: BigNumber = await pool.liquidity();

    console.log('Pool liquidity:', liquidity.toString());
    console.log('Pool sqrt price:', slot0.sqrtPriceX96.toString());
    console.log('Pool tick:', slot0.tick.toString());
};

const getPoolInfo = async (
    poolAddress: string,
    signer: HardhatEthersSigner
): Promise<Contract> => {
    const poolContract: Contract = new ethers.Contract(poolAddress, UniswapV3Pool.abi, signer as unknown as Signer);
    const [token0, token1, fee, tickSpacing, liquidity, slot0] = await Promise.all([
        poolContract.token0(),
        poolContract.token1(),
        poolContract.fee(),
        poolContract.tickSpacing(),
        poolContract.liquidity(),
        poolContract.slot0(),
    ]);

    const sqrtPriceX96: BigNumber = slot0[0];
    const tickCurrent: number = slot0[1];
    console.log('Pool Token0:', token0);
    console.log('Pool Token1:', token1);
    console.log('Fee:', fee);
    console.log('TickSpacing:', tickSpacing);
    console.log('Liquidity:', liquidity.toString());
    console.log('Current sqrtPriceX96:', sqrtPriceX96.toString());
    console.log('Current tick:', tickCurrent);
    console.log('===============================================');
    return poolContract;
};

export {
    getPoolInfo,
    checkPoolLiquidity,
};