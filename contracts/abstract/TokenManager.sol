// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;

import "../Token.sol";
import "../interfaces/ITokenManager.sol";

abstract contract TokenManager is ITokenManager {

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

    function getCreatedTokens() public view override returns (address[] memory) {
        return createdTokens;
    }

    function getUserTokens(address user) public view override returns (address[] memory) {
        return tokenOwners[user];
    }
}
