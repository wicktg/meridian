import {
  createPublicClient,
  createWalletClient,
  http,
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
  if (!privateKey)
    throw new Error("No BURNER_WALLET_PRIVATE_KEY found in .env");
  const formattedKey = (
    privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`
  ) as `0x${string}`;
  const account = privateKeyToAccount(formattedKey);

  const rpcUrl = "https://sepolia.base.org";
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  const musdAddress = "0x22c7832ae38ebeb7003fa66b5184fc3361f3c2d1" as Address;
  const musdDeployTxHash =
    "0x3ff74d0014550061f97746a6e0690926ec6021245915004bf71670c217211c7f";
  const vaultAddress = "0xf1063066e397204004d8cdf615e2bc519aacd545" as Address;
  const vaultDeployTxHash =
    "0x7078853622e70cf51c3e6acb6a11f29d216a868b82eed4f93983a50112bff625";
  const priceFeed = "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1";

  const artifactsPath = path.resolve(process.cwd(), "evm/build/artifacts.json");
  const artifacts = JSON.parse(fs.readFileSync(artifactsPath, "utf-8"));

  console.log(
    "===============================================================",
  );
  console.log("Finalizing Meridian Base Sepolia Deployment");
  console.log("Deployer:", account.address);
  console.log("mUSD Address:", musdAddress);
  console.log("Vault Address:", vaultAddress);
  console.log("Chainlink Price Feed:", priceFeed);
  console.log(
    "===============================================================\n",
  );

  // Verify Vault dynamic ETH price query
  const liveEthPriceWei = (await publicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "getLatestEthPrice",
  })) as bigint;
  console.log(
    `Verified Live Dynamic ETH Price from Vault: $${formatEther(liveEthPriceWei)} USD`,
  );

  // Authorize Vault as sole minter on mUSD
  console.log("\nAuthorizing Vault as sole minter on mUSD...");
  const authTxHash = await walletClient.writeContract({
    address: musdAddress,
    abi: artifacts.mUSD.abi,
    functionName: "setAuthorizedMinter",
    args: [vaultAddress],
  });
  console.log("SetAuthorizedMinter Tx Hash:", authTxHash);
  console.log(`Explorer Link: https://sepolia.basescan.org/tx/${authTxHash}`);

  const authReceipt = await publicClient.waitForTransactionReceipt({
    hash: authTxHash,
  });
  if (authReceipt.status !== "success") {
    throw new Error("Authorization transaction failed on-chain");
  }

  // Wait 2.5s for state confirmation
  await new Promise((r) => setTimeout(r, 2500));

  const confirmedMinter = (await publicClient.readContract({
    address: musdAddress,
    abi: artifacts.mUSD.abi,
    functionName: "authorizedMinter",
  })) as Address;

  console.log("Confirmed Authorized Minter on mUSD:", confirmedMinter);
  if (confirmedMinter.toLowerCase() !== vaultAddress.toLowerCase()) {
    throw new Error(
      `Minter mismatch! Expected ${vaultAddress}, got ${confirmedMinter}`,
    );
  }

  const deploymentData = {
    network: "base-sepolia",
    chainId: 84532,
    deployer: account.address,
    mUSD: {
      address: musdAddress,
      deploymentTx: musdDeployTxHash,
      explorerUrl: `https://sepolia.basescan.org/address/${musdAddress}`,
      txExplorerUrl: `https://sepolia.basescan.org/tx/${musdDeployTxHash}`,
    },
    vault: {
      address: vaultAddress,
      deploymentTx: vaultDeployTxHash,
      explorerUrl: `https://sepolia.basescan.org/address/${vaultAddress}`,
      txExplorerUrl: `https://sepolia.basescan.org/tx/${vaultDeployTxHash}`,
      priceFeed: priceFeed,
      livePriceUSD: formatEther(liveEthPriceWei),
    },
    authorization: {
      txHash: authTxHash,
      txExplorerUrl: `https://sepolia.basescan.org/tx/${authTxHash}`,
      authorizedMinter: confirmedMinter,
    },
    deployedAt: new Date().toISOString(),
  };

  const outputPath = path.resolve(
    process.cwd(),
    "evm/deployed_base_sepolia.json",
  );
  fs.writeFileSync(
    outputPath,
    JSON.stringify(deploymentData, null, 2),
    "utf-8",
  );
  console.log("\nRecorded deployment data to evm/deployed_base_sepolia.json");
}

main().catch((err) => {
  console.error("Finalization failed:", err);
  process.exit(1);
});
