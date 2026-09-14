import { readFileSync } from "fs";
import path from "path";
import dotenv from "dotenv";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

async function main() {
  const privateKey = process.env.BURNER_WALLET_PRIVATE_KEY?.trim();
  if (!privateKey) throw new Error("No private key found in .env");
  const formattedKey = (
    privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`
  ) as `0x${string}`;
  const account = createAccount(formattedKey);
  console.log("Deployer account address:", account.address);

  const client = createClient({
    chain: testnetBradbury,
    account,
  });

  const filePath = path.resolve(process.cwd(), "contracts/llm_hello_world.py");
  const contractCode = readFileSync(filePath, "utf-8");

  console.log("Deploying canonical LlmHelloWorld contract...");
  console.log("Contract code size:", contractCode.length, "bytes");

  const txHash = await client.deployContract({
    code: contractCode,
    args: [],
  });

  console.log("\n>>> Deployment Transaction Submitted! <<<");
  console.log("Transaction Hash:", txHash);
  console.log(
    `Explorer URL: https://explorer-bradbury.genlayer.com/tx/${txHash}`,
  );

  console.log(
    "\nWaiting for transaction acceptance/consensus on Bradbury Testnet...",
  );
  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    status: "ACCEPTED" as any,
    retries: 60,
    interval: 5000,
  });

  console.log("\n>>> Transaction Accepted! <<<");
  console.log(
    "Deployed Contract Address:",
    (receipt as any).data?.contract_address ??
      (receipt as any).txDataDecoded?.contractAddress,
  );
  console.log("Receipt Status:", receipt.status);
  console.log("Full Receipt Data:", JSON.stringify(receipt, null, 2));
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
