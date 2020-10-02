import "module-alias/register";
import { ethers } from "@nomiclabs/buidler";
import { BigNumber } from "ethers/utils";

import {
  BuidlerRuntimeEnvironment,
  DeployFunction,
} from "@nomiclabs/buidler/types";

import { ADDRESS_ZERO, ZERO_BYTES, ZERO, MAX_UINT_256 } from "@utils/constants";
import {
  ensureOutputsFile,
  findDependency,
  getContractAddress,
  getNetworkConstant,
  removeNetwork,
  writeContractAndTransactionToOutputs,
  writeTransactionToOutputs
} from "@utils/deploys/output-helper";
import { ether, parseBalanceMap } from "@utils/index";
import { IndexDaoFactory } from "../typechain/IndexDaoFactory";

import { Account, DistributionFormat } from "@utils/types";

const EMPTY_ARGS: any[] = [];

// MOCK DISTRIBUTION
const distributionArray: DistributionFormat[] = [
  {
    address: "0xe3a1340Be2B4c8dE9E20ab185CfF37480521D9Af",
    earnings: ether(100)
  },
  {
    address: "0x3329e5C37Ab27676df1e7077E5D75a82a6bFD0FC",
    earnings: ether(10)
  },
  {
    address: "0x5Dd5FC8761fe933bC58e5aB5Be062dd836DFA801",
    earnings: ether(1000)
  },
  {
    address: "0x44FFf6Ad56A66e718977e08A51510A143CB4cbF9",
    earnings: ether(2000)
  },
  {
    address: "0xEC0815AA9B462ed4fC84B5dFc43Fd2a10a54B569",
    earnings: ether(20)
  },
];

const merkleRootObject = parseBalanceMap(distributionArray); // Merkle root object
const uniswapLPRewardAmount = ether(900000); // 900k tokens; 9% supply
const merkleDistributorAmount = ether(100000); // 100k tokens; 1% supply
const daoOwnershipAmount = ether(6000000); // 6m tokens; 60% supply
const setLabsVestingAmount = ether(2850000); // 2.85m tokens; 28.5% supply
const dfpVestingAmount = ether(150000); // 150k tokens; 1.5% supply

// Vesting parameters
const vestingBegin = new BigNumber(1601665029); // TBD

const daoVestingCliff = new BigNumber(1601665030); // TBD
const daoVestingEnd = new BigNumber(1601665031); // TBD

const setLabsVestingCliff = new BigNumber(1601665030); // TBD
const setLabsVestingEnd = new BigNumber(1601665031); // TBD

const dfpVestingCliff = new BigNumber(1601665030); // TBD
const dfpVestingEnd = new BigNumber(1601665031); // TBD

