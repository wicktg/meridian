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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
  const chainlinkPriceFeed =
    "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1" as Address;
  const lzEndpoint = "0x6EDCE65403992e310A62460808c4b910D972f10f" as Address;
  const bedrockGenlayerContract =
    "0x2C9dE921f5B10468D53f4bd49DFd98414d5f6380" as Address;

  const artifactsPath = path.resolve(process.cwd(), "evm/build/artifacts.json");
  const artifacts = JSON.parse(fs.readFileSync(artifactsPath, "utf-8"));

  console.log(
    "===============================================================",
  );
  console.log(
    "Deploying Meridian Dynamic Vault & LayerZero Wiring (Base Sepolia)",
  );
  console.log("Deployer:", account.address);
  const balance = await publicClient.getBalance({ address: account.address });
  console.log("Wallet Balance:", formatEther(balance), "ETH");
  console.log("Existing mUSD Token:", musdAddress);
  console.log("Chainlink ETH/USD Feed:", chainlinkPriceFeed);
  console.log("LayerZero Endpoint V2:", lzEndpoint);
  console.log("Bedrock Contract on GenLayer:", bedrockGenlayerContract);
  console.log(
    "===============================================================\n",
  );

  // 1. Deploy new Dynamic Regime Vault
  console.log(
    "1. Deploying Dynamic Regime Vault (ETH CDP with Bedrock Wiring)...",
  );
  const vaultDeployTxHash = await walletClient.deployContract({
    abi: artifacts.Vault.abi,
    bytecode: artifacts.Vault.bytecode,
    args: [musdAddress, chainlinkPriceFeed],
  });
  console.log("Vault Deploy Tx Hash:", vaultDeployTxHash);
  console.log(`BaseScan: https://sepolia.basescan.org/tx/${vaultDeployTxHash}`);

  const vaultReceipt = await publicClient.waitForTransactionReceipt({
    hash: vaultDeployTxHash,
  });
  const vaultAddress = vaultReceipt.contractAddress;
  if (!vaultAddress) throw new Error("Vault deployment failed");
  console.log(">>> Vault Deployed at:", vaultAddress);
  console.log(
    `BaseScan: https://sepolia.basescan.org/address/${vaultAddress}\n`,
  );

  await sleep(2500);

  // 2. Authorize new Vault as sole minter on mUSD
  console.log("2. Authorizing new Vault on mUSD Token...");
  const authMinterTxHash = await walletClient.writeContract({
    address: musdAddress,
    abi: artifacts.mUSD.abi,
    functionName: "setAuthorizedMinter",
    args: [vaultAddress],
  });
  console.log("SetAuthorizedMinter Tx Hash:", authMinterTxHash);
  console.log(`BaseScan: https://sepolia.basescan.org/tx/${authMinterTxHash}`);

  const authMinterReceipt = await publicClient.waitForTransactionReceipt({
    hash: authMinterTxHash,
  });
  if (authMinterReceipt.status !== "success") {
    throw new Error("Minter authorization transaction failed");
  }

  await sleep(2500);
  const confirmedMinter = await publicClient.readContract({
    address: musdAddress,
    abi: artifacts.mUSD.abi,
    functionName: "authorizedMinter",
  });
  console.log(
    ">>> Confirmed Authorized Minter on mUSD:",
    confirmedMinter,
    "\n",
  );

  // 3. Deploy BedrockLayerZeroReceiver
  console.log("3. Deploying BedrockLayerZeroReceiver...");
  const receiverDeployTxHash = await walletClient.deployContract({
    abi: artifacts.BedrockLayerZeroReceiver.abi,
    bytecode: artifacts.BedrockLayerZeroReceiver.bytecode,
    args: [lzEndpoint, vaultAddress],
  });
  console.log("Receiver Deploy Tx Hash:", receiverDeployTxHash);
  console.log(
    `BaseScan: https://sepolia.basescan.org/tx/${receiverDeployTxHash}`,
  );

  const receiverReceipt = await publicClient.waitForTransactionReceipt({
    hash: receiverDeployTxHash,
  });
  const receiverAddress = receiverReceipt.contractAddress;
  if (!receiverAddress) throw new Error("Receiver deployment failed");
  console.log(">>> Receiver Deployed at:", receiverAddress);
  console.log(
    `BaseScan: https://sepolia.basescan.org/address/${receiverAddress}\n`,
  );

  await sleep(2500);

  // 4. Authorize Receiver on Vault
  console.log("4. Authorizing BedrockLayerZeroReceiver on Vault...");
  const authReceiverTxHash = await walletClient.writeContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "setAuthorizedReceiver",
    args: [receiverAddress],
  });
  console.log("SetAuthorizedReceiver Tx Hash:", authReceiverTxHash);
  console.log(
    `BaseScan: https://sepolia.basescan.org/tx/${authReceiverTxHash}`,
  );

  const authReceiverReceipt = await publicClient.waitForTransactionReceipt({
    hash: authReceiverTxHash,
  });
  if (authReceiverReceipt.status !== "success") {
    throw new Error("Receiver authorization transaction failed");
  }

  await sleep(2500);
  const confirmedReceiver = await publicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "authorizedReceiver",
  });
  console.log(
    ">>> Confirmed Authorized Receiver on Vault:",
    confirmedReceiver,
    "\n",
  );

  // 5. Deploy BedrockLayerZeroDispatcher
  console.log("5. Deploying BedrockLayerZeroDispatcher...");
  const dispatcherDeployTxHash = await walletClient.deployContract({
    abi: artifacts.BedrockLayerZeroDispatcher.abi,
    bytecode: artifacts.BedrockLayerZeroDispatcher.bytecode,
    args: [lzEndpoint, bedrockGenlayerContract],
  });
  console.log("Dispatcher Deploy Tx Hash:", dispatcherDeployTxHash);
  console.log(
    `BaseScan: https://sepolia.basescan.org/tx/${dispatcherDeployTxHash}`,
  );

  const dispatcherReceipt = await publicClient.waitForTransactionReceipt({
    hash: dispatcherDeployTxHash,
  });
  const dispatcherAddress = dispatcherReceipt.contractAddress;
  if (!dispatcherAddress) throw new Error("Dispatcher deployment failed");
  console.log(">>> Dispatcher Deployed at:", dispatcherAddress);
  console.log(
    `BaseScan: https://sepolia.basescan.org/address/${dispatcherAddress}\n`,
  );

  const wiringData = {
    network: "base-sepolia",
    chainId: 84532,
    deployer: account.address,
    mUSD: {
      address: musdAddress,
      explorerUrl: `https://sepolia.basescan.org/address/${musdAddress}`,
    },
    vault: {
      address: vaultAddress,
      deploymentTx: vaultDeployTxHash,
      explorerUrl: `https://sepolia.basescan.org/address/${vaultAddress}`,
      txExplorerUrl: `https://sepolia.basescan.org/tx/${vaultDeployTxHash}`,
      minterAuthTx: authMinterTxHash,
    },
    receiver: {
      address: receiverAddress,
      deploymentTx: receiverDeployTxHash,
      explorerUrl: `https://sepolia.basescan.org/address/${receiverAddress}`,
      txExplorerUrl: `https://sepolia.basescan.org/tx/${receiverDeployTxHash}`,
      vaultAuthTx: authReceiverTxHash,
    },
    dispatcher: {
      address: dispatcherAddress,
      deploymentTx: dispatcherDeployTxHash,
      explorerUrl: `https://sepolia.basescan.org/address/${dispatcherAddress}`,
      txExplorerUrl: `https://sepolia.basescan.org/tx/${dispatcherDeployTxHash}`,
    },
    external: {
      chainlinkPriceFeed: chainlinkPriceFeed,
      layerZeroEndpoint: lzEndpoint,
      bedrockGenlayerContract: bedrockGenlayerContract,
    },
    deployedAt: new Date().toISOString(),
  };

  const outputPath = path.resolve(process.cwd(), "evm/deployed_lz_wiring.json");
  fs.writeFileSync(outputPath, JSON.stringify(wiringData, null, 2), "utf-8");

  console.log(
    "===============================================================",
  );
  console.log("Deployment and cross-chain wiring completed successfully!");
  console.log("Recorded to evm/deployed_lz_wiring.json");
  console.log(
    "===============================================================",
  );
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
