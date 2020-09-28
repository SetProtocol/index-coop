import { Signer } from "ethers";

import DeployToken from "./deployToken";

export default class DeployHelper {
  public token: DeployToken;

  constructor(deployerSigner: Signer) {
    this.token = new DeployToken(deployerSigner);
  }
}