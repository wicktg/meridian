import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

const privateKey = process.env.BURNER_WALLET_PRIVATE_KEY?.trim();
const formattedKey = (
  privateKey?.startsWith("0x") ? privateKey : `0x${privateKey}`
) as `0x${string}`;

async function main() {
  const account = createAccount(formattedKey);
  const client = createClient({
    chain: testnetBradbury,
    account,
  });

  const txHash =
    "0x8400026c73ab480399a36281d5eb7322b7261c9a036dae73f07e27ffce5f1aa9";
  console.log("Fetching Tx:", txHash);
  const tx = await client.getTransaction({ hash: txHash as `0x${string}` });
  const replacer = (_: string, v: any) =>
    typeof v === "bigint" ? v.toString() : v;
  console.log("Tx Details:", JSON.stringify(tx, replacer, 2));

  console.log("\nFetching Receipt:");
  try {
    const receipt = await client.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });
    console.log("Receipt:", JSON.stringify(receipt, replacer, 2));
  } catch (e: any) {
    console.log("Receipt error:", e.message);
  }
}

main().catch(console.error);
