import { Signer } from "ethers";
import { BigNumber } from "ethers/utils";
import { Address } from "../types";
import { IndexDao, MerkleDistributor, Vesting } from "../contracts";

import { IndexDaoFactory } from "../../typechain/IndexDaoFactory";
import { MerkleDistributorFactory } from "../../typechain/MerkleDistributorFactory";
import { VestingFactory } from "../../typechain/VestingFactory";

export default class DeployToken {
  private _deployerSigner: Signer;

  constructor(deployerSigner: Signer) {
    this._deployerSigner = deployerSigner;
  }

  public async deployIndexDAO(initialAccount: Address): Promise<IndexDao> {
    return await new IndexDaoFactory(this._deployerSigner).deploy(initialAccount);
  }

  public async deployMerkleDistributor(token: Address, merkleRoot: string): Promise<MerkleDistributor> {
    return await new MerkleDistributorFactory(this._deployerSigner).deploy(token, merkleRoot);
  }

  public async deployVesting(
    token: Address,
    recipient: Address,
    vestingAmount: BigNumber,
    vestingBegin: BigNumber,
    vestingCliff: BigNumber,
    vestingEnd: BigNumber
  ): Promise<Vesting> {
    return await new VestingFactory(this._deployerSigner).deploy(
      token,
      recipient,
      vestingAmount,
      vestingBegin,
      vestingCliff,
      vestingEnd
    );
  }
}