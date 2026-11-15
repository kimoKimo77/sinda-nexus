# SINDA Token — Preview Specification

## Approved parameters

- Token name: `SINDA`
- Symbol: `SINDA`
- Standard: ERC-20
- Initial supply: `1,000,000,000` tokens
- Decimals: `18`
- Target network: Ethereum Mainnet (Chain ID `1`)

## Implementation

`contracts/SindaToken.sol` uses OpenZeppelin Contracts ERC20. The constructor mints the full fixed supply to the deploying address exactly once.

The contract intentionally has no owner role and no custom functions for minting, pausing, blacklisting, transfer fees, or upgrades. ERC-20 transfers and allowances remain available as defined by the standard implementation.

## Preview-only status

- No deployment has been performed.
- No transaction has been signed or broadcast.
- No wallet or private key is required for source review or local tests.
- Ethereum Mainnet is a target specification only; local tests must run on a local development chain.
- Do not merge or deploy until source review, dependency review, tests, and explicit final approval are complete.

## Important deployment consideration

The entire initial supply is assigned to `msg.sender` during deployment. Before any future deployment, independently verify the deployment wallet, custody plan, supply allocation, and recovery arrangements. This source code does not provide a mechanism to recover tokens sent to an incorrect address.
