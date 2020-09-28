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
import { ether } from "@utils/unitsUtils";
import { IndexDaoFactory } from "../typechain/IndexDaoFactory";

import { Account } from "@utils/types";

const EMPTY_ARGS: any[] = [];

const merkleRoot = ZERO_BYTES; // Merkle root TBD
const uniswapLPRewardAmount = ether(900000); // 900k tokens; 9% supply
const merkleDistributorAmount = ether(100000); // 100k tokens; 1% supply

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
      { from: deployer, args: [indexDAOAddress, merkleRoot], log: true }
    );
    await writeContractAndTransactionToOutputs("MerkleDistributor", merkleDistributorDeploy.address, merkleDistributorDeploy.receipt.transactionHash, "Deployed MerkleDistributor");
  }
  const merkleDistributorAddress = await getContractAddress("MerkleDistributor");

  // Deploy Uniswap LP staking rewards contract
  let uniswapLPReward = await findDependency("DPI_ETH_UNI_POOL");
  if (uniswapLPReward === "") {
    uniswapLPReward = deployer;
  }

  let rewardDistributor;
  if (networkConstant === "production") {
    rewardDistributor = await findDependency("MULTI_SIG_OWNER");
  } else {
    rewardDistributor = deployer;
  }
  const checkStakingRewardsAddress = await getContractAddress("StakingRewards");
  if (checkStakingRewardsAddress === "") {
    const stakingRewardsDeploy = await deploy(
      "StakingRewards",
      { from: deployer, args: [rewardDistributor, indexDAOAddress, uniswapLPReward], log: true }
    );
    await writeContractAndTransactionToOutputs("StakingRewards", stakingRewardsDeploy.address, stakingRewardsDeploy.receipt.transactionHash, "Deployed StakingRewards");
  }
  const stakingRewardsAddress = await getContractAddress("StakingRewards");
  
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

  // TODO transfer tokens to vesting contract / multisig
};
export default func;

