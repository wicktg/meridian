import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatEther,
  Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

async function main() {
  const privateKey = process.env.BURNER_WALLET_PRIVATE_KEY?.trim();
  const formattedKey = (
    privateKey!.startsWith("0x") ? privateKey : `0x${privateKey}`
  ) as `0x${string}`;
  const account = privateKeyToAccount(formattedKey);

  const client = createPublicClient({
    chain: baseSepolia,
    transport: http("https://sepolia.base.org"),
  });
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http("https://sepolia.base.org"),
  });

  const config = JSON.parse(
    fs.readFileSync("evm/deployed_bridge_extension.json", "utf8"),
  );
  const artifacts = JSON.parse(
    fs.readFileSync("evm/build/artifacts.json", "utf8"),
  );

  const vaultAddress = config.vault.address as Address;
  const daiSepolia = config.bridgedTokens.DAI.address as Address;

  console.log("Vault Address:", vaultAddress);
  console.log("DAI Sepolia Address:", daiSepolia);
  console.log("User:", account.address);

  // Check state
  const isBridged = await client.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "isBridgedToken",
    args: [daiSepolia],
  });
  const bal = await client.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "bridgedCollateral",
    args: [daiSepolia, account.address],
  });
  const totalValUSD = await client.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "getTotalCollateralValueUSD",
    args: [account.address],
  });

  console.log("isBridgedToken:", isBridged);
  console.log("bridgedCollateral:", bal);
  console.log("totalValUSD:", totalValUSD);

  // Try simulate mint
  try {
    const sim = await client.simulateContract({
      address: vaultAddress,
      abi: artifacts.Vault.abi,
      functionName: "mint",
      args: [daiSepolia, parseUnits("0.4", 18)],
      account,
    });
    console.log("Simulate mint SUCCESS!");

    const tx = await walletClient.writeContract({
      address: vaultAddress,
      abi: artifacts.Vault.abi,
      functionName: "mint",
      args: [daiSepolia, parseUnits("0.4", 18)],
    });
    console.log("Mint Tx:", tx);
    await client.waitForTransactionReceipt({ hash: tx });
    console.log("Mint confirmed on BaseScan!");
  } catch (err: any) {
    console.error("Mint error:", err.message || err);
    if (err.data) console.error("Error data:", err.data);
  }
}

main().catch(console.error);
