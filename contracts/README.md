# SINDA Smart Contract Suite — Preview

This branch contains a **test-only, not-deployed** first implementation of the SINDA smart-contract system. It is isolated from `main`. No contract address is assigned by this repository and no deployment or transaction has been performed.

## Components

| Component | Purpose | Key control |
|---|---|---|
| `SindaToken` | ERC-20 + Permit + Votes; 1,000,000,000 SINDA at 18 decimals | Entire supply minted once in constructor; no mint function |
| `SindaTimelock` | Delays approved governance operations | Proposer/executor roles |
| `SindaGovernor` | Token-weighted proposals and voting | Configurable delay, period, threshold and quorum |
| `SindaTreasury` | Holds native assets and ERC-20 tokens | Two-step ownership; set owner to Timelock |
| `SindaVestingWallet` | Linear token vesting | Immutable beneficiary and schedule |

OpenZeppelin Contracts is pinned to v5.2.0 in the CI dependency installation. Solidity compiler is pinned to 0.8.24.

## Important deployment architecture

This is code and test scaffolding only. Before any testnet deployment, review the parameters and deployment ordering:

1. Deploy `SindaTimelock` with a temporary admin and a temporary proposer controlled by the deployment operator; configure a nonzero delay.
2. Deploy `SindaTreasury` with the Timelock address as initial owner.
3. Deploy `SindaToken` with the Treasury address as initial holder. The fixed initial supply is then held by the Treasury.
4. Deploy `SindaGovernor` with the token and Timelock addresses, and explicitly review voting delay, voting period, proposal threshold and quorum.
5. Grant the Governor the Timelock proposer role; configure executor policy; revoke temporary deployer/admin privileges after independently verifying the role graph. Do not renounce or revoke the final recovery/admin path until governance has been tested and approved.
6. Create separate vesting wallets for each approved beneficiary and schedule. Verify all constructor values before funding them.
7. Verify source code and constructor arguments on the chosen testnet explorer. Record chain ID, deployer, transaction hashes and verified addresses in a reviewed deployment manifest. Never copy testnet addresses into production configuration.

The exact role handoff is security-sensitive. The steps above are a review checklist, not an executable deployment script.

## Test networks

The initial validation targets are:
- Ethereum Sepolia — chain ID 11155111
- BNB Smart Chain Testnet — chain ID 97
- Polygon Amoy — chain ID 80002

The Solidity contracts are chain-agnostic. No RPC keys, private keys, wallet secrets or deployed addresses belong in source control.

## Local checks

Install Foundry, then run:

```sh
forge install OpenZeppelin/openzeppelin-contracts@v5.2.0
forge install foundry-rs/forge-std@v1.9.6
forge fmt --check
forge build --sizes
forge test -vvv
```

CI performs formatting, compilation and unit tests. It does not run `forge script --broadcast`, publish contracts, or send transactions.

## Review limitations

- This is not an audit or certification.
- Governance parameters, role handoff, treasury policy, vesting schedules and token distribution require explicit review.
- No multisig integration is configured by default. The recommended production owner is a separately reviewed multisig/timelock arrangement, not an externally owned deployment key.
- The first test set covers token supply/delegation, treasury access control and linear vesting. Governor/timelock integration and adversarial fuzz/invariant tests remain required before any deployment.
- No production or testnet contract addresses are claimed by this branch.
