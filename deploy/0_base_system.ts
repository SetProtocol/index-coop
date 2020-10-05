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
import { MERKLE_DISTRIBUTION } from "@utils/deploys/merkleDistribution";
import { ether, parseBalanceMap } from "@utils/index";
import { IndexDaoFactory } from "../typechain/IndexDaoFactory";

import { Account, DistributionFormat } from "@utils/types";

const EMPTY_ARGS: any[] = [];

const distributionArray: DistributionFormat[] = MERKLE_DISTRIBUTION;

const merkleRootObject = parseBalanceMap(distributionArray); // Merkle root object
const uniswapLPRewardAmount = ether(900000); // 900k tokens; 9% supply
const merkleDistributorAmount = ether(100000); // 100k tokens; 1% supply

const daoImmediateOwnershipAmount = ether(1250000); // 1.25m tokens; 12.5% supply

// DAO vesting amounts 47.5%
const daoOneYearOwnershipAmount = ether(2375000); // 2.375m tokens; 23.75% supply
const daoTwoYearOwnershipAmount = ether(1425000); // 1.425m tokens; 14.25% supply
const daoThreeYearOwnershipAmount = ether(950000); // 950k tokens; 9.5% supply

// Set Labs vesting amounts 28%
const setLabsOneYearOwnershipAmount = ether(1400000); // 1.4m tokens; 14% supply
const setLabsTwoYearOwnershipAmount = ether(840000); // 840k tokens; 8.4% supply
const setLabsThreeYearOwnershipAmount = ether(560000); // 560k tokens; 5.6% supply

// DeFi Pulse vesting amounts 2%
const dfpOneYearOwnershipAmount = ether(100000); // 100k tokens; 1% supply
const dfpTwoYearOwnershipAmount = ether(60000); // 60k tokens; 0.6% supply
const dfpThreeYearOwnershipAmount = ether(40000); // 40k tokens; 0.4% supply

// Vesting parameters

// #1 1 year vesting
const vestingOneYearBegin = new BigNumber(1602010800); // 10/6/2020 Tuesday 12PM PST
const vestingOneYearCliff = new BigNumber(1602010800); // 10/6/2020 Tuesday 12PM PST
const vestingOneYearEnd = new BigNumber(1633546800); // 10/6/2021

// #2 2 year vesting
const vestingTwoYearBegin = new BigNumber(1633546800); // 10/6/2021
const vestingTwoYearCliff = new BigNumber(1633546800); // 10/6/2021
const vestingTwoYearEnd = new BigNumber(1665082800); // 10/6/2022

