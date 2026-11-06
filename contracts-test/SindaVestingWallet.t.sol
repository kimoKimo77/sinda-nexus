// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {SindaToken} from "../contracts/token/SindaToken.sol";
import {SindaVestingWallet} from "../contracts/distribution/SindaVestingWallet.sol";

contract SindaVestingWalletTest is Test {
    function testNothingVestsBeforeStart() public {
        address beneficiary = makeAddr("future-beneficiary");
        uint64 start = uint64(block.timestamp + 1 days);
        SindaVestingWallet vesting = new SindaVestingWallet(beneficiary, start, 100 days);
        SindaToken token = new SindaToken(address(this));
        token.transfer(address(vesting), 100 ether);

        assertEq(vesting.vestedAmount(address(token), start - 1), 0);
    }

    function testFullyVestedAtEndOfSchedule() public {
        address beneficiary = makeAddr("fully-vested-beneficiary");
        uint64 start = uint64(block.timestamp);
        uint64 duration = 30 days;
        SindaVestingWallet vesting = new SindaVestingWallet(beneficiary, start, duration);
        SindaToken token = new SindaToken(address(this));
        token.transfer(address(vesting), 100 ether);

        vm.warp(uint256(start) + duration);
        assertEq(vesting.vestedAmount(address(token), uint64(block.timestamp)), 100 ether);

        vm.prank(beneficiary);
        vesting.release(address(token));
        assertEq(token.balanceOf(beneficiary), 100 ether);
    }

    function testLinearVestingAndRelease() public {
        address beneficiary = makeAddr("beneficiary");
        uint64 start = uint64(block.timestamp);
        uint64 duration = 100 days;
        SindaVestingWallet vesting = new SindaVestingWallet(beneficiary, start, duration);
        SindaToken token = new SindaToken(address(this));
        token.transfer(address(vesting), 100 ether);

        vm.warp(uint256(start) + duration / 2);
        assertEq(vesting.vestedAmount(address(token), uint64(block.timestamp)), 50 ether);

        vm.prank(beneficiary);
        vesting.release(address(token));
        assertEq(token.balanceOf(beneficiary), 50 ether);
    }
}
