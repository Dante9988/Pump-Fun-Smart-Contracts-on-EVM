import { Contract } from "ethers";

export default interface DeployedContracts {
    WETH9: Contract;
    ERC20: Contract;
    V3Factory: Contract;
    NFTManager: Contract;
    QuoterV2: Contract;
    MultiCall: Contract;
    SwapRouter: Contract;
}