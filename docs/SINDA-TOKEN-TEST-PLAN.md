# SINDA Token Test Plan

The following checks are required before merge or deployment:

1. **Metadata:** name is `SINDA`, symbol is `SINDA`, decimals are `18`.
2. **Initial supply:** total supply equals `1,000,000,000 * 10^18`.
3. **Initial allocation:** the deployer receives the complete initial supply.
4. **Fixed supply:** no public or privileged mint function exists; total supply cannot increase after construction.
5. **ERC-20 behavior:** transfer, approve, and transferFrom follow OpenZeppelin ERC20 behavior.
6. **Zero address:** constructor minting and standard transfer validation reject invalid zero-address operations as defined by OpenZeppelin.
7. **Static review:** confirm no owner, proxy, upgrade, pause, blacklist, tax, or external-call surface was introduced.
8. **Build reproducibility:** install the pinned OpenZeppelin dependency using the repository's supported package manager and commit the lockfile.

## Execution status

Not run in this documentation-only change. The repository's current build tooling and dependency versions must be inspected before wiring automated tests. No test result is claimed.
