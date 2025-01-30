// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;

import "../Token.sol";
import "../interfaces/ITokenManager.sol";
import "../interfaces/IMultiAMM.sol";
import "./LiquidityManager.sol";

abstract contract TokenManager is ITokenManager, LiquidityManager {
    

    address[] public createdTokens;
    mapping(address => address[]) public tokenOwners;

    function createToken(TokenParams calldata params) public virtual override returns (address tokenAddress) {
        require(msg.sender != address(0), "Invalid sender");

        Token token = new Token(params.name, params.symbol, params.decimals, address(this));
        tokenAddress = address(token);
        require(tokenAddress != address(0), "Token creation failed");
        createdTokens.push(tokenAddress);
        tokenOwners[tokenAddress].push(msg.sender);
        emit TokenCreated(tokenAddress, msg.sender, params.name, params.symbol);
    }

    function createTokenAndPool(TokenParams calldata params) external override returns (address tokenAddress) {
        tokenAddress = this.createToken(params);
        uint256 balance = IERC20(tokenAddress).balanceOf(address(this));
    
        amm.addLiquidityAtZeroPrice(
            tokenAddress, balance
        );
        return tokenAddress;
    }

    function getCreatedTokens() public view override returns (address[] memory) {
        return createdTokens;
    }

    function getUserTokens(address user) public view override returns (address[] memory) {
        return tokenOwners[user];
    }
}
