import { readFileSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createAccount, createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

const EXPLORER = "https://explorer-bradbury.genlayer.com/tx/";
const ACCEPTED = "ACCEPTED" as any;

// Dated, public incident descriptions. The dates make clear that the contract is
// classifying supplied evidence, rather than asserting a current protocol state.
const scenarios = [
  {
    name: "Normal — USDC reserve transparency",
    evidence:
      "Normal-market evidence: Circle's 31 May 2024 USDC reserve report stated USDC was backed 100% by highly liquid cash and U.S. Treasury assets, with no disclosed exploit, depeg, insolvency, liquidation cascade, or oracle failure.",
  },
  {
    name: "Risky — Euler Finance exploit",
    evidence:
      "Confirmed incident evidence: on 13 March 2023 Euler Finance disclosed a flash-loan attack that drained approximately $197 million from the lending protocol. This is an active confirmed exploit event with material protocol-loss and insolvency risk.",
  },
  {
    name: "Ambiguous — Curve Vyper turbulence",
    evidence:
      "Ambiguous stress evidence: on 30 July 2023 several Curve liquidity pools using vulnerable Vyper compiler versions were exploited. CRV experienced extreme volatility and liquidation concerns, while the broader protocol response and final loss exposure were still being assessed.",
  },
] as const;

const FIRST_SCENARIO_TX = process.env.BEDROCK_FIRST_SCENARIO_TX as
  | `0x${string}`
  | undefined;

function envPrivateKey(): `0x${string}` {
  const privateKey = process.env.BURNER_WALLET_PRIVATE_KEY?.trim();
  if (!privateKey) {
    throw new Error(
      "BURNER_WALLET_PRIVATE_KEY is required in the repository-root .env file.",
    );
  }
  return (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as `0x${string}`;
}

function contractAddressFromReceipt(receipt: any): string | undefined {
  return receipt.data?.contract_address ?? receipt.txDataDecoded?.contractAddress;
}

function printJson(value: unknown): string {
  return JSON.stringify(value, (_, item) =>
    typeof item === "bigint" ? item.toString() : item,
  );
}

async function waitForAcceptance(client: any, txHash: `0x${string}`) {
  return client.waitForTransactionReceipt({
    hash: txHash,
    status: ACCEPTED,
    retries: 90,
    interval: 5_000,
  });
}

async function main() {
  const account = createAccount(envPrivateKey());
  const client = createClient({ chain: testnetBradbury, account });
  const [chainId, balance] = await Promise.all([
    client.getChainId(),
    client.getBalance({ address: account.address }),
  ]);

  if (chainId !== testnetBradbury.id) {
    throw new Error(`Connected to unexpected chain ${chainId}; expected ${testnetBradbury.id}.`);
  }
  if (balance <= 0n) {
    throw new Error("Burner wallet has no GEN. Fund it from the Bradbury faucet before deployment.");
  }

  console.log(`Deployer: ${account.address}`);
  console.log(`Network: ${testnetBradbury.name} (${chainId})`);
  console.log(`Balance: ${Number(balance) / 1e18} GEN`);

  const priorDeployment = process.env.BEDROCK_DEPLOYMENT_TX as
    | `0x${string}`
    | undefined;
  let deploymentReceipt: any;

  if (priorDeployment) {
    console.log(`\nResuming deployment: ${priorDeployment}`);
    console.log(`Explorer: ${EXPLORER}${priorDeployment}`);
    deploymentReceipt = await waitForAcceptance(client, priorDeployment);
  } else {
    const code = readFileSync(
      path.resolve(process.cwd(), "contracts/bedrock_core.py"),
      "utf8",
    );
    const deploymentTx = await client.deployContract({ code, args: [] });
    console.log(`\nBedrock deployment: ${deploymentTx}`);
    console.log(`Explorer: ${EXPLORER}${deploymentTx}`);
    deploymentReceipt = await waitForAcceptance(client, deploymentTx);
  }

  const address = contractAddressFromReceipt(deploymentReceipt);
  if (!address) {
    throw new Error(`Deployment was accepted but returned no contract address: ${JSON.stringify(deploymentReceipt)}`);
  }
  console.log(`Bedrock address: ${address}`);

  for (const [index, scenario] of scenarios.entries()) {
    const resumedTx = index === 0 ? FIRST_SCENARIO_TX : undefined;
    const txHash = resumedTx ?? await client.writeContract({
      address: address as `0x${string}`,
      functionName: "assess_evidence",
      args: [scenario.evidence],
      value: 0n,
    });
    console.log(`\n${scenario.name}`);
    console.log(`Transaction: ${txHash}`);
    console.log(`Explorer: ${EXPLORER}${txHash}`);

    const receipt = await waitForAcceptance(client, txHash);
    const result = receipt.data?.return_value ?? receipt.data?.result ?? receipt;
    console.log(`Accepted result: ${printJson(result)}`);

    const state = await client.readContract({
      address: address as `0x${string}`,
      functionName: "get_state",
      args: [],
      jsonSafeReturn: true,
    });
    console.log(`On-chain state: ${printJson(state)}`);
  }
}

try {
  await main();
} catch (error) {
  console.error("Bedrock testnet run failed:", error);
  process.exitCode = 1;
}
