// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Asset vault. Set the owner to the SINDA timelock at deployment.
contract SindaTreasury is Ownable2Step {
    using SafeERC20 for IERC20;

    error ZeroRecipient();
    error NativeTransferFailed();

    event ERC20Withdrawn(address indexed token, address indexed recipient, uint256 amount);
    event NativeWithdrawn(address indexed recipient, uint256 amount);

    constructor(address initialOwner) Ownable(initialOwner) {}

    receive() external payable {}

    function withdrawERC20(IERC20 token, address recipient, uint256 amount) external onlyOwner {
        if (recipient == address(0)) revert ZeroRecipient();
        token.safeTransfer(recipient, amount);
        emit ERC20Withdrawn(address(token), recipient, amount);
    }

    function withdrawNative(address payable recipient, uint256 amount) external onlyOwner {
        if (recipient == address(0)) revert ZeroRecipient();
        (bool success,) = recipient.call{value: amount}("");
        if (!success) revert NativeTransferFailed();
        emit NativeWithdrawn(recipient, amount);
    }
}
