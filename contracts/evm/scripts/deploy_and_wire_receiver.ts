import {
  createPublicClient,
  createWalletClient,
  http,
  fallback,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const privateKey = process.env.BURNER_WALLET_PRIVATE_KEY?.trim();
  if (!privateKey)
    throw new Error("No BURNER_WALLET_PRIVATE_KEY found in .env");
  const formattedKey = (
    privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`
  ) as `0x${string}`;
  const account = privateKeyToAccount(formattedKey);

  const rpcTransport = fallback([
    http("https://sepolia.base.org", { retryCount: 5, retryDelay: 2000 }),
    http("https://base-sepolia-rpc.publicnode.com", {
      retryCount: 5,
      retryDelay: 2000,
    }),
  ]);

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: rpcTransport,
  });

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: rpcTransport,
  });

  const deploymentPath = path.resolve(
    process.cwd(),
    "evm/deployed_multicollateral_vault.json",
  );
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
  const artifactsPath = path.resolve(process.cwd(), "evm/build/artifacts.json");
  const artifacts = JSON.parse(fs.readFileSync(artifactsPath, "utf-8"));

  const vaultAddress = deployment.vault.address as Address;
  const lzEndpoint = "0x6EDCE65403992e310A62460808c4b910D972f10f" as Address;

  console.log(
    "Deploying upgraded BedrockLayerZeroReceiver with GUID forwarding...",
  );
  const receiverDeployTxHash = await walletClient.deployContract({
    abi: artifacts.BedrockLayerZeroReceiver.abi,
    bytecode: artifacts.BedrockLayerZeroReceiver.bytecode,
    args: [lzEndpoint, vaultAddress],
  });
  console.log("Receiver Deploy Tx:", receiverDeployTxHash);

  const receiverReceipt = await publicClient.waitForTransactionReceipt({
    hash: receiverDeployTxHash,
  });
  const receiverAddress = receiverReceipt.contractAddress;
  if (!receiverAddress) throw new Error("Receiver deploy failed");
  console.log(">>> Upgraded Receiver Deployed at:", receiverAddress);

  await sleep(2500);

  // Authorize Receiver on Vault
  console.log("Authorizing Receiver on Vault...");
  const authTx = await walletClient.writeContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "setAuthorizedReceiver",
    args: [receiverAddress],
  });
  console.log("SetAuthorizedReceiver Tx:", authTx);
  await publicClient.waitForTransactionReceipt({ hash: authTx });

  // Update deployment JSON
  deployment.receiver.address = receiverAddress;
  deployment.receiver.deployTx = receiverDeployTxHash;
  deployment.vault.receiverAuthTx = authTx;
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));

  console.log("Receiver upgraded & wired successfully!");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
