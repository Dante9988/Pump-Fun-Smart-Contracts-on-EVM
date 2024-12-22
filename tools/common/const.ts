import { BigNumber } from 'ethers';

const MAX_UINT128: BigNumber = BigNumber.from(2).pow(128).sub(1);

const FEE_AMOUNT = {
    LOWEST: 100,
    LOW: 500,
    MEDIUM: 3000,
    HIGH: 10000,
};

const TICK_SPACINGS: Record<number, number> = {
    [FEE_AMOUNT.LOWEST]: 10,
    [FEE_AMOUNT.LOW]: 10,
    [FEE_AMOUNT.MEDIUM]: 60,
    [FEE_AMOUNT.HIGH]: 200,
};

const getSqrt = (reserve0: BigNumber, reserve1: BigNumber): bigint => {
    const sqrtValue = (BigInt(reserve1.toString()) / BigInt(reserve0.toString())).toString();
    const scaledValue = (BigInt(sqrtValue) * BigInt(2) ** BigInt(96)).toString();
    return BigInt(scaledValue);
};

const getSqrtPriceFromTick = (tick: number): BigNumber => {
    const sqrtValue = BigNumber.from(1.0001)
        .pow(tick / 2)
        .toString();
    return BigNumber.from(sqrtValue).mul(BigNumber.from(2).pow(96));
};

interface Token {
    address: string;
}

const compareToken = (a: Token, b: Token): number => {
    return a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1;
};

const sortedTokens = (a: Token, b: Token): [Token, Token] => {
    return compareToken(a, b) < 0 ? [a, b] : [b, a];
};

const getMinTick = (tickSpacing: number): number => {
    return Math.ceil(-887272 / tickSpacing) * tickSpacing;
};

const getMaxTick = (tickSpacing: number): number => {
    return Math.floor(887272 / tickSpacing) * tickSpacing;
};

const MIN_SQRT_RATIO: number = 4295128739;
const MAX_SQRT_RATIO: bigint = BigInt('1461446703485210103287273052203988822378723970342');

export {
    FEE_AMOUNT,
    TICK_SPACINGS,
    MAX_UINT128,
    MIN_SQRT_RATIO,
    MAX_SQRT_RATIO,
    getSqrt,
    sortedTokens,
    getMinTick,
    getMaxTick,
    getSqrtPriceFromTick,
};
