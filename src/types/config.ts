export interface ContractConfig {
    address: string;
}

export interface UniswapV3Config {
    factory: string;
    nftManager: string;
    swapRouter: string;
    weth9: string;
    multicall: string;
    quoterV2: string;
    tickLens: string;
}

export interface ChainConfig {
    uniswapV3: UniswapV3Config;
    priceFeed: ContractConfig;
    multiAMM: ContractConfig;
    pumpFunEVM: ContractConfig;
}

export interface Config {
    [chainId: string]: ChainConfig;
} 
