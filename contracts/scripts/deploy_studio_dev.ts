import { readFileSync, writeFileSync } from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { createClient, createAccount } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

async function main() {
  const privateKey = process.env.BURNER_WALLET_PRIVATE_KEY?.trim();
  if (!privateKey)
    throw new Error("No BURNER_WALLET_PRIVATE_KEY found in .env");

  const formattedKey = (
    privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`
  ) as `0x${string}`;

  const account = createAccount(formattedKey);
  console.log("Deployer account:", account.address);

  // Request faucet first
  console.log("Requesting faucet funds on studio-dev...");
  try {
    const faucetRes = await fetch(
      "https://studio-dev.genlayer.com/api/faucet",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: account.address }),
      },
    );
    console.log("Faucet response status:", faucetRes.status);
  } catch (e) {
    console.log("Faucet request error:", e);
  }

  const client = createClient({
    chain: studioDevnet,
    account,
  });

  const filePath = path.resolve(__dirname, "../contracts/bedrock_core.py");
  const contractCode = readFileSync(filePath, "utf-8");

  console.log("Estimating fees for Studio Dev deployment...");
  const feeEstimate = await client.estimateTransactionFees();
  console.log("Estimated feeValue:", feeEstimate.feeValue.toString());

  const txHash = await client.deployContract({
    code: contractCode,
    args: [],
    fees: {
      distribution: feeEstimate.distribution,
      feeValue: feeEstimate.feeValue,
    },
  });

  console.log("\n=======================================================");
  console.log(">>> Deployment Submitted! <<<");
  console.log("Transaction Hash:", txHash);
  console.log(
    `Explorer Link: https://explorer-studio-dev.genlayer.com/tx/${txHash}`,
  );
  console.log("=======================================================");

  console.log("\nWaiting for receipt...");
  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    status: "ACCEPTED" as any,
    retries: 60,
    interval: 4000,
  });

  const tx = await client.getTransaction({ hash: txHash });
  const contractAddress =
    (tx as any).data?.contract_address ??
    (receipt as any).data?.contract_address ??
    (receipt as any).contractAddress;

  console.log("\n=======================================================");
  console.log(">>> BedrockCore Deployed to Studio Dev! <<<");
  console.log("Contract Address:", contractAddress);
  console.log(
    `Explorer: https://explorer-studio-dev.genlayer.com/address/${contractAddress}`,
  );
  console.log("=======================================================");

  const deployedPath = path.resolve(__dirname, "../deployed_bedrock.json");
  const deployedData = {
    contractName: "BedrockCore",
    contractAddress,
    transactionHash: txHash,
    network: "studio-devnet",
    chainId: studioDevnet.id,
    rpcUrl: "https://studio-dev.genlayer.com/api",
    explorerUrl: `https://explorer-studio-dev.genlayer.com/address/${contractAddress}`,
    deployedAt: new Date().toISOString(),
  };
  writeFileSync(deployedPath, JSON.stringify(deployedData, null, 2));
  console.log(`Saved deployment info to ${deployedPath}`);
}

main().catch((err) => {
  console.error("Studio Dev deployment failed:", err);
  process.exit(1);
});
