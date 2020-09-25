import {
  ContractTransaction as ContractTransactionType,
  Wallet as WalletType
} from "ethers";

export type Account = {
  address: Address;
  wallet: Wallet;
};

export type Address = string;
export type Bytes = string;

export type ContractTransaction = ContractTransactionType;
export type Wallet = WalletType;