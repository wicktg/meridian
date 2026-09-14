import {
  createPublicClient,
  createWalletClient,
  http,
  fallback,
  formatEther,
  Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, sepolia } from "viem/chains";
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
  console.log(
    "===============================================================",
  );
  console.log("Completing Bridge Extension Wiring");
  console.log("Deployer Address:", account.address);
  console.log(
    "===============================================================\n",
  );

  const basePublicClient = createPublicClient({
    chain: baseSepolia,
    transport: http("https://sepolia.base.org"),
  });
  const baseWalletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http("https://sepolia.base.org"),
  });

  const ethTransport = fallback([
    http("https://ethereum-sepolia-rpc.publicnode.com"),
    http("https://1rpc.io/sepolia"),
    http("https://sepolia.drpc.org"),
  ]);

  const ethPublicClient = createPublicClient({
    chain: sepolia,
    transport: ethTransport,
  });
  const ethWalletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: ethTransport,
  });

  // Load existing configuration & artifacts
  const artifactsPath = path.resolve(process.cwd(), "evm/build/artifacts.json");
  const artifacts = JSON.parse(fs.readFileSync(artifactsPath, "utf-8"));

  const ethLockPath = path.resolve(
    process.cwd(),
    "evm/deployed_ethereum_lock.json",
  );
  const ethLockData = JSON.parse(fs.readFileSync(ethLockPath, "utf-8"));
  const ethLockAddress = ethLockData.lock.address as Address;

  const existingVaultPath = path.resolve(
    process.cwd(),
    "evm/deployed_multicollateral_vault.json",
  );
  const existingConfig = JSON.parse(
    fs.readFileSync(existingVaultPath, "utf-8"),
  );

  const MUSD_ADDRESS = existingConfig.mUSD as Address;
  const BEDROCK_RECEIVER = existingConfig.receiver.address as Address;
  const BEDROCK_DISPATCHER = existingConfig.dispatcher.address as Address;

  // Already deployed in previous step
  const vaultAddress = "0xfb437be84a727e3f7f6a1b5e5f1d5a4b2463f92a" as Address;
  const vaultDeployTx =
    "0x3aa2850cd206d950cfbeab8b6d668a5d5aaf1949ecfec744b9c7e037668aedaa";
  const minterAuthTx =
    "0xbfdc5d156f31c8967e84c32f887a0acfb0652e0dd53a2fb3c643e817256d41c7";
  const bedrockAuthTx =
    "0xf0bade1e5a7dc47d6d34e78b93207a0b3cba5ff7ed34cfeec5a9a1d63ca4e709";
  const bridgeAuthTx =
    "0x511cb6d49cfadc3651bf9227615f9d0037a08e2667a3e195a082e6c92878521d";
  const updateReceiverVaultTx =
    "0x40d9e99061dabc71a7294861c6756f7aefc11111b81e30a8705ce5cfab26a87b";

  const bridgeReceiverAddress =
    "0x2e364ebfc5c22e146c6b1c3cef01f518d0bd54b1" as Address;
  const bridgeReceiverDeployTx =
    "0x1add579c96f2aa5474b7f59aaa60e49f3c44ed748c7b003bb23cb5113e874797";

  console.log("Vault Address (Base Sepolia):", vaultAddress);
  console.log("Bridge Receiver Address (Base Sepolia):", bridgeReceiverAddress);
  console.log("Ethereum Lock Address (Sepolia):", ethLockAddress);

  // Wire Base Bridge Receiver into Ethereum Sepolia Lock contract
  console.log(
    "\nWiring Base Bridge Receiver into Ethereum Sepolia Lock contract...",
  );
  const setBaseReceiverTx = await ethWalletClient.writeContract({
    address: ethLockAddress,
    abi: artifacts.EthereumSepoliaCollateralLock.abi,
    functionName: "setBaseBridgeReceiver",
    args: [bridgeReceiverAddress],
  });
  console.log("Ethereum Lock setBaseBridgeReceiver Tx:", setBaseReceiverTx);
  console.log(
    `Etherscan: https://sepolia.etherscan.io/tx/${setBaseReceiverTx}`,
  );
  await ethPublicClient.waitForTransactionReceipt({ hash: setBaseReceiverTx });
  console.log("Confirmed on Ethereum Sepolia!");

  const extensionData = {
    network: "base-sepolia",
    chainId: 84532,
    deployer: account.address,
    mUSD: MUSD_ADDRESS,
    vault: {
      address: vaultAddress,
      deploymentTx: vaultDeployTx,
      explorerUrl: `https://sepolia.basescan.org/address/${vaultAddress}`,
      txExplorerUrl: `https://sepolia.basescan.org/tx/${vaultDeployTx}`,
      minterAuthTx,
      bedrockAuthTx,
      bridgeAuthTx,
    },
    bridgeReceiver: {
      address: bridgeReceiverAddress,
      deploymentTx: bridgeReceiverDeployTx,
      explorerUrl: `https://sepolia.basescan.org/address/${bridgeReceiverAddress}`,
      txExplorerUrl: `https://sepolia.basescan.org/tx/${bridgeReceiverDeployTx}`,
    },
    bedrockReceiver: {
      address: BEDROCK_RECEIVER,
      updateTx: updateReceiverVaultTx,
    },
    bedrockDispatcher: {
      address: BEDROCK_DISPATCHER,
    },
    ethereumLock: {
      address: ethLockAddress,
      setBaseReceiverTx,
      explorerUrl: ethLockData.lock.explorerUrl,
      txExplorerUrl: `https://sepolia.etherscan.io/tx/${setBaseReceiverTx}`,
    },
    tokens: existingConfig.tokens,
    bridgedTokens: ethLockData.tokens,
    deployedAt: new Date().toISOString(),
  };

  const outputPath = path.resolve(
    process.cwd(),
    "evm/deployed_bridge_extension.json",
  );
  fs.writeFileSync(outputPath, JSON.stringify(extensionData, null, 2), "utf-8");
  console.log(`\nDeployment saved to ${outputPath}`);
}

main().catch((err) => {
  console.error("Error in wiring bridge extension:", err);
  process.exit(1);
});
