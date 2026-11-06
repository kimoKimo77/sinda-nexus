# SINDA Smart Contract Suite — Sepolia Preview

This branch adds a test-only hardening and deployment-preview layer. It does not deploy automatically. The selected test network is **Ethereum Sepolia (chain ID 11155111)**. No production deployment or mainnet transaction is authorized by this workflow.

## Contracts and configuration

| Component | Purpose | Key control |
|---|---|---|
| `SindaToken` | ERC-20 + Permit + Votes; 1,000,000,000 SINDA at 18 decimals | Entire supply minted once; no mint function |
| `SindaTimelock` | Delays approved governance operations | Governor proposer; open executor; self-admin after deployer handoff |
| `SindaGovernor` | Token-weighted proposals and voting | 1 block delay, 7,200 block period, 1 SINDA threshold, 4% quorum |
| `SindaTreasury` | Holds native assets and ERC-20 tokens | Two-step ownership; Timelock is initial owner |
| `SindaVestingWallet` | Linear vesting | Separate wallets must be created only after beneficiary/schedule review |

The deployment script sends the fixed token supply to the explicitly configured `SINDA_INITIAL_HOLDER`, not to the Treasury. This is deliberate: a Treasury contract that has no delegation mechanism must not silently hold all voting power. The initial holder must be a reviewed testnet wallet or governance-capable multisig and must explicitly delegate voting power before proposal tests.

## Sepolia deployment path

The script `script/DeploySindaSepolia.s.sol` is guarded by chain ID 11155111 and requires:
- `SINDA_SEPOLIA_PRIVATE_KEY` — deployment signer, stored only as a GitHub Actions secret.
- `SINDA_INITIAL_HOLDER` — explicit nonzero address receiving the fixed supply.
- `SEPOLIA_RPC_URL` — Sepolia RPC endpoint, stored only as a GitHub Actions secret.

It deploys Timelock, Treasury, Token and Governor; grants the Governor proposer role; opens execution for already queued operations; and revokes the deployer's temporary Timelock admin role while retaining Timelock self-administration. The deployment script does not create vesting wallets or fund the Treasury.

The workflow `.github/workflows/sinda-sepolia-deploy.yml` always runs checks on matching pushes/PRs. Deployment is a separate manual workflow-dispatch action requiring the boolean `deploy_to_sepolia=true`, successful checks, the GitHub environment `sinda-sepolia`, and the two secrets above plus the configured holder variable. Configure required reviewers on that GitHub environment before use. The script itself rejects every chain other than Sepolia.

## Checks

Install Foundry and pinned dependencies, then run:

```sh
forge install OpenZeppelin/openzeppelin-contracts@v5.2.0
forge install foundry-rs/forge-std@v1.9.6
forge fmt --check
forge build --sizes
forge test -vvv --fuzz-runs 512
```

Tests include unit tests, a fixed-supply fuzz property, Governor/Timelock role-graph assertions and the existing proposal/vote/queue/delay lifecycle. CI compiles the deployment script but does not broadcast during the checks job.

## Security limitations

- This is not a third-party audit or a deployment-readiness certification.
- Governance parameters, initial-holder custody/delegation, treasury policy, vesting allocations and recovery procedures require independent review.
- The deployer key is a testnet-only operational secret. Never use a mainnet key or fund it with real assets.
- The initial-holder address is not proof of a multisig; verify custody and delegation before deployment.
- The workflow must be protected with required environment reviewers and repository branch protections.
- No mainnet workflow, contract addresses, or live transactions are included.
