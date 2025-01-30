// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "../Token.sol";
import "hardhat/console.sol";

library FeeDistributionLib {
    event FeesDistributed(address token, uint256 totalFees, uint256 distributedAmount);

    struct FeeDistribution {
        mapping(address => mapping(address => uint256)) earlyBuyers; // token => user => amount
        mapping(address => address[]) tokenBuyers;
        mapping(address => bool) isMigrated;
    }

    function distributeSingleTokenFees(
        FeeDistribution storage self,
        address token, 
        uint256 totalFees
    ) internal returns (uint256 distributedAmount) {
        console.log("Token migrated:", self.isMigrated[token]);
        require(self.isMigrated[token] == true, "Token not migrated yet");
        
        address[] storage buyers = self.tokenBuyers[token];
        require(buyers.length > 0, "No buyers found");
        
        uint256 totalEarlyTokens;
        for (uint256 i = 0; i < buyers.length; i++) {
            totalEarlyTokens += self.earlyBuyers[token][buyers[i]];
        }
        require(totalEarlyTokens > 0, "No early tokens found");
        
        distributedAmount = (totalFees * 30) / 100;
        
        for (uint256 i = 0; i < buyers.length; i++) {
            address buyer = buyers[i];
            uint256 buyerShare = self.earlyBuyers[token][buyer];
            if (buyerShare > 0) {
                uint256 feeShare = (distributedAmount * buyerShare) / totalEarlyTokens;
                require(IERC20(token).transfer(buyer, feeShare), "Fee transfer failed");
            }
        }
        
        emit FeesDistributed(token, totalFees, distributedAmount);
    }

    function addEarlyBuyer(
        FeeDistribution storage self,
        address token,
        address buyer,
        uint256 amount
    ) internal {
        if (self.isMigrated[token] == false) {
            if (self.earlyBuyers[token][buyer] == 0) {
                self.tokenBuyers[token].push(buyer);
            }
            self.earlyBuyers[token][buyer] += amount;
        }
    }

    function setMigrated(
        FeeDistribution storage self,
        address token
    ) internal {
        self.isMigrated[token] = true;
        console.log("Setting migration status in library for token:", token);
        console.log("New migration status:", self.isMigrated[token]);
    }
}
