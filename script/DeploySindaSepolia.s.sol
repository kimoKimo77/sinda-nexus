// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {SindaToken} from "../contracts/token/SindaToken.sol";
import {SindaTimelock} from "../contracts/governance/SindaTimelock.sol";
import {SindaGovernor} from "../contracts/governance/SindaGovernor.sol";
import {SindaTreasury} from "../contracts/treasury/SindaTreasury.sol";

/// @notice Explicitly guarded deployment for Ethereum Sepolia only.
contract DeploySindaSepolia is Script {
    uint256 internal constant SEPOLIA_CHAIN_ID = 11155111;
    uint256 internal constant TIMELOCK_DELAY = 2 days;
    uint48 internal constant VOTING_DELAY = 1;
    uint32 internal constant VOTING_PERIOD = 7200;
    uint256 internal constant PROPOSAL_THRESHOLD = 1 ether;
    uint256 internal constant QUORUM_PERCENT = 4;

    error UnsupportedChain(uint256 actualChainId);
    error InvalidDeployerKey();
    error InvalidInitialHolder();

    function run() external {
        if (block.chainid != SEPOLIA_CHAIN_ID) {
            revert UnsupportedChain(block.chainid);
        }

        uint256 deployerKey = vm.envUint("SINDA_SEPOLIA_PRIVATE_KEY");
        if (deployerKey == 0) revert InvalidDeployerKey();

        address deployer = vm.addr(deployerKey);
        address initialHolder = vm.envAddress("SINDA_INITIAL_HOLDER");
        if (initialHolder == address(0)) revert InvalidInitialHolder();

        vm.startBroadcast(deployerKey);

        address[] memory proposers = new address[](0);
        address[] memory executors = new address[](0);

        // The deployer is a temporary admin only; it is revoked after role setup.
        SindaTimelock timelock =
            new SindaTimelock(TIMELOCK_DELAY, proposers, executors, deployer);
        SindaTreasury treasury = new SindaTreasury(address(timelock));
        // Keep voting supply with the explicitly configured holder, not inside the treasury.
        SindaToken token = new SindaToken(initialHolder);
        SindaGovernor governor = new SindaGovernor(
            IVotes(address(token)),
            timelock,
            VOTING_DELAY,
            VOTING_PERIOD,
            PROPOSAL_THRESHOLD,
            QUORUM_PERCENT
        );

        timelock.grantRole(timelock.PROPOSER_ROLE(), address(governor));
        // Open execution is intentional: anyone may execute an already queued operation.
        timelock.grantRole(timelock.EXECUTOR_ROLE(), address(0));
        // Timelock retains its self-admin role; the deployer loses temporary admin access.
        timelock.revokeRole(timelock.DEFAULT_ADMIN_ROLE(), deployer);

        vm.stopBroadcast();

        console2.log("SINDA_SEPOLIA_CHAIN_ID", block.chainid);
        console2.log("SINDA_DEPLOYER", deployer);
        console2.log("SINDA_INITIAL_HOLDER", initialHolder);
        console2.log("SINDA_TIMELOCK", address(timelock));
        console2.log("SINDA_TREASURY", address(treasury));
        console2.log("SINDA_TOKEN", address(token));
        console2.log("SINDA_GOVERNOR", address(governor));
        console2.log("SINDA_TOKEN_SUPPLY", token.totalSupply());
        console2.log("SINDA_TIMELOCK_DELAY", TIMELOCK_DELAY);
    }
}
