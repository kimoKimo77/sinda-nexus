// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {VestingWallet} from "@openzeppelin/contracts/finance/VestingWallet.sol";

/// @notice Linear, time-based vesting wallet. Beneficiary and schedule are immutable.
contract SindaVestingWallet is VestingWallet {
    constructor(address beneficiary, uint64 startTimestamp, uint64 durationSeconds)
        VestingWallet(beneficiary, startTimestamp, durationSeconds)
    {}
}
