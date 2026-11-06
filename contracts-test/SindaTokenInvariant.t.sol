// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {SindaToken} from "../contracts/token/SindaToken.sol";

contract SindaTokenInvariantTest is Test {
    SindaToken internal token;
    uint256 internal constant FIXED_SUPPLY = 1_000_000_000 ether;

    function setUp() public {
        token = new SindaToken(address(this));
    }

    function testFuzz_TransfersPreserveFixedSupply(address recipient, uint96 rawAmount) public {
        vm.assume(recipient != address(0));
        vm.assume(recipient != address(this));

        uint256 amount = bound(uint256(rawAmount), 0, FIXED_SUPPLY);
        token.transfer(recipient, amount);

        assertEq(token.totalSupply(), FIXED_SUPPLY);
        assertEq(token.balanceOf(address(this)) + token.balanceOf(recipient), FIXED_SUPPLY);
    }
}
