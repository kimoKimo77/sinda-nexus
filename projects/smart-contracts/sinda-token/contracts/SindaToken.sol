// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title SindaToken
 * @notice Fixed-supply ERC-20 token. The entire supply is minted once at deployment.
 *         No owner, roles, mint function, pause function, or upgrade mechanism exists.
 */
contract SindaToken is ERC20 {
    uint256 public constant INITIAL_SUPPLY = 1_000_000_000 * 10 ** 18;

    constructor() ERC20("SINDA", "SINDA") {
        _mint(msg.sender, INITIAL_SUPPLY);
    }
}
