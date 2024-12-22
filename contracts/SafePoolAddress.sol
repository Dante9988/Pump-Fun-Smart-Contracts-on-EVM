// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

library SafePoolAddress {
    function computeAddress(
        address factory,
        address token0,
        address token1,
        uint24 fee,
        bytes32 poolInitCodeHash
    ) internal pure returns (address pool) {
        require(token0 < token1, "Tokens not sorted");
        pool = address(uint160(uint256(keccak256(abi.encodePacked(
            hex'ff',
            factory,
            keccak256(abi.encode(token0, token1, fee)),
            poolInitCodeHash
        )))));
    }
}