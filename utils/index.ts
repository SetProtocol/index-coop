import { ethers } from "@nomiclabs/buidler";
import { Blockchain } from "./common";

const provider = ethers.provider;
export const getBlockchainUtils = () => new Blockchain(provider);

export {
  getAccounts,
  getEthBalance,
  getLastBlockTimestamp,
  getProvider,
  getTransactionTimestamp,
  getWaffleExpect,
  addSnapshotBeforeRestoreAfterEach,
  getRandomAccount,
  getRandomAddress,
  increaseTimeAsync,
  mineBlockAsync,
} from "./buidler";

export {
  ether,
  gWei
} from "./common";

export {
  BalanceTree,
  MerkleTree,
  parseBalanceMap,
} from "./merkleUtils";
