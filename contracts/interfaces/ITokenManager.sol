// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;

interface ITokenManager {
    struct TokenParams {
        string name;
        string symbol;
        uint8 decimals;
    }

    event TokenCreated(
        address indexed tokenAddress, 
        address indexed owner,
        string name,
        string symbol
    );

    function createToken(TokenParams calldata params) external returns (address tokenAddress);

    function getCreatedTokens() external view returns (address[] memory);

    function getUserTokens(address user) external view returns (address[] memory);
}
