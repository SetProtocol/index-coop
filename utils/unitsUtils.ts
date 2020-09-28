import { ethers } from "ethers";
import { BigNumber } from "ethers/utils";

export const ether = (amount: number): BigNumber => {
  const weiString = ethers.utils.parseEther(amount.toString());
  return new BigNumber(weiString);
};