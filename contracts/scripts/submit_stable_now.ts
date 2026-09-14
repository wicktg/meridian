import path from "path";
import { readFileSync, writeFileSync } from "fs";
import dotenv from "dotenv";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

async function main() {
  const privateKey = process.env.BURNER_WALLET_PRIVATE_KEY?.trim();
  if (!privateKey)
    throw new Error("No BURNER_WALLET_PRIVATE_KEY found in .env");
  const formattedKey = (
    privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`
  ) as `0x${string}`;
  const account = createAccount(formattedKey);

  const client = createClient({
    chain: testnetBradbury,
    account,
  });

  const deployedInfo = JSON.parse(
    readFileSync(path.resolve(process.cwd(), "deployed_bedrock.json"), "utf-8"),
  );
  const contractAddress = deployedInfo.contractAddress as `0x${string}`;

  console.log(
    "===============================================================",
  );
  console.log(
    "Submitting FRESH Stable Assessment to GenLayer Testnet Bradbury",
  );
  console.log("Contract:", contractAddress);
  console.log("Sender:", account.address);
  console.log("Current Time:", new Date().toISOString());
  console.log(
    "===============================================================\n",
  );

  const evidence = `Market Telemetry Report (Live Sep 13, 2026):
- Asset: WETH/USD = $3,452.10 (Chainlink: $3,451.95, Uniswap TWAP: $3,452.20, Divergence: 0.007%).
- Protocol Collateralization Ratio: 285% (Safe threshold: 140%).
- Debt Ceiling Utilization: 42% ($21M minted out of $50M cap).
- Liquidity Pool Health: Curve mUSD/USDC pool balance is 50.2% / 49.8%, depth $45M within 15bps.
- Protocol Status: Clean audit track record, zero security disclosures, borrow APR stable at 3.25%.`;

  console.log("Submitting transaction via client.writeContract()...");
  const txHash = await client.writeContract({
    address: contractAddress,
    functionName: "assess_evidence",
    args: [evidence],
  });

  console.log("\n>>> SUBMITTED FRESH TX HASH:", txHash);
  console.log(
    `>>> Explorer: https://explorer-bradbury.genlayer.com/tx/${txHash}`,
  );
  console.log(
    "\nWaiting for GenLayer consensus acceptance (Equivalence Principle)...",
  );

  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    status: "ACCEPTED" as any,
    retries: 100,
    interval: 5000,
  });

  console.log("\n>>> TRANSACTION ACCEPTED BY GENLAYER VALIDATORS!");
  console.log("Receipt Status:", receipt.status);

  // Read back state from contract
  const state = await client.readContract({
    address: contractAddress,
    functionName: "get_state",
    args: [],
  });

  console.log("On-Chain State Output:", JSON.stringify(state, null, 2));

  // Save to fresh file
  const outData = {
    txHash,
    explorerUrl: `https://explorer-bradbury.genlayer.com/tx/${txHash}`,
    timestamp: new Date().toISOString(),
    state,
  };
  writeFileSync(
    path.resolve(process.cwd(), "latest_stable_tx.json"),
    JSON.stringify(outData, null, 2),
  );
  console.log("\nSaved result to latest_stable_tx.json");
}

main().catch((err) => {
  console.error("Error submitting to GenLayer:", err);
  process.exit(1);
});
