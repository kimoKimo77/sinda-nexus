// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {SindaToken} from "../contracts/token/SindaToken.sol";

contract SindaTokenTest is Test {
    SindaToken internal token;
    address internal holder = makeAddr("holder");
    address internal voter = makeAddr("voter");

    function setUp() public {
        token = new SindaToken(holder);
    }

    function testMetadataAndFixedInitialSupply() public view {
        assertEq(token.name(), "SINDA");
        assertEq(token.symbol(), "SINDA");
        assertEq(token.decimals(), 18);
        assertEq(token.totalSupply(), 1_000_000_000 ether);
        assertEq(token.balanceOf(holder), 1_000_000_000 ether);
    }

    function testNoPublicMintEntryPoint() public {
        (bool success,) = address(token).call(
            abi.encodeWithSignature("mint(address,uint256)", voter, 1 ether)
        );
        assertFalse(success);
        assertEq(token.totalSupply(), 1_000_000_000 ether);
    }

    function testPermitNonceStartsAtZero() public view {
        assertEq(token.nonces(holder), 0);
    }

    function testVotesRequireDelegation() public {
        vm.prank(holder);
        token.delegate(holder);
        assertEq(token.getVotes(holder), 1_000_000_000 ether);
    }

    function testRejectsZeroInitialHolder() public {
        vm.expectRevert(SindaToken.ZeroInitialHolder.selector);
        new SindaToken(address(0));
    }
}
