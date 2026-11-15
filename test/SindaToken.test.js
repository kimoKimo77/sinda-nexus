const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SindaToken", function () {
  const INITIAL_SUPPLY = 1_000_000_000n * 10n ** 18n;

  async function deployToken() {
    const [deployer, recipient, spender, other] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("SindaToken");
    const token = await Token.deploy();
    await token.waitForDeployment();
    return { token, deployer, recipient, spender, other };
  }

  it("sets the approved metadata and 18 decimals", async function () {
    const { token } = await deployToken();
    expect(await token.name()).to.equal("SINDA");
    expect(await token.symbol()).to.equal("SINDA");
    expect(await token.decimals()).to.equal(18n);
  });

  it("mints exactly one billion tokens to the deployer once", async function () {
    const { token, deployer } = await deployToken();
    expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY);
    expect(await token.balanceOf(deployer.address)).to.equal(INITIAL_SUPPLY);
  });

  it("transfers tokens and updates balances", async function () {
    const { token, deployer, recipient } = await deployToken();
    const amount = 125n * 10n ** 18n;
    await expect(token.transfer(recipient.address, amount))
      .to.emit(token, "Transfer").withArgs(deployer.address, recipient.address, amount);
    expect(await token.balanceOf(recipient.address)).to.equal(amount);
    expect(await token.balanceOf(deployer.address)).to.equal(INITIAL_SUPPLY - amount);
    expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY);
  });

  it("supports approve and transferFrom with allowance accounting", async function () {
    const { token, deployer, recipient, spender } = await deployToken();
    const amount = 50n * 10n ** 18n;
    await expect(token.approve(spender.address, amount))
      .to.emit(token, "Approval").withArgs(deployer.address, spender.address, amount);
    await expect(token.connect(spender).transferFrom(deployer.address, recipient.address, amount))
      .to.emit(token, "Transfer").withArgs(deployer.address, recipient.address, amount);
    expect(await token.allowance(deployer.address, spender.address)).to.equal(0n);
    expect(await token.balanceOf(recipient.address)).to.equal(amount);
    expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY);
  });

  it("rejects transfers exceeding the sender balance", async function () {
    const { token, recipient, other } = await deployToken();
    await expect(token.connect(recipient).transfer(other.address, 1n))
      .to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
  });

  it("exposes no privileged mint, burn, pause, or ownership entrypoints", async function () {
    const { token } = await deployToken();
    for (const signature of ["mint(address,uint256)", "burn(uint256)", "pause()", "unpause()", "owner()"]) {
      expect(() => token.interface.getFunction(signature)).to.throw();
    }
    expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY);
  });

  it("rejects transfers to the zero address", async function () {
    const { token } = await deployToken();
    await expect(token.transfer(ethers.ZeroAddress, 1n))
      .to.be.revertedWithCustomError(token, "ERC20InvalidReceiver");
  });
});
