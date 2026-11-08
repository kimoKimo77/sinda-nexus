const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SindaToken", function () {
  async function deploy() {
    const [deployer, alice, bob] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("SindaToken");
    const token = await Token.deploy();
    await token.waitForDeployment();
    return { token, deployer, alice, bob };
  }

  it("sets the expected token metadata", async function () {
    const { token } = await deploy();
    expect(await token.name()).to.equal("SINDA");
    expect(await token.symbol()).to.equal("SINDA");
    expect(await token.decimals()).to.equal(18);
  });

  it("mints exactly 1,000,000,000 tokens once to the deployer", async function () {
    const { token, deployer } = await deploy();
    const expected = ethers.parseUnits("1000000000", 18);
    expect(await token.totalSupply()).to.equal(expected);
    expect(await token.balanceOf(deployer.address)).to.equal(expected);
    expect(await token.INITIAL_SUPPLY()).to.equal(expected);
  });

  it("exposes no public mint, ownership, or role-administration function", async function () {
    const { token } = await deploy();
    const functionNames = token.interface.fragments
      .filter((fragment) => fragment.type === "function")
      .map((fragment) => fragment.name);

    expect(functionNames).not.to.include("mint");
    expect(functionNames).not.to.include("owner");
    expect(functionNames).not.to.include("grantRole");
    expect(functionNames).not.to.include("revokeRole");
  });

  it("transfers tokens and updates balances without changing total supply", async function () {
    const { token, deployer, alice } = await deploy();
    const amount = ethers.parseUnits("125", 18);
    const supplyBefore = await token.totalSupply();

    await expect(token.transfer(alice.address, amount))
      .to.emit(token, "Transfer")
      .withArgs(deployer.address, alice.address, amount);

    expect(await token.balanceOf(alice.address)).to.equal(amount);
    expect(await token.balanceOf(deployer.address)).to.equal(
      ethers.parseUnits("999999875", 18)
    );
    expect(await token.totalSupply()).to.equal(supplyBefore);
  });

  it("supports allowance and transferFrom without changing total supply", async function () {
    const { token, deployer, alice, bob } = await deploy();
    const amount = ethers.parseUnits("50", 18);
    const supplyBefore = await token.totalSupply();

    await token.approve(alice.address, amount);
    expect(await token.allowance(deployer.address, alice.address)).to.equal(amount);
    await token.connect(alice).transferFrom(deployer.address, bob.address, amount);

    expect(await token.balanceOf(bob.address)).to.equal(amount);
    expect(await token.allowance(deployer.address, alice.address)).to.equal(0n);
    expect(await token.totalSupply()).to.equal(supplyBefore);
  });

  it("rejects transfers exceeding the sender balance", async function () {
    const { token, alice, bob } = await deploy();
    await expect(token.connect(alice).transfer(bob.address, 1n))
      .to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
  });

  it("rejects transferFrom without sufficient allowance", async function () {
    const { token, deployer, alice, bob } = await deploy();
    await expect(
      token.connect(alice).transferFrom(deployer.address, bob.address, 1n)
    ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
  });
});
