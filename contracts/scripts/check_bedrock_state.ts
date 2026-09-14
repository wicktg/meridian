import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "../../.env");
if (!fs.existsSync(envPath)) throw new Error(`Missing .env at: ${envPath}`);
dotenv.config({ path: envPath });

const privateKey = process.env.BURNER_WALLET_PRIVATE_KEY?.trim();
if (!privateKey) throw new Error("Missing BURNER_WALLET_PRIVATE_KEY in .env");
const formattedKey = (
  privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`
) as `0x${string}`;

const deployedBedrockPath = path.resolve(__dirname, "../deployed_bedrock.json");
const bedrockInfo = JSON.parse(fs.readFileSync(deployedBedrockPath, "utf-8"));
const bedrockAddress = bedrockInfo.contractAddress as `0x${string}`;

async function main() {
  const account = createAccount(formattedKey);
  const client = createClient({
    chain: testnetBradbury,
    account,
  });

  console.log("Reading state from Bedrock:", bedrockAddress);
  const state = await client.readContract({
    address: bedrockAddress,
    functionName: "get_state",
    args: [],
  });
  console.log("State output:", JSON.stringify(state, null, 2));
}

main().catch(console.error);
