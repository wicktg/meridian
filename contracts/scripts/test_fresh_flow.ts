import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { parseEther } from "viem";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

const privateKey = process.env.BURNER_WALLET_PRIVATE_KEY?.trim()!;
const formattedKey = (
  privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`
) as `0x${string}`;

async function main() {
  const masterAccount = createAccount(formattedKey);
  const client = createClient({
    chain: testnetBradbury,
    account: masterAccount,
  });

  console.log("Master Account:", masterAccount.address);
  const masterBal = await client.getBalance({ address: masterAccount.address });
  console.log("Master Balance:", masterBal.toString());

  // Generate 1 fresh account for test
  const freshPrivKey = generatePrivateKey();
  const freshAccount = createAccount(freshPrivKey);
  console.log("\nFresh Account:", freshAccount.address);

  // Send 0.1 GEN to fresh account
  console.log("Funding fresh account with 0.1 GEN...");
  const fundTx = await client.sendTransaction({
    to: freshAccount.address,
    value: parseEther("0.1"),
  });
  console.log("Fund Tx Hash:", fundTx);
  const fundReceipt = await client.waitForTransactionReceipt({ hash: fundTx });
  console.log("Fund confirmed:", fundReceipt.status);

  // Now create client with freshAccount
  const freshClient = createClient({
    chain: testnetBradbury,
    account: freshAccount,
  });

  const targetContract = "0x2C9dE921f5B10468D53f4bd49DFd98414d5f6380";
  console.log("\nSubmitting fresh test transaction to:", targetContract);
  const testPayload = `Risk Telemetry (Live Sep 14, 2026): ETH spot $2511.04, Chainlink fresh 289s, normal volatility. Protocol Stable.`;

  const txHash = await freshClient.writeContract({
    address: targetContract,
    functionName: "assess_evidence",
    args: [testPayload],
    value: 0n,
  });

  console.log("Tx Hash:", txHash);
  console.log(`Explorer: https://explorer-bradbury.genlayer.com/tx/${txHash}`);

  console.log("Waiting for transaction receipt (ACCEPTED / FINALIZED)...");
  const receipt = await freshClient.waitForTransactionReceipt({
    hash: txHash,
    status: "ACCEPTED" as any,
    retries: 30,
    interval: 5000,
  });
  console.log("Receipt Status:", receipt.status);
}

main().catch(console.error);
