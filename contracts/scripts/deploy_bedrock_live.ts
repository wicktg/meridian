import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "../../.env");
if (!fs.existsSync(envPath)) {
  throw new Error(`Missing .env file at ${envPath}`);
}
dotenv.config({ path: envPath });

const privateKey = process.env.BURNER_WALLET_PRIVATE_KEY?.trim();
if (!privateKey) throw new Error("No BURNER_WALLET_PRIVATE_KEY in .env");
const formattedKey = (
  privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`
) as `0x${string}`;

async function main() {
  console.log(
    "===============================================================",
  );
  console.log("DEPLOYING UPDATED BEDROCK_CORE (6 LIVE DATA CATEGORIES)");
  console.log("Network: GenLayer Testnet Bradbury (Chain ID 4221)");
  console.log(
    "===============================================================\n",
  );

  const account = createAccount(formattedKey);
  const client = createClient({
    chain: testnetBradbury,
    account,
  });

  const contractPath = path.resolve(__dirname, "../contracts/bedrock_core.py");
  if (!fs.existsSync(contractPath)) {
    throw new Error(`Missing contract at ${contractPath}`);
  }
  const code = fs.readFileSync(contractPath, "utf-8");

  console.log(`Deployer Account: ${account.address}`);
  console.log(`Deploying ${contractPath}...`);

  const deployTxHash = await client.deployContract({ code, args: [] });
  console.log(`Deployment Transaction Hash: ${deployTxHash}`);
  console.log(
    `Explorer: https://explorer-bradbury.genlayer.com/tx/${deployTxHash}`,
  );
  console.log("Waiting for GenLayer consensus acceptance...");

  const receipt = await client.waitForTransactionReceipt({
    hash: deployTxHash,
    status: TransactionStatus.ACCEPTED,
    retries: 100,
    interval: 5000,
  });

  console.log("Receipt Status:", receipt.status);

  // Extract address
  const receiptData = await client.request({
    method: "gen_getTransactionReceipt",
    params: [{ txId: deployTxHash }],
  });

  const contractAddress =
    (receipt as any).data?.contract_address ??
    receiptData.recipient ??
    receiptData.contractAddress;

  if (!contractAddress) {
    throw new Error(
      `Failed to extract contract address from receipt: ${JSON.stringify(receiptData)}`,
    );
  }

  console.log(`\n>>> SUCCESS! New BedrockCore Deployed At: ${contractAddress}`);
  console.log(
    `>>> Contract Explorer: https://explorer-bradbury.genlayer.com/address/${contractAddress}`,
  );

  const deployData = {
    contractName: "BedrockCore",
    contractAddress,
    transactionHash: deployTxHash,
    network: "testnet-bradbury",
    chainId: 4221,
    deployedAt: new Date().toISOString(),
    categories: [
      "1. Spot Prices & LST Peg Parity (Mainnet Feeds)",
      "2. Oracle Heartbeat & Freshness (Mainnet Latency)",
      "3. System Collateralization Ratio (Base Sepolia Vault)",
      "4. Debt Ceiling & Vault Reserves (Base Sepolia Vault)",
      "5. Stablecoin Peg Deviation (DAI/USDC vs $1 Mainnet)",
      "6. Market Volatility (ETH 1h/24h Historical Rounds Mainnet)",
    ],
  };

  const deployedJsonPath = path.resolve(__dirname, "../deployed_bedrock.json");
  fs.writeFileSync(
    deployedJsonPath,
    JSON.stringify(deployData, null, 2),
    "utf-8",
  );
  console.log(`Saved deployment info to: ${deployedJsonPath}\n`);
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