const func: DeployFunction = async function (bre: BuidlerRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = bre;
  const { deploy, rawTx } = deployments;

  const [ownerWallet] = await ethers.signers();
  const { deployer } = await getNamedAccounts();
  // Configure development deployment
  const networkConstant = await getNetworkConstant();
  try {
    if (networkConstant === "development") {
      console.log(`\n*** Clearing all addresses for ${networkConstant} ***\n`);
      await removeNetwork(networkConstant);
    }
  } catch (error) {
    console.log('*** No addresses to wipe *** ');
  }

  await ensureOutputsFile();

  console.log(JSON.stringify(merkleRootObject.claims));

  // Retrieve dependencies
  let uniswapLPReward = await findDependency("DPI_ETH_UNI_POOL");
  if (uniswapLPReward === "") {
    uniswapLPReward = deployer;
  }

  let setLabsAddress;
  if (networkConstant === "production") {
    setLabsAddress = await findDependency("SET_LABS");
  } else {
    setLabsAddress = deployer;
  }

  let daoMultisigAddress;
  if (networkConstant === "production") {
    daoMultisigAddress = await findDependency("DAO_MULTI_SIG");
  } else {
    daoMultisigAddress = deployer;
  }

  let dfpMultisigAddress;
  if (networkConstant === "production") {
    dfpMultisigAddress = await findDependency("DFP_MULTI_SIG");
  } else {
    dfpMultisigAddress = deployer;
  }

  // Deploy INDEX token
  const checkIndexDAOAddress = await getContractAddress("IndexDAO");
  if (checkIndexDAOAddress === "") {
    const indexDAODeploy = await deploy(
      "IndexDAO",
      { from: deployer, args: [deployer], log: true }
    );
    await writeContractAndTransactionToOutputs("IndexDAO", indexDAODeploy.address, indexDAODeploy.receipt.transactionHash, "Deployed IndexDAO");
  }
  const indexDAOAddress = await getContractAddress("IndexDAO");

  // Deploy Merkle Distributor contract
  const checkMerkleDistributorAddress = await getContractAddress("MerkleDistributor");
  if (checkMerkleDistributorAddress === "") {
    const merkleDistributorDeploy = await deploy(
      "MerkleDistributor",
      { from: deployer, args: [indexDAOAddress, merkleRootObject.merkleRoot], log: true }
    );
    await writeContractAndTransactionToOutputs("MerkleDistributor", merkleDistributorDeploy.address, merkleDistributorDeploy.receipt.transactionHash, "Deployed MerkleDistributor");
  }
  const merkleDistributorAddress = await getContractAddress("MerkleDistributor");

  // Deploy Uniswap LP staking rewards contract
  const checkStakingRewardsAddress = await getContractAddress("StakingRewards");
  if (checkStakingRewardsAddress === "") {
    const stakingRewardsDeploy = await deploy(
      "StakingRewards",
      { from: deployer, args: [setLabsAddress, indexDAOAddress, uniswapLPReward], log: true }
    );
    await writeContractAndTransactionToOutputs("StakingRewards", stakingRewardsDeploy.address, stakingRewardsDeploy.receipt.transactionHash, "Deployed StakingRewards");
  }
  const stakingRewardsAddress = await getContractAddress("StakingRewards");
  
  // Deploy DAO treasury vesting contract
  const checkDAOVestingAddress = await getContractAddress("DAOVesting");
  if (checkDAOVestingAddress === "") {
    const daoVestingDeploy = await deploy(
      "Vesting",
      { from: deployer, args: [indexDAOAddress, daoMultisigAddress, daoOwnershipAmount, vestingBegin, daoVestingCliff, daoVestingEnd], log: true }
    );
    await writeContractAndTransactionToOutputs("DAOVesting", daoVestingDeploy.address, daoVestingDeploy.receipt.transactionHash, "Deployed DAO Vesting");
  }
  const daoVestingAddress = await getContractAddress("DAOVesting");

  // Deploy Set Labs vesting contract
  const checkSetLabsVestingAddress = await getContractAddress("SetLabsVesting");
  if (checkSetLabsVestingAddress === "") {
    const setLabsVestingDeploy = await deploy(
      "Vesting",
      { from: deployer, args: [indexDAOAddress, setLabsAddress, setLabsVestingAmount, vestingBegin, setLabsVestingCliff, setLabsVestingEnd], log: true }
    );
    await writeContractAndTransactionToOutputs("SetLabsVesting", setLabsVestingDeploy.address, setLabsVestingDeploy.receipt.transactionHash, "Deployed Set Labs Vesting");
  }
  const setLabsVestingAddress = await getContractAddress("SetLabsVesting");

  // Deploy DFP vesting contract
  const checkDFPVestingAddress = await getContractAddress("DFPVesting");
  if (checkDFPVestingAddress === "") {
    const dfpVestingDeploy = await deploy(
      "Vesting",
      { from: deployer, args: [indexDAOAddress, dfpMultisigAddress, dfpVestingAmount, vestingBegin, dfpVestingCliff, dfpVestingEnd], log: true }
    );
    await writeContractAndTransactionToOutputs("DFPVesting", dfpVestingDeploy.address, dfpVestingDeploy.receipt.transactionHash, "Deployed DFP Vesting");
  }
  const dfpVestingAddress = await getContractAddress("DFPVesting");

  // Transfer tokens to Merkle Distributor contract
  const indexDAOToken = await new IndexDaoFactory(ownerWallet).attach(indexDAOAddress);
  
  const merkleDistributorRewardsBalance = await indexDAOToken.balanceOf(merkleDistributorAddress);
  if (merkleDistributorRewardsBalance.eq(0)) {
    const transferToMerkleDistributorData = indexDAOToken.interface.functions.transfer.encode([
      merkleDistributorAddress,
      merkleDistributorAmount,
    ]);
    const transferToMerkleDistributorHash: any = await rawTx({
      from: deployer,
      to: indexDAOToken.address,
      data: transferToMerkleDistributorData,
      log: true,
    });
    await writeTransactionToOutputs(transferToMerkleDistributorHash.transactionHash, "Transferred INDEX to Merkle Distributor");
  }

  // Transfer tokens to Uniswap LP staking rewards contract
  const stakingRewardsBalance = await indexDAOToken.balanceOf(stakingRewardsAddress);
  if (stakingRewardsBalance.eq(0)) {
    const transferToStakingRewardData = indexDAOToken.interface.functions.transfer.encode([
      stakingRewardsAddress,
      uniswapLPRewardAmount
    ]);
    const transferToStakingRewardHash: any = await rawTx({
      from: deployer,
      to: indexDAOToken.address,
      data: transferToStakingRewardData,
      log: true,
    });
    await writeTransactionToOutputs(transferToStakingRewardHash.transactionHash, "Transferred INDEX to Uniswap LP StakingRewards");
  }

  // Transfer tokens to DAO vesting contract
  const daoOwnerBalance = await indexDAOToken.balanceOf(daoVestingAddress);
  if (daoOwnerBalance.eq(0)) {
    const transferToDAOOwnerData = indexDAOToken.interface.functions.transfer.encode([
      daoVestingAddress,
      daoOwnershipAmount
    ]);
    const transferToDAOOwnerHash: any = await rawTx({
      from: deployer,
      to: indexDAOToken.address,
      data: transferToDAOOwnerData,
      log: true,
    });
    await writeTransactionToOutputs(transferToDAOOwnerHash.transactionHash, "Transferred INDEX to DAO vesting contract");
  }

  // Transfer tokens to Set Labs vesting contract
  const setLabsBalance = await indexDAOToken.balanceOf(setLabsVestingAddress);
  if (setLabsBalance.eq(0)) {
    const transferToSetLabsData = indexDAOToken.interface.functions.transfer.encode([
      setLabsVestingAddress,
      setLabsVestingAmount
    ]);
    const transferToSetLabsHash: any = await rawTx({
      from: deployer,
      to: indexDAOToken.address,
      data: transferToSetLabsData,
      log: true,
    });
    await writeTransactionToOutputs(transferToSetLabsHash.transactionHash, "Transferred INDEX to Set Labs vesting contract");
  }

  // Transfer tokens to DFP vesting contract
  const dfpBalance = await indexDAOToken.balanceOf(dfpVestingAddress);
  if (dfpBalance.eq(0)) {
    const transferToDFPData = indexDAOToken.interface.functions.transfer.encode([
      dfpVestingAddress,
      dfpVestingAmount
    ]);
    const transferToDFPHash: any = await rawTx({
      from: deployer,
      to: indexDAOToken.address,
      data: transferToDFPData,
      log: true,
    });
    await writeTransactionToOutputs(transferToDFPHash.transactionHash, "Transferred INDEX to DFP vesting contract");
  }
};
export default func;

