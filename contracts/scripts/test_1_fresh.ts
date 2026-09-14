import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { generatePrivateKey } from "viem/accounts";
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

  // Generate fresh account
  const freshKey = generatePrivateKey();
  const freshAccount = createAccount(freshKey);
  console.log("Fresh Account:", freshAccount.address);

  // Fund with 0.05 GEN
  console.log("Funding 0.05 GEN...");
  await client.sendTransaction({
    to: freshAccount.address,
    value: parseEther("0.05"),
  });

  // Wait for balance to appear
  for (let i = 0; i < 20; i++) {
    const bal = await client.getBalance({ address: freshAccount.address });
    if (bal > 0n) {
      console.log(`Funded! Balance: ${bal.toString()}`);
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  const freshClient = createClient({
    chain: testnetBradbury,
    account: freshAccount,
  });

  const contractAddress = "0x2C9dE921f5B10468D53f4bd49DFd98414d5f6380";
  const payload = `Market Telemetry Report (Live Sep 14, 2026):
- Asset: ETH/USD = $2511.04 (Chainlink latency: 289s, Volatility 1h: 0.35%).
- Protocol Collateralization Ratio: 285% (Safe threshold: 140%).
- Status: Spot price is stable, oracle heartbeat is fresh, and short-term volatility is normal. Protocol Stable.`;

  console.log("\nSubmitting to", contractAddress);
  const txHash = await freshClient.writeContract({
    address: contractAddress,
    functionName: "assess_evidence",
    args: [payload],
  });

  console.log(">>> FRESH TX HASH:", txHash);
  console.log(
    `>>> Explorer: https://explorer-bradbury.genlayer.com/tx/${txHash}`,
  );

  console.log("\nWaiting for GenLayer consensus...");
  for (let attempt = 1; attempt <= 30; attempt++) {
    const tx = await freshClient.getTransaction({ hash: txHash });
    console.log(
      `[Attempt ${attempt}] Status: ${tx?.statusName} (${tx?.status}) | Activator: ${(tx as any)?.activator}`,
    );
    if (
      tx?.status === 5 ||
      tx?.status === 7 ||
      tx?.statusName === "ACCEPTED" ||
      tx?.statusName === "FINALIZED"
    ) {
      console.log("\n>>> SUCCESS! Transaction is FINALIZED/ACCEPTED!");
      console.log("Tx details:", JSON.stringify(tx, null, 2));
      return;
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
}

main().catch(console.error);
