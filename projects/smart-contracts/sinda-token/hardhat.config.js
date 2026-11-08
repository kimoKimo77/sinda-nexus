require("@nomicfoundation/hardhat-toolbox");

/** Local-only configuration. No network or private key is configured. */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 } }
  },
  networks: {
    hardhat: { chainId: 31337 }
  }
};
