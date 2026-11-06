// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {SindaToken} from "../contracts/token/SindaToken.sol";
import {SindaTimelock} from "../contracts/governance/SindaTimelock.sol";
import {SindaGovernor} from "../contracts/governance/SindaGovernor.sol";

contract SindaGovernorTest is Test {
    SindaToken internal token;
    SindaTimelock internal timelock;
    SindaGovernor internal governor;
    uint256 internal executedValue;

    function setUp() public {
        token = new SindaToken(address(this));
        token.delegate(address(this));

        address[] memory proposers = new address[](0);
        address[] memory executors = new address[](1);
        executors[0] = address(0);
        timelock = new SindaTimelock(2 days, proposers, executors, address(this));
        governor = new SindaGovernor(IVotes(address(token)), timelock, 1, 10, 0, 4);

        timelock.grantRole(timelock.PROPOSER_ROLE(), address(governor));
        vm.roll(block.number + 1);
    }

    function testSuccessfulProposalExecutesOnlyAfterTimelock() public {
        address[] memory targets = new address[](1);
        targets[0] = address(this);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeCall(this.setExecutedValue, (42));
        string memory description = "Set a test value through the SINDA timelock";
        bytes32 descriptionHash = keccak256(bytes(description));

        uint256 proposalId = governor.propose(targets, values, calldatas, description);
        vm.roll(governor.proposalSnapshot(proposalId) + 1);
        governor.castVote(proposalId, 1);
        vm.roll(governor.proposalDeadline(proposalId) + 1);

        assertEq(uint256(governor.state(proposalId)), uint256(Governor.ProposalState.Succeeded));

        governor.queue(targets, values, calldatas, descriptionHash);
        assertEq(executedValue, 0);

        vm.warp(block.timestamp + 2 days + 1);
        governor.execute(targets, values, calldatas, descriptionHash);

        assertEq(executedValue, 42);
        assertEq(uint256(governor.state(proposalId)), uint256(Governor.ProposalState.Executed));
    }

    function setExecutedValue(uint256 value) external {
        require(msg.sender == address(timelock), "only timelock");
        executedValue = value;
    }
}
