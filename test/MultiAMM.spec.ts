import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployUniswapV3 } from "../scripts/UniswapV3Scripts";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("MultiPairAMM", function () {
  let amm: Contract;
  let tokenA: Contract;
  let tokenB: Contract;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let accounts: any;

  const PRECISION = ethers.utils.parseEther("1"); // 1e18

  beforeEach(async function () {
    // Get signers
    [owner, user1, user2] = await ethers.getSigners();

    accounts = await ethers.getSigners();
    let signer: HardhatEthersSigner = accounts[0];

    // Deploy UniswapV3
    const uniswapV3 = await deployUniswapV3(signer, ethers.utils.parseUnits('1000000000', 18));
    
    // Deploy tokens
    const Token = await ethers.getContractFactory("Token");
    tokenA = await Token.deploy("Token A", "TA", 18, owner.address);
    tokenB = uniswapV3.WETH9;
    await tokenA.deployed();

    // Deploy AMM
    const MultiAMM = await ethers.getContractFactory("MultiAMM");
    amm = await MultiAMM.deploy(uniswapV3.WETH9.address);
    await amm.deployed();

    // Wrap ETH to WETH
    const ETH_Balance = await owner.getBalance();
    const tokenA_Balance = await tokenA.balanceOf(owner.address);
    console.log("ETH_Balance:", ethers.utils.formatUnits(ETH_Balance, 18));
    console.log("tokenA_Balance:", ethers.utils.formatUnits(tokenA_Balance, 18));
    let transaction = await tokenB.connect(owner).deposit({ value: ethers.utils.parseEther("600") });
    await transaction.wait();

    // Approve tokens (owner + user1)
    await tokenA.connect(owner).approve(amm.address, ethers.constants.MaxUint256);
    await tokenB.connect(owner).approve(amm.address, ethers.constants.MaxUint256);
    await tokenA.connect(user1).approve(amm.address, ethers.constants.MaxUint256);
    await tokenB.connect(user1).approve(amm.address, ethers.constants.MaxUint256);

    // Transfer some tokens to user1
    await tokenA.transfer(user1.address, ethers.utils.parseEther("100"));
    await tokenB.transfer(user1.address, ethers.utils.parseEther("10"));
  });

  describe("Liquidity", function () {
    it("Should add initial liquidity correctly", async function () {
      const amountA = ethers.utils.parseEther("10");
      const amountB = ethers.utils.parseEther("20");

      await amm.addLiquidity(tokenA.address, tokenB.address, amountA, amountB);

      const [balA, balB, K]: [BigNumber, BigNumber, BigNumber] = 
        await amm.getPoolBalances(tokenA.address, tokenB.address);

      expect(balA).to.equal(amountA);
      expect(balB).to.equal(amountB);
      expect(K).to.equal(amountA.mul(amountB));

      const [share, totalShares]: [BigNumber, BigNumber] = 
        await amm.getUserShare(tokenA.address, tokenB.address, owner.address);

      // Initial share = 100
      expect(share).to.equal(ethers.utils.parseEther("100"));
      expect(totalShares).to.equal(share);
    });

    it("Should add subsequent liquidity proportionally", async function () {
      // Initial liquidity
      await amm.addLiquidity(
        tokenA.address, 
        tokenB.address, 
        ethers.utils.parseUnits("10", 18),
        ethers.utils.parseUnits("20", 18)
      );

      // Add more liquidity with same ratio
      await amm.connect(user1).addLiquidity(
        tokenA.address,
        tokenB.address,
        ethers.utils.parseUnits("5", 18),
        ethers.utils.parseUnits("10", 18)
      );

      const [share, totalShares]: [BigNumber, BigNumber] = 
        await amm.getUserShare(tokenA.address, tokenB.address, user1.address);

      // Half of the initial shares
      expect(share).to.equal(ethers.utils.parseEther("50"));
    });

    it("Should remove liquidity correctly", async function () {
      // Add liquidity first
      await amm.addLiquidity(
        tokenA.address,
        tokenB.address,
        ethers.utils.parseUnits("1", 18),
        ethers.utils.parseUnits("2", 18)
      );

      const initialBalanceA = await tokenA.balanceOf(owner.address);
      const initialBalanceB = await tokenB.balanceOf(owner.address);

      // Remove half of liquidity
      await amm.removeLiquidity(
        tokenA.address,
        tokenB.address,
        ethers.utils.parseUnits("5", 18) // half of the shares
      );

      const finalBalanceA = await tokenA.balanceOf(owner.address);
      const finalBalanceB = await tokenB.balanceOf(owner.address);

      expect(finalBalanceA.sub(initialBalanceA)).to.equal(ethers.utils.parseEther("0.05"));
      expect(finalBalanceB.sub(initialBalanceB)).to.equal(ethers.utils.parseEther("0.1"));
    });
  });

  describe("Swapping", function () {
    beforeEach(async function () {
      // Add initial liquidity
      await amm.addLiquidity(
        tokenA.address,
        tokenB.address,
        ethers.utils.parseUnits("1", 18),
        ethers.utils.parseUnits("2", 18)
      );
    });

    it("Should swap TokenA for TokenB correctly", async function () {
      const amountIn = ethers.utils.parseUnits("1", 18);

      // Initial pool state
      const [balA1, balB1, K1] = await amm.getPoolBalances(tokenA.address, tokenB.address);
      console.log("Initial pool state:", {
        balA: ethers.utils.formatEther(balA1),
        balB: ethers.utils.formatEther(balB1),
        K: K1.toString()
      });

      // Check expected out
      const expectedOut = await amm.calculateTokenAtoTokenB(
        tokenA.address,
        tokenB.address,
        amountIn
      );
      console.log("Expected out:", ethers.utils.formatEther(expectedOut));

      const initialBalanceB = await tokenB.balanceOf(user1.address);

      // Perform swap
      await amm.connect(user1).swapExactTokenAforTokenB(
        tokenA.address,
        tokenB.address,
        amountIn
      );

      // Final pool state
      const [balA2, balB2, K2] = await amm.getPoolBalances(tokenA.address, tokenB.address);
      console.log("Final pool state:", {
        balA: ethers.utils.formatEther(balA2),
        balB: ethers.utils.formatEther(balB2),
        K: K2.toString()
      });

      const finalBalanceB = await tokenB.balanceOf(user1.address);
      const actualOut = finalBalanceB.sub(initialBalanceB);

      console.log("Actual out:", ethers.utils.formatEther(actualOut));
      expect(actualOut).to.equal(expectedOut);
    });

    it("Should swap TokenB for TokenA correctly", async function () {
    const amountIn = ethers.utils.parseUnits("2", 18);

      // Initial pool state
      const [balA1, balB1, K1] = await amm.getPoolBalances(tokenA.address, tokenB.address);
      console.log("Initial pool state:", {
        balA: ethers.utils.formatEther(balA1),
        balB: ethers.utils.formatEther(balB1),
        K: K1.toString()
      });

      // Check expected out
      const expectedOut = await amm.calculateTokenBtoTokenA(
        tokenA.address,
        tokenB.address,
        amountIn
      );
      console.log("Expected out:", ethers.utils.formatEther(expectedOut));

      const initialBalanceA = await tokenA.balanceOf(user1.address);

      // Perform swap
      await amm.connect(user1).swapExactTokenBforTokenA(
        tokenA.address,
        tokenB.address,
        amountIn
      );

      // Final pool state
      const [balA2, balB2, K2] = await amm.getPoolBalances(tokenA.address, tokenB.address);
      console.log("Final pool state:", {
        balA: ethers.utils.formatEther(balA2),
        balB: ethers.utils.formatEther(balB2),
        K: K2.toString()
      });

      const finalBalanceA = await tokenA.balanceOf(user1.address);
      const actualOut = finalBalanceA.sub(initialBalanceA);

      console.log("Actual out:", ethers.utils.formatEther(actualOut));
      expect(actualOut).to.equal(expectedOut);
    });
  });

  describe("Price Calculations", function () {
    it("Should calculate correct token prices", async function () {
      // Add liquidity with 1:2 ratio
      await amm.addLiquidity(
        tokenA.address,
        tokenB.address,
        ethers.utils.parseUnits("1", 18),  // 1 tokenA
        ethers.utils.parseUnits("2", 18)   // 2 tokenB
      );

      const [priceAinB, priceBinA] = await amm.getTokenPrice(tokenA.address, tokenB.address);

      // Price of A in terms of B = 2 * PRECISION
      expect(priceAinB).to.equal(ethers.utils.parseEther("2"));
      // Price of B in terms of A = 0.5 * PRECISION
      expect(priceBinA).to.equal(ethers.utils.parseEther("0.5"));
    });

    it("Should calculate correct deposit amounts", async function () {
      // Add initial liquidity
      await amm.addLiquidity(
        tokenA.address,
        tokenB.address,
        ethers.utils.parseUnits("1", 18),
        ethers.utils.parseUnits("2", 18)
      );

      const amountA = ethers.utils.parseUnits("1", 18);
      const requiredB = await amm.calculateTokenBDeposit(
        tokenA.address,
        tokenB.address,
        amountA
      );
      expect(requiredB).to.equal(ethers.utils.parseUnits("2", 18)); // 1:2 ratio

      const amountB = ethers.utils.parseUnits("2", 18);
      const requiredA = await amm.calculateTokenADeposit(
        tokenA.address,
        tokenB.address,
        amountB
      );
      expect(requiredA).to.equal(ethers.utils.parseUnits("1", 18)); // 1:2 ratio
    });
  });

  describe("Zero Price First Buys", function () {
    const INITIAL_TOKENS = ethers.utils.parseUnits("100000000", 18);
    let transaction: any;

    beforeEach(async function () {
      // Approve tokenA
      transaction = await tokenA.connect(owner).approve(amm.address, INITIAL_TOKENS);
      await transaction.wait();

      // Setup zero price pool
      transaction = await amm.addLiquidityAtZeroPriceForWETH(tokenA.address, INITIAL_TOKENS);
      await transaction.wait();

      // Give some tokenB to user1/user2 for testing
      transaction = await tokenB.transfer(user1.address, ethers.utils.parseEther("100"));
      console.log('Error here')
      await transaction.wait();
      transaction = await tokenB.transfer(user2.address, ethers.utils.parseEther("100"));
      await transaction.wait();

    });

    it("Should handle first buy with TokenB for TokenA correctly", async function () {
      // 1e11 wei => user wants 1 token if price is 1 token = 1e11 wei
      const buyAmountInWei = ethers.utils.parseUnits("1", 11);
      const expectedTokens = ethers.utils.parseEther("1"); // 1 token

      const balanceABefore = await tokenA.balanceOf(owner.address);
      const balanceBBefore = await tokenB.balanceOf(owner.address);

      const contractBalanceA = await tokenA.balanceOf(amm.address);
      const contractBalanceB = await tokenB.balanceOf(amm.address);
      console.log("contractBalanceA:", contractBalanceA);
      console.log("contractBalanceB:", contractBalanceB);
      const poolId = await amm._getPoolId(tokenA.address, tokenB.address);
      console.log("poolId:", poolId);
      const pool = await amm.pools(poolId);
      console.log("pool:", pool);
      const zeroPriceActive = pool.zeroPriceActive;
      console.log("zeroPriceActive:", zeroPriceActive);

      await amm.connect(owner).swapExactTokenBforTokenA(
        tokenA.address,
        tokenB.address,
        buyAmountInWei
      );

      const balanceAAfter = await tokenA.balanceOf(owner.address);
      const balanceBAfter = await tokenB.balanceOf(owner.address);

      // Check received tokens
      expect(balanceAAfter.sub(balanceABefore)).to.equal(expectedTokens);
      // Check spent tokenB
      expect(balanceBBefore.sub(balanceBAfter)).to.equal(buyAmountInWei);

      // Check pool state
      const [balA, balB, K] = await amm.getPoolBalances(tokenA.address, tokenB.address);
      console.log("balA:", balA);
      console.log("balB:", balB);
      console.log("K:", K);
      expect(balB).to.equal(buyAmountInWei);          // pool received the B
      expect(balA).to.equal(INITIAL_TOKENS.sub(expectedTokens)); // pool sent out tokens
      expect(K).to.equal(balA.mul(balB).div(PRECISION));
    });

    it("Should handle not enough tokens in pool for first buy", async function () {
      const buyAmountInWei = ethers.utils.parseUnits("1", "11"); // 1e11 wei
      // If we try to swap tokenA for tokenB in first buy, we didn't deposit any tokenB => "NO_POOL"

      await expect(
        amm.connect(owner).swapExactTokenAforTokenB(
          tokenA.address,
          tokenB.address,
          buyAmountInWei
        )
      ).to.be.revertedWith("NO_POOL");
    });

    it("Should transition to normal pricing after first buy in either direction", async function () {
      // Approve for user1/user2
      await tokenA.connect(owner).approve(amm.address, ethers.utils.parseUnits("1000000", 18));
      await tokenB.connect(owner).approve(amm.address, ethers.utils.parseUnits("1000000", 18));
      await tokenA.connect(user1).approve(amm.address, ethers.utils.parseUnits("1000000", 18));
      await tokenB.connect(user1).approve(amm.address, ethers.utils.parseUnits("1000000", 18));

      // First buy with TokenB
      console.log("Doing first buy with TokenB");
      const firstBuyAmount = ethers.utils.parseUnits("1", 13); // 1e13 wei
      await amm.connect(owner).swapExactTokenBforTokenA(
        tokenA.address,
        tokenB.address,
        firstBuyAmount
      );
      console.log("First buy complete");

      // Log pool state after first buy
      const [balA1, balB1, K1] = await amm.getPoolBalances(tokenA.address, tokenB.address);
      console.log("After first buy:", {
        balA: ethers.utils.formatEther(balA1),
        balB: balB1.toString(),
        K: K1.toString()
      });

      // Second buy uses normal x*y=k formula
      const secondBuyAmount = ethers.utils.parseUnits("1", 13); // 1e13 wei
      const balanceBeforeSecondBuy = await tokenA.balanceOf(owner.address);

      await amm.connect(owner).swapExactTokenBforTokenA(
        tokenA.address,
        tokenB.address,
        secondBuyAmount
      );
      console.log("Second buy complete");

      const balanceAfterSecondBuy = await tokenA.balanceOf(owner.address);
      const tokensReceived = balanceAfterSecondBuy.sub(balanceBeforeSecondBuy);
      console.log("Tokens received in second buy:", ethers.utils.formatEther(tokensReceived));

      // Check final pool state
      const [balA2, balB2, K2] = await amm.getPoolBalances(tokenA.address, tokenB.address);
      console.log("After second buy:", {
        balA: ethers.utils.formatEther(balA2),
        balB: balB2.toString(),
        K: K2.toString()
      });

      // Just an example check comparing second vs first buy
      // The user might expect fewer tokens the second time if the price rose,
      // or more tokens if your logic in the first buy was different.
      // Currently, the code does expect(actualOut) > firstBuyTokens, so adapt as needed
      const firstBuyTokens = ethers.utils.parseEther("1");
      expect(tokensReceived).to.be.gt(firstBuyTokens);
    });
  });
});
