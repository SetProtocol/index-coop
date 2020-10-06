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

  await transferIndexTokenFromDeployer(
    treasuryMultisigAddress,
    treasuryImmediateOwnershipAmount,
    "Transferred immediately vested INDEX to Treasury Multisig"
  );

  await transferIndexTokenFromDeployer(
    merkleDistributorAddress,
    merkleDistributorAmount,
    "Transferred INDEX to Merkle Distributor"
  );

  await transferIndexTokenFromDeployer(
    stakingRewardsAddress,
    uniswapLPRewardAmount,
    "Transferred INDEX to Uniswap LP StakingRewards"
  );

  await transferIndexTokenFromDeployer(
    treasuryOneYearVestingAddress,
    treasuryOneYearOwnershipAmount,
    "Transferred INDEX to Treasury 1yr vesting contract"
  );

  await transferIndexTokenFromDeployer(
    treasuryTwoYearVestingAddress,
    treasuryTwoYearOwnershipAmount,
    "Transferred INDEX to Treasury 2yr vesting contract"
  );

  await transferIndexTokenFromDeployer(
    treasuryThreeYearVestingAddress,
    treasuryThreeYearOwnershipAmount,
    "Transferred INDEX to Treasury 3yr vesting contract"
  );

  await transferIndexTokenFromDeployer(
    setLabsOneYearVestingAddress,
    setLabsOneYearOwnershipAmount,
    "Transferred INDEX to Set Labs 3yr vesting contract"
  );

  await transferIndexTokenFromDeployer(
    setLabsTwoYearVestingAddress,
    setLabsTwoYearOwnershipAmount,
    "Transferred INDEX to Set Labs 3yr vesting contract"
  );

  await transferIndexTokenFromDeployer(
    setLabsThreeYearVestingAddress,
    setLabsThreeYearOwnershipAmount,
    "Transferred INDEX to Set Labs 3yr vesting contract"
  );

  await transferIndexTokenFromDeployer(
    dfpOneYearVestingAddress,
    dfpOneYearOwnershipAmount,
    "Transferred INDEX to DFP 1yr vesting contract"
  );

  await transferIndexTokenFromDeployer(
    dfpTwoYearVestingAddress,
    dfpTwoYearOwnershipAmount,
    "Transferred INDEX to DFP 2yr vesting contract"
  );

  await transferIndexTokenFromDeployer(
    dfpThreeYearVestingAddress,
    dfpThreeYearOwnershipAmount,
    "Transferred INDEX to DFP 3yr vesting contract"
  );

  async function transferIndexTokenFromDeployer(recipient: Address, quantity: BigNumber, comment: string): Promise<void> {
    const recipientBalance = await indexTokenInstance.balanceOf(recipient);
    if (recipientBalance.eq(0)) {
      const transferData = indexTokenInstance.interface.functions.transfer.encode([
        recipient,
        quantity
      ]);
      const transferToDFPHash: any = await rawTx({
        from: deployer,
        to: indexTokenInstance.address,
        data: transferData,
        log: true,
      });
      await writeTransactionToOutputs(transferToDFPHash.transactionHash, comment);    
  }
};
export default func;

