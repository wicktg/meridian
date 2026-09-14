import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

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

  const client = createClient({
    chain: testnetBradbury,
    account,
  });

  const filePath = path.resolve(__dirname, "../contracts/bedrock_core.py");
  const contractCode = readFileSync(filePath, "utf-8");

  console.log("Deploying BedrockCore contract to GenLayer Testnet Bradbury...");
  console.log("Contract code length:", contractCode.length, "bytes");

  const txHash = await client.deployContract({
    code: contractCode,
    args: [],
  });

  console.log("\n=======================================================");
  console.log(">>> BedrockCore Deployment Submitted! <<<");
  console.log("Transaction Hash:", txHash);
  console.log(
    `Explorer Link: https://explorer-bradbury.genlayer.com/tx/${txHash}`,
  );
  console.log("=======================================================");

  console.log(
    "\nWaiting for transaction acceptance/consensus on Bradbury Testnet...",
  );
  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    status: "ACCEPTED" as any,
    retries: 80,
    interval: 5000,
  });

  const contractAddress =
    (receipt as any).data?.contract_address ??
    (receipt as any).txDataDecoded?.contractAddress;

  console.log("\n=======================================================");
  console.log(">>> BedrockCore Deployed Successfully! <<<");
  console.log("Contract Address:", contractAddress);
  console.log("Transaction Hash:", txHash);
  console.log(
    `Contract Explorer Link: https://explorer-bradbury.genlayer.com/address/${contractAddress}`,
  );
  console.log("=======================================================");

  const deployRecord = {
    contractName: "BedrockCore",
    contractAddress,
    transactionHash: txHash,
    network: "testnet-bradbury",
    chainId: 4221,
    deployedAt: new Date().toISOString(),
  };

  writeFileSync(
    path.resolve(__dirname, "../deployed_bedrock.json"),
    JSON.stringify(deployRecord, null, 2),
    "utf-8",
  );
  console.log("Saved deployment details to deployed_bedrock.json");
}

main().catch((err) => {
  console.error("Bedrock deployment failed:", err);
  process.exit(1);
});
