# SINDA fixed-supply ERC-20

Standalone Solidity project for the SINDA token.

## Confirmed design

- Name and symbol: `SINDA`
- ERC-20, OpenZeppelin Contracts
- Decimals: 18
- Fixed initial supply: `1,000,000,000 SINDA` (`1e27` base units)
- Entire supply is minted to the deployer in the constructor
- No `mint`, owner, access-control, pause, proxy, or upgrade functionality
- Hardhat local network only; no Mainnet/Sepolia deployment configuration

## Requirements

- Node.js 20 or newer
- npm

## Local setup and tests

```bash
npm ci
npm run compile
npm test
```

If no lockfile is present yet, run `npm install` once to create `package-lock.json`, then use `npm ci` for repeatable installs.

## Security boundaries

The contract does not provide a privileged mechanism to increase supply after construction. The deployer receives the full supply and can transfer or approve it under standard ERC-20 rules. Standard ERC-20 allowance risks still apply: users should approve only trusted spenders and appropriate amounts.

This project is not audited. Local tests are not a substitute for independent review. Do not add RPC URLs, private keys, deployment scripts, or production network configuration without a separate explicit review and approval.

## Deployment status

Not deployed. No transaction has been sent. The configured Hardhat chain is local-only (`31337`), not Ethereum Mainnet (`1`).
