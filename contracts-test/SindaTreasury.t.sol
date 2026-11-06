// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {SindaTreasury} from "../contracts/treasury/SindaTreasury.sol";
import {SindaToken} from "../contracts/token/SindaToken.sol";

contract SindaTreasuryTest is Test {
    SindaTreasury internal treasury;
    SindaToken internal token;
    address internal admin = makeAddr("timelock");
    address internal recipient = makeAddr("recipient");
    address internal outsider = makeAddr("outsider");

    function setUp() public {
        treasury = new SindaTreasury(admin);
        token = new SindaToken(address(treasury));
    }

    function testOnlyOwnerCanWithdrawTokens() public {
        vm.prank(outsider);
        vm.expectRevert();
        treasury.withdrawERC20(token, recipient, 10 ether);

        vm.prank(admin);
        treasury.withdrawERC20(token, recipient, 10 ether);
        assertEq(token.balanceOf(recipient), 10 ether);
    }

    function testRejectsZeroRecipient() public {
        vm.prank(admin);
        vm.expectRevert(SindaTreasury.ZeroRecipient.selector);
        treasury.withdrawERC20(token, address(0), 1 ether);
    }

    function testOnlyOwnerCanWithdrawNativeAsset() public {
        vm.deal(address(treasury), 5 ether);

        vm.prank(outsider);
        vm.expectRevert();
        treasury.withdrawNative(payable(recipient), 1 ether);

        vm.prank(admin);
        treasury.withdrawNative(payable(recipient), 1 ether);
        assertEq(recipient.balance, 1 ether);
        assertEq(address(treasury).balance, 4 ether);
    }

    function testNativeWithdrawalRejectsZeroRecipient() public {
        vm.deal(address(treasury), 1 ether);
        vm.prank(admin);
        vm.expectRevert(SindaTreasury.ZeroRecipient.selector);
        treasury.withdrawNative(payable(address(0)), 1 ether);
    }

    function testOwnershipTransferRequiresAcceptance() public {
        address nextOwner = makeAddr("next-owner");
        vm.prank(admin);
        treasury.transferOwnership(nextOwner);
        assertEq(treasury.owner(), admin);
        vm.prank(nextOwner);
        treasury.acceptOwnership();
        assertEq(treasury.owner(), nextOwner);
    }
}
