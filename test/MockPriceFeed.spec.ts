import { ethers } from "hardhat";
import { Contract } from "ethers";
import { expect } from "chai";

const tokens = (n: number) => ethers.utils.parseUnits(n.toString(), 18);

describe("MockPriceFeed", () => {
    
    let mockPriceFeed: Contract;
    beforeEach(async () => {
        const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
        mockPriceFeed = await MockPriceFeed.deploy(tokens(3400));
        await mockPriceFeed.deployed();
    });

    it("should have a price", async () => {
        const price = await mockPriceFeed.latestRoundData();
        expect(price.answer).to.equal(tokens(3400));
    });

    it("should deploy", async () => {
        expect(mockPriceFeed.address).not.to.equal(ethers.constants.AddressZero);
    });

    it("should set price", async () => {
        await mockPriceFeed.setPrice(tokens(2000));
        const price = await mockPriceFeed.latestRoundData();
        expect(price.answer).to.equal(tokens(2000));
    });
});
