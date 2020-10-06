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
import { IndexTokenFactory } from "../typechain/IndexTokenFactory";

import { Account, DistributionFormat } from "@utils/types";

const EMPTY_ARGS: any[] = [];

const distributionArray: DistributionFormat[] = MERKLE_DISTRIBUTION;

const merkleRootObject = parseBalanceMap(distributionArray); // Merkle root object
const uniswapLPRewardAmount = ether(900000); // 900k tokens; 9% supply
const merkleDistributorAmount = ether(100000); // 100k tokens; 1% supply

const treasuryImmediateOwnershipAmount = ether(1250000); // 1.25m tokens; 12.5% supply

// Treasury vesting amounts 47.5%
const treasuryOneYearOwnershipAmount = ether(2375000); // 2.375m tokens; 23.75% supply
const treasuryTwoYearOwnershipAmount = ether(1425000); // 1.425m tokens; 14.25% supply
const treasuryThreeYearOwnershipAmount = ether(950000); // 950k tokens; 9.5% supply

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

  let treasuryMultisigAddress;
  if (networkConstant === "production") {
    treasuryMultisigAddress = await findDependency("TREASURY_MULTI_SIG");
  } else {
    treasuryMultisigAddress = deployer;
  }

  let dfpMultisigAddress;
  if (networkConstant === "production") {
    dfpMultisigAddress = await findDependency("DFP_MULTI_SIG");
  } else {
    dfpMultisigAddress = deployer;
  }

  // Deploy INDEX token
  const checkIndexTokenAddress = await getContractAddress("IndexToken");
  if (checkIndexTokenAddress === "") {
    const indexTokenDeploy = await deploy(
      "IndexToken",
      { from: deployer, args: [deployer], log: true }
    );
    await writeContractAndTransactionToOutputs("IndexToken", indexTokenDeploy.address, indexTokenDeploy.receipt.transactionHash, "Deployed IndexToken");
  }
  const indexTokenAddress = await getContractAddress("IndexToken");

  // Deploy Merkle Distributor contract
  const checkMerkleDistributorAddress = await getContractAddress("MerkleDistributor");
  if (checkMerkleDistributorAddress === "") {
    const merkleDistributorDeploy = await deploy(
      "MerkleDistributor",
      { from: deployer, args: [indexTokenAddress, merkleRootObject.merkleRoot], log: true }
    );
    await writeContractAndTransactionToOutputs("MerkleDistributor", merkleDistributorDeploy.address, merkleDistributorDeploy.receipt.transactionHash, "Deployed MerkleDistributor");
  }
  const merkleDistributorAddress = await getContractAddress("MerkleDistributor");

  // Deploy Uniswap LP staking rewards contract
  const checkStakingRewardsAddress = await getContractAddress("StakingRewards");
  if (checkStakingRewardsAddress === "") {
    const stakingRewardsDeploy = await deploy(
      "StakingRewards",
      { from: deployer, args: [treasuryMultisigAddress, indexTokenAddress, uniswapLPReward], log: true }
    );
    await writeContractAndTransactionToOutputs("StakingRewards", stakingRewardsDeploy.address, stakingRewardsDeploy.receipt.transactionHash, "Deployed StakingRewards");
  }
  const stakingRewardsAddress = await getContractAddress("StakingRewards");
  
  // Deploy Treasury 1 year treasury vesting contract
  const checkOneYearTreasuryVestingAddress = await getContractAddress("OneYearTreasuryVesting");
  if (checkOneYearTreasuryVestingAddress === "") {
    const treasuryVestingDeploy = await deploy(
      "Vesting",
      { from: deployer, args: [indexTokenAddress, treasuryMultisigAddress, treasuryOneYearOwnershipAmount, vestingOneYearBegin, vestingOneYearCliff, vestingOneYearEnd], log: true }
    );
    await writeContractAndTransactionToOutputs("OneYearTreasuryVesting", treasuryVestingDeploy.address, treasuryVestingDeploy.receipt.transactionHash, "Deployed 1yr Treasury Vesting");
  }
  const treasuryOneYearVestingAddress = await getContractAddress("OneYearTreasuryVesting");

  // Deploy Treasury 2 year treasury vesting contract
  const checkTwoYearTreasuryVestingAddress = await getContractAddress("TwoYearTreasuryVesting");
  if (checkTwoYearTreasuryVestingAddress === "") {
    const treasuryVestingDeploy = await deploy(
      "Vesting",
      { from: deployer, args: [indexTokenAddress, treasuryMultisigAddress, treasuryTwoYearOwnershipAmount, vestingTwoYearBegin, vestingTwoYearCliff, vestingTwoYearEnd], log: true }
    );
    await writeContractAndTransactionToOutputs("TwoYearTreasuryVesting", treasuryVestingDeploy.address, treasuryVestingDeploy.receipt.transactionHash, "Deployed 2yr Treasury Vesting");
  }
  const treasuryTwoYearVestingAddress = await getContractAddress("TwoYearTreasuryVesting");

  // Deploy Treasury 3 year treasury vesting contract
  const checkThreeYearTreasuryVestingAddress = await getContractAddress("ThreeYearTreasuryVesting");
  if (checkThreeYearTreasuryVestingAddress === "") {
    const treasuryVestingDeploy = await deploy(
      "Vesting",
      { from: deployer, args: [indexTokenAddress, treasuryMultisigAddress, treasuryThreeYearOwnershipAmount, vestingThreeYearBegin, vestingThreeYearCliff, vestingThreeYearEnd], log: true }
    );
    await writeContractAndTransactionToOutputs("ThreeYearTreasuryVesting", treasuryVestingDeploy.address, treasuryVestingDeploy.receipt.transactionHash, "Deployed 3yr Treasury Vesting");
  }
  const treasuryThreeYearVestingAddress = await getContractAddress("ThreeYearTreasuryVesting");

  // Deploy Set Labs 1 year vesting contract
  const checkOneYearSetLabsVestingAddress = await getContractAddress("OneYearSetLabsVesting");
  if (checkOneYearSetLabsVestingAddress === "") {
    const setLabsVestingDeploy = await deploy(
      "Vesting",
      { from: deployer, args: [indexTokenAddress, setLabsAddress, setLabsOneYearOwnershipAmount, vestingOneYearBegin, vestingOneYearCliff, vestingOneYearEnd], log: true }
    );
    await writeContractAndTransactionToOutputs("OneYearSetLabsVesting", setLabsVestingDeploy.address, setLabsVestingDeploy.receipt.transactionHash, "Deployed 1yr Set Labs Vesting");
  }
  const setLabsOneYearVestingAddress = await getContractAddress("OneYearSetLabsVesting");

  // Deploy Set Labs 2 year vesting contract
  const checkTwoYearSetLabsVestingAddress = await getContractAddress("TwoYearSetLabsVesting");
  if (checkTwoYearSetLabsVestingAddress === "") {
    const setLabsVestingDeploy = await deploy(
      "Vesting",
      { from: deployer, args: [indexTokenAddress, setLabsAddress, setLabsTwoYearOwnershipAmount, vestingTwoYearBegin, vestingTwoYearCliff, vestingTwoYearEnd], log: true }
    );
    await writeContractAndTransactionToOutputs("TwoYearSetLabsVesting", setLabsVestingDeploy.address, setLabsVestingDeploy.receipt.transactionHash, "Deployed 1yr Set Labs Vesting");
  }
  const setLabsTwoYearVestingAddress = await getContractAddress("TwoYearSetLabsVesting");

  // Deploy Set Labs 3 year vesting contract
  const checkThreeYearSetLabsVestingAddress = await getContractAddress("ThreeYearSetLabsVesting");
  if (checkThreeYearSetLabsVestingAddress === "") {
    const setLabsVestingDeploy = await deploy(
      "Vesting",
      { from: deployer, args: [indexTokenAddress, setLabsAddress, setLabsThreeYearOwnershipAmount, vestingThreeYearBegin, vestingThreeYearCliff, vestingThreeYearEnd], log: true }
    );
    await writeContractAndTransactionToOutputs("ThreeYearSetLabsVesting", setLabsVestingDeploy.address, setLabsVestingDeploy.receipt.transactionHash, "Deployed 1yr Set Labs Vesting");
  }
  const setLabsThreeYearVestingAddress = await getContractAddress("ThreeYearSetLabsVesting");

  // Deploy DFP 1 year vesting contract
  const checkOneYearDFPVestingAddress = await getContractAddress("OneYearDFPVesting");
  if (checkOneYearDFPVestingAddress === "") {
    const dfpVestingDeploy = await deploy(
      "Vesting",
      { from: deployer, args: [indexTokenAddress, dfpMultisigAddress, dfpOneYearOwnershipAmount, vestingOneYearBegin, vestingOneYearCliff, vestingOneYearEnd], log: true }
    );
    await writeContractAndTransactionToOutputs("OneYearDFPVesting", dfpVestingDeploy.address, dfpVestingDeploy.receipt.transactionHash, "Deployed 1yr DFP Vesting");
  }
  const dfpOneYearVestingAddress = await getContractAddress("OneYearDFPVesting");

  // Deploy DFP 2 year vesting contract
  const checkTwoYearDFPVestingAddress = await getContractAddress("TwoYearDFPVesting");
  if (checkTwoYearDFPVestingAddress === "") {
    const dfpVestingDeploy = await deploy(
      "Vesting",
      { from: deployer, args: [indexTokenAddress, dfpMultisigAddress, dfpTwoYearOwnershipAmount, vestingTwoYearBegin, vestingTwoYearCliff, vestingTwoYearEnd], log: true }
    );
    await writeContractAndTransactionToOutputs("TwoYearDFPVesting", dfpVestingDeploy.address, dfpVestingDeploy.receipt.transactionHash, "Deployed 1yr DFP Vesting");
  }
  const dfpTwoYearVestingAddress = await getContractAddress("TwoYearDFPVesting");

  // Deploy DFP 3 year vesting contract
  const checkThreeYearDFPVestingAddress = await getContractAddress("ThreeYearDFPVesting");
  if (checkThreeYearDFPVestingAddress === "") {
    const dfpVestingDeploy = await deploy(
      "Vesting",
      { from: deployer, args: [indexTokenAddress, dfpMultisigAddress, dfpThreeYearOwnershipAmount, vestingThreeYearBegin, vestingThreeYearCliff, vestingThreeYearEnd], log: true }
    );
    await writeContractAndTransactionToOutputs("ThreeYearDFPVesting", dfpVestingDeploy.address, dfpVestingDeploy.receipt.transactionHash, "Deployed 1yr DFP Vesting");
  }
  const dfpThreeYearVestingAddress = await getContractAddress("ThreeYearDFPVesting");

  // Transfer INDEX tokens

  const indexTokenInstance = await new IndexTokenFactory(ownerWallet).attach(indexTokenAddress);

  // Transfer immediately vested tokens to treasury
  const treasuryMultisigBalance = await indexTokenInstance.balanceOf(treasuryMultisigAddress);
  if (treasuryMultisigBalance.eq(0)) {
    const transferToTreasuryMultisigData = indexTokenInstance.interface.functions.transfer.encode([
      treasuryMultisigAddress,
      treasuryImmediateOwnershipAmount
    ]);
    const transferToTreasuryMultisigHash: any = await rawTx({
      from: deployer,
      to: indexTokenInstance.address,
      data: transferToTreasuryMultisigData,
      log: true,
    });
    await writeTransactionToOutputs(transferToTreasuryMultisigHash.transactionHash, "Transferred immediately vested INDEX to Treasury Multisig");
  }

  // Transfer tokens to Merkle Distributor contract
  const merkleDistributorRewardsBalance = await indexTokenInstance.balanceOf(merkleDistributorAddress);
  if (merkleDistributorRewardsBalance.eq(0)) {
    const transferToMerkleDistributorData = indexTokenInstance.interface.functions.transfer.encode([
      merkleDistributorAddress,
      merkleDistributorAmount,
    ]);
    const transferToMerkleDistributorHash: any = await rawTx({
      from: deployer,
      to: indexTokenInstance.address,
      data: transferToMerkleDistributorData,
      log: true,
    });
    await writeTransactionToOutputs(transferToMerkleDistributorHash.transactionHash, "Transferred INDEX to Merkle Distributor");
  }

  // Transfer tokens to Uniswap LP staking rewards contract
  const stakingRewardsBalance = await indexTokenInstance.balanceOf(stakingRewardsAddress);
  if (stakingRewardsBalance.eq(0)) {
    const transferToStakingRewardData = indexTokenInstance.interface.functions.transfer.encode([
      stakingRewardsAddress,
      uniswapLPRewardAmount
    ]);
    const transferToStakingRewardHash: any = await rawTx({
      from: deployer,
      to: indexTokenInstance.address,
      data: transferToStakingRewardData,
      log: true,
    });
    await writeTransactionToOutputs(transferToStakingRewardHash.transactionHash, "Transferred INDEX to Uniswap LP StakingRewards");
  }

  // Transfer tokens to Treasury 1 year vesting contract
  const treasuryOneYearOwnerBalance = await indexTokenInstance.balanceOf(treasuryOneYearVestingAddress);
  if (treasuryOneYearOwnerBalance.eq(0)) {
    const transferToTreasuryOwnerData = indexTokenInstance.interface.functions.transfer.encode([
      treasuryOneYearVestingAddress,
      treasuryOneYearOwnershipAmount
    ]);
    const transferToTreasuryOwnerHash: any = await rawTx({
      from: deployer,
      to: indexTokenInstance.address,
      data: transferToTreasuryOwnerData,
      log: true,
    });
    await writeTransactionToOutputs(transferToTreasuryOwnerHash.transactionHash, "Transferred INDEX to Treasury 1yr vesting contract");
  }

  // Transfer tokens to Treasury 2 year vesting contract
  const treasuryTwoYearOwnerBalance = await indexTokenInstance.balanceOf(treasuryTwoYearVestingAddress);
  if (treasuryTwoYearOwnerBalance.eq(0)) {
    const transferToTreasuryOwnerData = indexTokenInstance.interface.functions.transfer.encode([
      treasuryTwoYearVestingAddress,
      treasuryTwoYearOwnershipAmount
    ]);
    const transferToTreasuryOwnerHash: any = await rawTx({
      from: deployer,
      to: indexTokenInstance.address,
      data: transferToTreasuryOwnerData,
      log: true,
    });
    await writeTransactionToOutputs(transferToTreasuryOwnerHash.transactionHash, "Transferred INDEX to Treasury 2yr vesting contract");
  }

  // Transfer tokens to Treasury 3 year vesting contract
  const treasuryThreeYearOwnerBalance = await indexTokenInstance.balanceOf(treasuryThreeYearVestingAddress);
  if (treasuryThreeYearOwnerBalance.eq(0)) {
    const transferToTreasuryOwnerData = indexTokenInstance.interface.functions.transfer.encode([
      treasuryThreeYearVestingAddress,
      treasuryThreeYearOwnershipAmount
    ]);
    const transferToTreasuryOwnerHash: any = await rawTx({
      from: deployer,
      to: indexTokenInstance.address,
      data: transferToTreasuryOwnerData,
      log: true,
    });
    await writeTransactionToOutputs(transferToTreasuryOwnerHash.transactionHash, "Transferred INDEX to Treasury 2yr vesting contract");
  }

  // Transfer tokens to Set Labs 1yr vesting contract
  const setLabsOneYearBalance = await indexTokenInstance.balanceOf(setLabsOneYearVestingAddress);
  if (setLabsOneYearBalance.eq(0)) {
    const transferToSetLabsData = indexTokenInstance.interface.functions.transfer.encode([
      setLabsOneYearVestingAddress,
      setLabsOneYearOwnershipAmount
    ]);
    const transferToSetLabsHash: any = await rawTx({
      from: deployer,
      to: indexTokenInstance.address,
      data: transferToSetLabsData,
      log: true,
    });
    await writeTransactionToOutputs(transferToSetLabsHash.transactionHash, "Transferred INDEX to Set Labs 1yr vesting contract");
  }

  // Transfer tokens to Set Labs 2yr vesting contract
  const setLabsTwoYearBalance = await indexTokenInstance.balanceOf(setLabsTwoYearVestingAddress);
  if (setLabsTwoYearBalance.eq(0)) {
    const transferToSetLabsData = indexTokenInstance.interface.functions.transfer.encode([
      setLabsTwoYearVestingAddress,
      setLabsTwoYearOwnershipAmount
    ]);
    const transferToSetLabsHash: any = await rawTx({
      from: deployer,
      to: indexTokenInstance.address,
      data: transferToSetLabsData,
      log: true,
    });
    await writeTransactionToOutputs(transferToSetLabsHash.transactionHash, "Transferred INDEX to Set Labs 2yr vesting contract");
  }

  // Transfer tokens to Set Labs 3yr vesting contract
  const setLabsThreeYearBalance = await indexTokenInstance.balanceOf(setLabsThreeYearVestingAddress);
  if (setLabsThreeYearBalance.eq(0)) {
    const transferToSetLabsData = indexTokenInstance.interface.functions.transfer.encode([
      setLabsThreeYearVestingAddress,
      setLabsThreeYearOwnershipAmount
    ]);
    const transferToSetLabsHash: any = await rawTx({
      from: deployer,
      to: indexTokenInstance.address,
      data: transferToSetLabsData,
      log: true,
    });
    await writeTransactionToOutputs(transferToSetLabsHash.transactionHash, "Transferred INDEX to Set Labs 3yr vesting contract");
  }

  // Transfer tokens to DFP 1yr vesting contract
  const dfpOneYearBalance = await indexTokenInstance.balanceOf(dfpOneYearVestingAddress);
  if (dfpOneYearBalance.eq(0)) {
    const transferToDFPData = indexTokenInstance.interface.functions.transfer.encode([
      dfpOneYearVestingAddress,
      dfpOneYearOwnershipAmount
    ]);
    const transferToDFPHash: any = await rawTx({
      from: deployer,
      to: indexTokenInstance.address,
      data: transferToDFPData,
      log: true,
    });
    await writeTransactionToOutputs(transferToDFPHash.transactionHash, "Transferred INDEX to DFP 1yr vesting contract");
  }

  // Transfer tokens to DFP 2yr vesting contract
  const dfpTwoYearBalance = await indexTokenInstance.balanceOf(dfpTwoYearVestingAddress);
  if (dfpTwoYearBalance.eq(0)) {
    const transferToDFPData = indexTokenInstance.interface.functions.transfer.encode([
      dfpTwoYearVestingAddress,
      dfpTwoYearOwnershipAmount
    ]);
    const transferToDFPHash: any = await rawTx({
      from: deployer,
      to: indexTokenInstance.address,
      data: transferToDFPData,
      log: true,
    });
    await writeTransactionToOutputs(transferToDFPHash.transactionHash, "Transferred INDEX to DFP 2yr vesting contract");
  }

  // Transfer tokens to DFP 3yr vesting contract
  const dfpThreeYearBalance = await indexTokenInstance.balanceOf(dfpThreeYearVestingAddress);
  if (dfpThreeYearBalance.eq(0)) {
    const transferToDFPData = indexTokenInstance.interface.functions.transfer.encode([
      dfpThreeYearVestingAddress,
      dfpThreeYearOwnershipAmount
    ]);
    const transferToDFPHash: any = await rawTx({
      from: deployer,
      to: indexTokenInstance.address,
      data: transferToDFPData,
      log: true,
    });
    await writeTransactionToOutputs(transferToDFPHash.transactionHash, "Transferred INDEX to DFP 3yr vesting contract");
  }
};
export default func;

