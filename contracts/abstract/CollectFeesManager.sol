
// pragma solidity ^0.7.6;
// pragma abicoder v2;

// import "../interfaces/INonfungiblePositionManager.sol";
// import "../libs/FeeDistributeLib.sol";

// abstract contract CollectFeesManager {
//     using FeeDistributionLib for FeeDistributionLib.FeeDistribution;

//     FeeDistributionLib.FeeDistribution private feeDistribution;
//     INonfungiblePositionManager public nonfungiblePositionManager;

//     event FeesCollected(uint256 amount0, uint256 amount1, uint256 tokenId);

//     constructor(address _nonfungiblePositionManager) {
//         nonfungiblePositionManager = INonfungiblePositionManager(_nonfungiblePositionManager);
//     }

//     function collectFees(INonfungiblePositionManager.CollectParams calldata params) public virtual returns (uint256 amount0, uint256 amount1) {
//         // Get position information to access token addresses
//         (
//             ,
//             ,
//             address token0,
//             address token1,
//             ,
//             ,
//             ,
//             ,
//             ,
//             ,
//             ,
//         ) = nonfungiblePositionManager.positions(params.tokenId);
        
//         // Collect the fees
//         (amount0, amount1) = nonfungiblePositionManager.collect(params);
//         require(amount0 > 0 || amount1 > 0, "No fees to collect");

//         if (amount0 > 0) {
//             feeDistribution.distributeSingleTokenFees(token0, amount0);
//         }
//         if (amount1 > 0) {
//             feeDistribution.distributeSingleTokenFees(token1, amount1);
//         }
        
//         emit FeesCollected(amount0, amount1, params.tokenId);
//     }

//     function _addEarlyBuyer(address token, address buyer, uint256 amount) internal {
//         feeDistribution.addEarlyBuyer(token, buyer, amount);
//     }

//     function setMigrated(address token) internal {
//         feeDistribution.setMigrated(token);
//     }
// }

// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;

import "../interfaces/INonfungiblePositionManager.sol";
import "../Token.sol";
import "hardhat/console.sol";

abstract contract CollectFeesManager {
    // State variables for fee distribution
    mapping(address => mapping(address => uint256)) public earlyBuyers; // token => user => amount
    mapping(address => address[]) public tokenBuyers;
    mapping(address => bool) public isMigrated;
    address public owner;

    INonfungiblePositionManager public nonfungiblePositionManager;

    // Events
    event FeesCollected(uint256 amount0, uint256 amount1, uint256 tokenId);
    event FeesDistributed(address token, uint256 totalFees, uint256 distributedAmount);
    event EarlyBuyerRegistered(address buyer, address token, uint256 amount);
    event TokenMigrated(address token);

    constructor(address _nonfungiblePositionManager, address _owner) {
        nonfungiblePositionManager = INonfungiblePositionManager(_nonfungiblePositionManager);
        owner = _owner;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    function collectFees(INonfungiblePositionManager.CollectParams calldata params) public virtual returns (uint256 amount0, uint256 amount1) {
        // Get position information to access token addresses
        (
            ,
            ,
            address token0,
            address token1,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
        ) = nonfungiblePositionManager.positions(params.tokenId);
        
        // Collect the fees
        (amount0, amount1) = nonfungiblePositionManager.collect(params);
        require(amount0 > 0 || amount1 > 0, "No fees to collect");

        if (amount0 > 0) {
            _distributeFees(token0, amount0);
        }
        if (amount1 > 0) {
            _distributeFees(token1, amount1);
        }
        
        emit FeesCollected(amount0, amount1, params.tokenId);
    }

    function _addEarlyBuyer(address token, address buyer, uint256 amount) public onlyOwner {
        if (!isMigrated[token]) {
            if (earlyBuyers[token][buyer] == 0) {
                tokenBuyers[token].push(buyer);
                console.log("Token buyers:", tokenBuyers[token].length);
            }
            earlyBuyers[token][buyer] += amount;
            emit EarlyBuyerRegistered(buyer, token, amount);
        }
    }

    function _setMigrated(address token) public onlyOwner {
        isMigrated[token] = true;
        emit TokenMigrated(token);
    }

    function _distributeFees(address token,  uint256 totalFees) internal returns (uint256 distributedAmount) {
        require(isMigrated[token], "Token not migrated yet");

        console.log("Token buyers:", tokenBuyers[token].length);
        //console.log("Early buyers:", earlyBuyers[token]);
        
        address[] storage buyers = tokenBuyers[token];
        require(buyers.length > 0, "No buyers found");
        
        uint256 totalEarlyTokens;
        for (uint256 i = 0; i < buyers.length; i++) {
            totalEarlyTokens += earlyBuyers[token][buyers[i]];
        }
        require(totalEarlyTokens > 0, "No early tokens found");
        
        distributedAmount = (totalFees * 30) / 100;
        
        for (uint256 i = 0; i < buyers.length; i++) {
            address buyer = buyers[i];
            uint256 buyerShare = earlyBuyers[token][buyer];
            if (buyerShare > 0) {
                uint256 feeShare = (distributedAmount * buyerShare) / totalEarlyTokens;
                require(IERC20(token).transfer(buyer, feeShare), "Fee transfer failed");
            }
        }
        
        emit FeesDistributed(token, totalFees, distributedAmount);
    }
}
