import fs from "fs-extra";
import * as _ from "lodash";

require("dotenv").config({ path: "./.env"});

const privateKey: string | undefined = process.env.DEPLOYMENT_PRIVATE_KEY;

const deploymentConstants: string | undefined = process.env.DEPLOYMENT_CONSTANT;
const deploymentNetworkId: number = parseInt(process.env.DEPLOYMENT_NETWORK_ID as any);

const OUTPUTS_PATH = `./deployments/${getDeploymentNetworkKey()}.json`;

import dependencies from "./dependencies";

export async function ensureOutputsFile() {
  await fs.ensureFile(OUTPUTS_PATH);
}

export function getDeploymentNetworkKey(): string {
  return `${deploymentNetworkId}-${deploymentConstants}`;
}

export async function returnOutputs(): Promise<any> {
  return await fs.readJson(OUTPUTS_PATH, { throws: false }) || await returnEmptyNetworkValue();
}

export function getNetworkConstant(): string | undefined {
  return deploymentConstants;
}

export function getNetworkId(): number {
  return deploymentNetworkId;
}

export function getPrivateKey(): string | undefined {
  return privateKey;
}

export async function sortAddresses() {
  const outputs = await returnOutputs();
  const unorderedAddresses = outputs["addresses"];
  const orderedAddresses = {} as any;

  Object.keys(unorderedAddresses).sort().forEach(function(key) {
    orderedAddresses[key] = unorderedAddresses[key];
  });

  outputs["addresses"] = orderedAddresses;

  await fs.outputFile(OUTPUTS_PATH, JSON.stringify(outputs, undefined, 2));
}

export async function findDependency(name: string) {
  if (dependencies[name] && dependencies[name][getNetworkId()]) {
    const dependencyValue = dependencies[name][getNetworkId()];
    return dependencyValue;
  }

  return await getContractAddress(name);
}

export async function getContractAddress(name: string) {
  const outputs: any = await returnOutputs();

  return outputs["addresses"][name] || "";
}

export async function getContractCode(name: string, web3: any): Promise<string> {
  const contractAddress = await getContractAddress(name);
  return await web3.eth.getCode(contractAddress);
}

export async function writeContractAndTransactionToOutputs(name: string, value: string, transactionId: string, description: string) {
  const contractAddress = await getContractAddress(name);
  if (contractAddress === "") {
    const outputs: any = await returnOutputs();

    outputs["addresses"][name] = value;
    await fs.outputFile(OUTPUTS_PATH, JSON.stringify(outputs, undefined, 2));

    await writeTransactionToOutputs(transactionId, description);
  }
}

export async function writeTransactionToOutputs(transactionId: string, description: string) {
  const outputs: any = await returnOutputs();

  const lastTransactionNumber = getNextTransactionKey(outputs);
  const currentTimestamp = new Date().getTime();

  outputs["transactions"][lastTransactionNumber] = {
    id: transactionId,
    timestamp: currentTimestamp,
    description: description,
  };
  await fs.outputFile(OUTPUTS_PATH, JSON.stringify(outputs, undefined, 2));
}

export function getNextTransactionKey(outputs: any): number {
  const outputTransactions = Object.keys(outputs["transactions"]);
  const transactionKeys = _.map(outputTransactions, transactionKey => Number(transactionKey));

  if (!transactionKeys.length) {
    return 0;
  }

  return Math.max(...transactionKeys) + 1;
}

export async function removeNetwork(name: string) {
  const outputs: any = await returnOutputs();
  outputs[name] = undefined;
  await fs.outputFile(OUTPUTS_PATH, JSON.stringify(outputs, undefined, 2));
}

export async function writeStateToOutputs(parameter: string, value: any) {
  const outputs: any = await returnOutputs();

  outputs["state"][parameter] = value;
  await fs.outputFile(OUTPUTS_PATH, JSON.stringify(outputs, undefined, 2));
}

function returnEmptyNetworkValue(): any {
  const networkName = dependencies.HUMAN_FRIENDLY_NAMES[deploymentNetworkId];
  const humanFriendlyName = `${networkName}-${deploymentConstants}`;
  return {
    "state": {
      "network_key": getDeploymentNetworkKey(),
      "human_friendly_name": humanFriendlyName,
      "network_id": deploymentNetworkId,
    },
    "addresses": {},
    "transactions": {},
  };
}

export async function getLastDeploymentStage(): Promise<number> {
  try {
    const output = await returnOutputs();

    return output["state"]["last_deployment_stage"] || 0;
  } catch {
    return 0;
  }
}

export async function isCorrectNetworkId(): Promise<boolean> {
  try {
    const output = await returnOutputs();
    const existingId = output["network_id"];

    if (!existingId) {
      await writeStateToOutputs("network_id", deploymentNetworkId);
      return true;
    }

    return existingId == deploymentNetworkId;
  } catch {
    return true;
  }
}