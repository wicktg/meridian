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

  console.log(
    "===============================================================",
  );
  console.log("Deploying Meridian Contracts to Base Sepolia (Chain ID: 84532)");
  console.log("Deployer Address:", account.address);

  const balance = await publicClient.getBalance({ address: account.address });
  console.log("Wallet Balance:", formatEther(balance), "ETH");

  if (balance === 0n) {
    throw new Error(
      "Wallet has 0 ETH on Base Sepolia. Stop and fund before proceeding.",
    );
  }

  const artifactsPath = path.resolve(process.cwd(), "evm/build/artifacts.json");
  if (!fs.existsSync(artifactsPath)) {
    throw new Error("Artifacts not found. Run compile.ts first.");
  }
  const artifacts = JSON.parse(fs.readFileSync(artifactsPath, "utf-8"));

  // 1. Deploy mUSD Token
  console.log("\n1. Deploying mUSD (Meridian USD) ERC-20 Token...");
  const musdDeployTxHash = await walletClient.deployContract({
    abi: artifacts.mUSD.abi,
    bytecode: artifacts.mUSD.bytecode,
    args: [],
  });
  console.log("mUSD Deploy Tx Hash:", musdDeployTxHash);
  console.log(
    `Explorer Link: https://sepolia.basescan.org/tx/${musdDeployTxHash}`,
  );

  const musdReceipt = await publicClient.waitForTransactionReceipt({
    hash: musdDeployTxHash,
  });
  const musdAddress = musdReceipt.contractAddress;
  if (!musdAddress)
    throw new Error("mUSD deployment failed: no contract address");
  console.log(">>> mUSD Deployed at:", musdAddress);
  console.log(`BaseScan: https://sepolia.basescan.org/address/${musdAddress}`);

  // Chainlink ETH / USD Data Feed on Base Sepolia
  const CHAINLINK_ETH_USD_FEED = "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1";
  console.log(
    `Using Chainlink ETH/USD Price Feed on Base Sepolia: ${CHAINLINK_ETH_USD_FEED}`,
  );

  // 2. Deploy Vault Contract
  console.log(
    "\n2. Deploying Vault Contract (ETH-only CDP with Dynamic Chainlink Oracle)...",
  );
  const vaultDeployTxHash = await walletClient.deployContract({
    abi: artifacts.Vault.abi,
    bytecode: artifacts.Vault.bytecode,
    args: [musdAddress, CHAINLINK_ETH_USD_FEED],
  });
  console.log("Vault Deploy Tx Hash:", vaultDeployTxHash);
  console.log(
    `Explorer Link: https://sepolia.basescan.org/tx/${vaultDeployTxHash}`,
  );

  const vaultReceipt = await publicClient.waitForTransactionReceipt({
    hash: vaultDeployTxHash,
  });
  const vaultAddress = vaultReceipt.contractAddress;
  if (!vaultAddress)
    throw new Error("Vault deployment failed: no contract address");
  console.log(">>> Vault Deployed at:", vaultAddress);
  console.log(`BaseScan: https://sepolia.basescan.org/address/${vaultAddress}`);

  // Query live dynamic ETH price from the deployed Vault to verify Chainlink integration
  const liveEthPriceWei = (await publicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "getLatestEthPrice",
  })) as bigint;
  console.log(
    `>>> Verified Live Dynamic ETH Price from Vault: $${formatEther(liveEthPriceWei)} USD`,
  );

  // 3. Authorize Vault on mUSD Token
  console.log("\n3. Authorizing Vault as sole minter on mUSD...");
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

  // Verification of minter status
  const confirmedMinter = (await publicClient.readContract({
    address: musdAddress,
    abi: artifacts.mUSD.abi,
    functionName: "authorizedMinter",
  })) as Address;

  if (confirmedMinter.toLowerCase() !== vaultAddress.toLowerCase()) {
    throw new Error(
      `Minter authorization mismatch! Expected ${vaultAddress}, got ${confirmedMinter}`,
    );
  }
  console.log(
    ">>> Authorization confirmed: Vault is active sole minter on mUSD!",
  );

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
      priceFeed: CHAINLINK_ETH_USD_FEED,
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
  console.log(
    "\n===============================================================",
  );
  console.log(
    "Deployment completed successfully! Recorded to evm/deployed_base_sepolia.json",
  );
  console.log(
    "===============================================================",
  );
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
