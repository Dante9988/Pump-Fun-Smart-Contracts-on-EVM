import { BigNumber } from 'ethers';

const getMinTick = (tickSpacing: number): number => 
    Math.ceil(-887272 / tickSpacing) * tickSpacing;

const getMaxTick = (tickSpacing: number): number => 
    Math.floor(887272 / tickSpacing) * tickSpacing;

const getMaxLiquidityPerTick = (tickSpacing: number): BigNumber => 
    BigNumber.from(2)
        .pow(128)
        .sub(1)
        .div((getMaxTick(tickSpacing) - getMinTick(tickSpacing)) / tickSpacing + 1);

export { getMinTick, getMaxTick, getMaxLiquidityPerTick };