// #3 3 year vesting
const vestingThreeYearBegin = new BigNumber(1665082800); // 10/6/2022
const vestingThreeYearCliff = new BigNumber(1665082800); // 10/6/2022
const vestingThreeYearEnd = new BigNumber(1696618800); // 10/6/2023

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
      { from: deployer, args: [daoMultisigAddress, indexDAOAddress, uniswapLPReward], log: true }
    );
    await writeContractAndTransactionToOutputs("StakingRewards", stakingRewardsDeploy.address, stakingRewardsDeploy.receipt.transactionHash, "Deployed StakingRewards");
  }
  const stakingRewardsAddress = await getContractAddress("StakingRewards");
  
  // Deploy DAO 1 year treasury vesting contract
  const checkOneYearDAOVestingAddress = await getContractAddress("OneYearDAOVesting");
  if (checkOneYearDAOVestingAddress === "") {
    const daoVestingDeploy = await deploy(
      "Vesting",
      { from: deployer, args: [indexDAOAddress, daoMultisigAddress, daoOneYearOwnershipAmount, vestingOneYearBegin, vestingOneYearCliff, vestingOneYearEnd], log: true }
    );
    await writeContractAndTransactionToOutputs("OneYearDAOVesting", daoVestingDeploy.address, daoVestingDeploy.receipt.transactionHash, "Deployed 1yr DAO Vesting");
  }
  const daoOneYearVestingAddress = await getContractAddress("OneYearDAOVesting");

  // Deploy DAO 2 year treasury vesting contract
  const checkTwoYearDAOVestingAddress = await getContractAddress("TwoYearDAOVesting");
  if (checkTwoYearDAOVestingAddress === "") {
    const daoVestingDeploy = await deploy(
      "Vesting",
      { from: deployer, args: [indexDAOAddress, daoMultisigAddress, daoTwoYearOwnershipAmount, vestingTwoYearBegin, vestingTwoYearCliff, vestingTwoYearEnd], log: true }
    );
    await writeContractAndTransactionToOutputs("TwoYearDAOVesting", daoVestingDeploy.address, daoVestingDeploy.receipt.transactionHash, "Deployed 2yr DAO Vesting");
  }
  const daoTwoYearVestingAddress = await getContractAddress("TwoYearDAOVesting");

  // Deploy DAO 3 year treasury vesting contract
  const checkThreeYearDAOVestingAddress = await getContractAddress("ThreeYearDAOVesting");
  if (checkThreeYearDAOVestingAddress === "") {
    const daoVestingDeploy = await deploy(
      "Vesting",
      { from: deployer, args: [indexDAOAddress, daoMultisigAddress, daoThreeYearOwnershipAmount, vestingThreeYearBegin, vestingThreeYearCliff, vestingThreeYearEnd], log: true }
    );
    await writeContractAndTransactionToOutputs("ThreeYearDAOVesting", daoVestingDeploy.address, daoVestingDeploy.receipt.transactionHash, "Deployed 3yr DAO Vesting");
  }
  const daoThreeYearVestingAddress = await getContractAddress("ThreeYearDAOVesting");

  // Deploy Set Labs 1 year vesting contract
  const checkOneYearSetLabsVestingAddress = await getContractAddress("OneYearSetLabsVesting");
  if (checkOneYearSetLabsVestingAddress === "") {
    const setLabsVestingDeploy = await deploy(
      "Vesting",
      { from: deployer, args: [indexDAOAddress, setLabsAddress, setLabsOneYearOwnershipAmount, vestingOneYearBegin, vestingOneYearCliff, vestingOneYearEnd], log: true }
    );
    await writeContractAndTransactionToOutputs("OneYearSetLabsVesting", setLabsVestingDeploy.address, setLabsVestingDeploy.receipt.transactionHash, "Deployed 1yr Set Labs Vesting");
  }
  const setLabsOneYearVestingAddress = await getContractAddress("OneYearSetLabsVesting");

  // Deploy Set Labs 2 year vesting contract
  const checkTwoYearSetLabsVestingAddress = await getContractAddress("TwoYearSetLabsVesting");
  if (checkTwoYearSetLabsVestingAddress === "") {
    const setLabsVestingDeploy = await deploy(
      "Vesting",
      { from: deployer, args: [indexDAOAddress, setLabsAddress, setLabsTwoYearOwnershipAmount, vestingTwoYearBegin, vestingTwoYearCliff, vestingTwoYearEnd], log: true }
    );
    await writeContractAndTransactionToOutputs("TwoYearSetLabsVesting", setLabsVestingDeploy.address, setLabsVestingDeploy.receipt.transactionHash, "Deployed 1yr Set Labs Vesting");
  }
  const setLabsTwoYearVestingAddress = await getContractAddress("TwoYearSetLabsVesting");

  // Deploy Set Labs 3 year vesting contract
  const checkThreeYearSetLabsVestingAddress = await getContractAddress("ThreeYearSetLabsVesting");
  if (checkThreeYearSetLabsVestingAddress === "") {
    const setLabsVestingDeploy = await deploy(
      "Vesting",
      { from: deployer, args: [indexDAOAddress, setLabsAddress, setLabsThreeYearOwnershipAmount, vestingThreeYearBegin, vestingThreeYearCliff, vestingThreeYearEnd], log: true }
    );
    await writeContractAndTransactionToOutputs("ThreeYearSetLabsVesting", setLabsVestingDeploy.address, setLabsVestingDeploy.receipt.transactionHash, "Deployed 1yr Set Labs Vesting");
  }
  const setLabsThreeYearVestingAddress = await getContractAddress("ThreeYearSetLabsVesting");

  // Deploy DFP 1 year vesting contract
  const checkOneYearDFPVestingAddress = await getContractAddress("OneYearDFPVesting");
  if (checkOneYearDFPVestingAddress === "") {
    const dfpVestingDeploy = await deploy(
      "Vesting",
      { from: deployer, args: [indexDAOAddress, dfpMultisigAddress, dfpOneYearOwnershipAmount, vestingOneYearBegin, vestingOneYearCliff, vestingOneYearEnd], log: true }
    );
    await writeContractAndTransactionToOutputs("OneYearDFPVesting", dfpVestingDeploy.address, dfpVestingDeploy.receipt.transactionHash, "Deployed 1yr DFP Vesting");
  }
  const dfpOneYearVestingAddress = await getContractAddress("OneYearDFPVesting");

  // Deploy DFP 2 year vesting contract
  const checkTwoYearDFPVestingAddress = await getContractAddress("TwoYearDFPVesting");
  if (checkTwoYearDFPVestingAddress === "") {
    const dfpVestingDeploy = await deploy(
      "Vesting",
      { from: deployer, args: [indexDAOAddress, dfpMultisigAddress, dfpTwoYearOwnershipAmount, vestingTwoYearBegin, vestingTwoYearCliff, vestingTwoYearEnd], log: true }
    );
    await writeContractAndTransactionToOutputs("TwoYearDFPVesting", dfpVestingDeploy.address, dfpVestingDeploy.receipt.transactionHash, "Deployed 1yr DFP Vesting");
  }
  const dfpTwoYearVestingAddress = await getContractAddress("TwoYearDFPVesting");

  // Deploy DFP 3 year vesting contract
  const checkThreeYearDFPVestingAddress = await getContractAddress("ThreeYearDFPVesting");
  if (checkThreeYearDFPVestingAddress === "") {
    const dfpVestingDeploy = await deploy(
      "Vesting",
      { from: deployer, args: [indexDAOAddress, dfpMultisigAddress, dfpThreeYearOwnershipAmount, vestingThreeYearBegin, vestingThreeYearCliff, vestingThreeYearEnd], log: true }
    );
    await writeContractAndTransactionToOutputs("ThreeYearDFPVesting", dfpVestingDeploy.address, dfpVestingDeploy.receipt.transactionHash, "Deployed 1yr DFP Vesting");
  }
  const dfpThreeYearVestingAddress = await getContractAddress("ThreeYearDFPVesting");

  // Transfer INDEX tokens

  const indexDAOToken = await new IndexDaoFactory(ownerWallet).attach(indexDAOAddress);

  // Transfer immediately vested tokens to DAO treasury
  const daoMultisigBalance = await indexDAOToken.balanceOf(daoMultisigAddress);
  if (daoMultisigBalance.eq(0)) {
    const transferToDAOMultisigData = indexDAOToken.interface.functions.transfer.encode([
      daoMultisigAddress,
      daoImmediateOwnershipAmount
    ]);
    const transferToDAOMultisigHash: any = await rawTx({
      from: deployer,
      to: indexDAOToken.address,
      data: transferToDAOMultisigData,
      log: true,
    });
    await writeTransactionToOutputs(transferToDAOMultisigHash.transactionHash, "Transferred immediately vested INDEX to DAO Multisig");
  }

  // Transfer tokens to Merkle Distributor contract
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

  // Transfer tokens to DAO 1 year vesting contract
  const daoOneYearOwnerBalance = await indexDAOToken.balanceOf(daoOneYearVestingAddress);
  if (daoOneYearOwnerBalance.eq(0)) {
    const transferToDAOOwnerData = indexDAOToken.interface.functions.transfer.encode([
      daoOneYearVestingAddress,
      daoOneYearOwnershipAmount
    ]);
    const transferToDAOOwnerHash: any = await rawTx({
      from: deployer,
      to: indexDAOToken.address,
      data: transferToDAOOwnerData,
      log: true,
    });
    await writeTransactionToOutputs(transferToDAOOwnerHash.transactionHash, "Transferred INDEX to DAO 1yr vesting contract");
  }

  // Transfer tokens to DAO 2 year vesting contract
  const daoTwoYearOwnerBalance = await indexDAOToken.balanceOf(daoTwoYearVestingAddress);
  if (daoTwoYearOwnerBalance.eq(0)) {
    const transferToDAOOwnerData = indexDAOToken.interface.functions.transfer.encode([
      daoTwoYearVestingAddress,
      daoTwoYearOwnershipAmount
    ]);
    const transferToDAOOwnerHash: any = await rawTx({
      from: deployer,
      to: indexDAOToken.address,
      data: transferToDAOOwnerData,
      log: true,
    });
    await writeTransactionToOutputs(transferToDAOOwnerHash.transactionHash, "Transferred INDEX to DAO 2yr vesting contract");
  }

  // Transfer tokens to DAO 3 year vesting contract
  const daoThreeYearOwnerBalance = await indexDAOToken.balanceOf(daoThreeYearVestingAddress);
  if (daoThreeYearOwnerBalance.eq(0)) {
    const transferToDAOOwnerData = indexDAOToken.interface.functions.transfer.encode([
      daoThreeYearVestingAddress,
      daoThreeYearOwnershipAmount
    ]);
    const transferToDAOOwnerHash: any = await rawTx({
      from: deployer,
      to: indexDAOToken.address,
      data: transferToDAOOwnerData,
      log: true,
    });
    await writeTransactionToOutputs(transferToDAOOwnerHash.transactionHash, "Transferred INDEX to DAO 2yr vesting contract");
  }

  // Transfer tokens to Set Labs 1yr vesting contract
  const setLabsOneYearBalance = await indexDAOToken.balanceOf(setLabsOneYearVestingAddress);
  if (setLabsOneYearBalance.eq(0)) {
    const transferToSetLabsData = indexDAOToken.interface.functions.transfer.encode([
      setLabsOneYearVestingAddress,
      setLabsOneYearOwnershipAmount
    ]);
    const transferToSetLabsHash: any = await rawTx({
      from: deployer,
      to: indexDAOToken.address,
      data: transferToSetLabsData,
      log: true,
    });
    await writeTransactionToOutputs(transferToSetLabsHash.transactionHash, "Transferred INDEX to Set Labs 1yr vesting contract");
  }

  // Transfer tokens to Set Labs 2yr vesting contract
  const setLabsTwoYearBalance = await indexDAOToken.balanceOf(setLabsTwoYearVestingAddress);
  if (setLabsTwoYearBalance.eq(0)) {
    const transferToSetLabsData = indexDAOToken.interface.functions.transfer.encode([
      setLabsTwoYearVestingAddress,
      setLabsTwoYearOwnershipAmount
    ]);
    const transferToSetLabsHash: any = await rawTx({
      from: deployer,
      to: indexDAOToken.address,
      data: transferToSetLabsData,
      log: true,
    });
    await writeTransactionToOutputs(transferToSetLabsHash.transactionHash, "Transferred INDEX to Set Labs 2yr vesting contract");
  }

  // Transfer tokens to Set Labs 3yr vesting contract
  const setLabsThreeYearBalance = await indexDAOToken.balanceOf(setLabsThreeYearVestingAddress);
  if (setLabsThreeYearBalance.eq(0)) {
    const transferToSetLabsData = indexDAOToken.interface.functions.transfer.encode([
      setLabsThreeYearVestingAddress,
      setLabsThreeYearOwnershipAmount
    ]);
    const transferToSetLabsHash: any = await rawTx({
      from: deployer,
      to: indexDAOToken.address,
      data: transferToSetLabsData,
      log: true,
    });
    await writeTransactionToOutputs(transferToSetLabsHash.transactionHash, "Transferred INDEX to Set Labs 3yr vesting contract");
  }

  // Transfer tokens to DFP 1yr vesting contract
  const dfpOneYearBalance = await indexDAOToken.balanceOf(dfpOneYearVestingAddress);
  if (dfpOneYearBalance.eq(0)) {
    const transferToDFPData = indexDAOToken.interface.functions.transfer.encode([
      dfpOneYearVestingAddress,
      dfpOneYearOwnershipAmount
    ]);
    const transferToDFPHash: any = await rawTx({
      from: deployer,
      to: indexDAOToken.address,
      data: transferToDFPData,
      log: true,
    });
    await writeTransactionToOutputs(transferToDFPHash.transactionHash, "Transferred INDEX to DFP 1yr vesting contract");
  }

  // Transfer tokens to DFP 2yr vesting contract
  const dfpTwoYearBalance = await indexDAOToken.balanceOf(dfpTwoYearVestingAddress);
  if (dfpTwoYearBalance.eq(0)) {
    const transferToDFPData = indexDAOToken.interface.functions.transfer.encode([
      dfpTwoYearVestingAddress,
      dfpTwoYearOwnershipAmount
    ]);
    const transferToDFPHash: any = await rawTx({
      from: deployer,
      to: indexDAOToken.address,
      data: transferToDFPData,
      log: true,
    });
    await writeTransactionToOutputs(transferToDFPHash.transactionHash, "Transferred INDEX to DFP 2yr vesting contract");
  }

  // Transfer tokens to DFP 3yr vesting contract
  const dfpThreeYearBalance = await indexDAOToken.balanceOf(dfpThreeYearVestingAddress);
  if (dfpThreeYearBalance.eq(0)) {
    const transferToDFPData = indexDAOToken.interface.functions.transfer.encode([
      dfpThreeYearVestingAddress,
      dfpThreeYearOwnershipAmount
    ]);
    const transferToDFPHash: any = await rawTx({
      from: deployer,
      to: indexDAOToken.address,
      data: transferToDFPData,
      log: true,
    });
    await writeTransactionToOutputs(transferToDFPHash.transactionHash, "Transferred INDEX to DFP 3yr vesting contract");
  }
};
export default func;

