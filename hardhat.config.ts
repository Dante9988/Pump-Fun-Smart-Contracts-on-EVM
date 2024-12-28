import { HardhatUserConfig } from "hardhat/config";
import "hardhat-contract-sizer";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from 'dotenv';
dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
          metadata: {
            bytecodeHash: 'none',
          },
        },
      },
    ],
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true
  },
  networks: {
    localhost: {
      url: "http://localhost:8545",
    },
    cc3: {
      url: 'https://rpc.cc3-testnet.creditcoin.network',
      chainId: 102031,
      accounts: [`${process.env.PRIVATE_KEY}`],
      gas: 5000000,
      gasPrice: 20000000000,
    },
  },
  etherscan: {
    apiKey: {
      cc3: "ABC"
    },
    customChains: [
      {
        network: "cc3",
        chainId: 102031,
        urls: {
          apiURL: "https://creditcoin-testnet.blockscout.com/api",
          browserURL: "https://creditcoin-testnet.blockscout.com/",
        },
      }
    ]
  },
};

export default config;
