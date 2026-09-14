import {
  createPublicClient,
  createWalletClient,
  http,
  fallback,
  formatEther,
  parseEther,
  parseAbi,
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
  const oldDeployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
  const artifactsPath = path.resolve(process.cwd(), "evm/build/artifacts.json");
  const artifacts = JSON.parse(fs.readFileSync(artifactsPath, "utf-8"));

  const musdAddress = oldDeployment.mUSD as Address;
  const receiverAddress = oldDeployment.receiver.address as Address;
  const dispatcherAddress = oldDeployment.dispatcher.address as Address;

  const TOKENS: Address[] = [
    oldDeployment.tokens.WETH.address,
    oldDeployment.tokens.USDC.address,
    oldDeployment.tokens.LINK.address,
    oldDeployment.tokens.WBTC.address,
  ];

  const FEEDS: Address[] = [
    oldDeployment.tokens.WETH.feed,
    oldDeployment.tokens.USDC.feed,
    oldDeployment.tokens.LINK.feed,
    oldDeployment.tokens.WBTC.feed,
  ];

  const DECIMALS: number[] = [
    oldDeployment.tokens.WETH.decimals,
    oldDeployment.tokens.USDC.decimals,
    oldDeployment.tokens.LINK.decimals,
    oldDeployment.tokens.WBTC.decimals,
  ];

  console.log(
    "===============================================================",
  );
  console.log(
    "Deploying Upgraded Vault with Indexed Events & Strict Mint Rules",
  );
  console.log("Deployer / Admin:", account.address);
  const balance = await publicClient.getBalance({ address: account.address });
  console.log("ETH Balance:", formatEther(balance), "ETH");
  console.log(
    "===============================================================\n",
  );

  // 1. Deploy Vault
  console.log("1. Deploying new Vault on Base Sepolia...");
  const vaultDeployTxHash = await walletClient.deployContract({
    abi: artifacts.Vault.abi,
    bytecode: artifacts.Vault.bytecode,
    args: [musdAddress, TOKENS, FEEDS, DECIMALS],
  });
  console.log("Vault Deploy Tx Hash:", vaultDeployTxHash);
  console.log(`BaseScan: https://sepolia.basescan.org/tx/${vaultDeployTxHash}`);

  const vaultReceipt = await publicClient.waitForTransactionReceipt({
    hash: vaultDeployTxHash,
  });
  const vaultAddress = vaultReceipt.contractAddress;
  if (!vaultAddress) throw new Error("Vault deployment failed");
  console.log(">>> Upgraded Vault Deployed at:", vaultAddress);
  console.log(
    `BaseScan: https://sepolia.basescan.org/address/${vaultAddress}\n`,
  );

  await sleep(3000);

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
  await publicClient.waitForTransactionReceipt({ hash: authMinterTxHash });
  await sleep(2500);

  // 3. Connect BedrockLayerZeroReceiver to new Vault
  console.log("3. Wiring BedrockLayerZeroReceiver to new Vault...");
  const setReceiverVaultTxHash = await walletClient.writeContract({
    address: receiverAddress,
    abi: artifacts.BedrockLayerZeroReceiver.abi,
    functionName: "setVault",
    args: [vaultAddress],
  });
  console.log("Receiver setVault Tx Hash:", setReceiverVaultTxHash);
  console.log(
    `BaseScan: https://sepolia.basescan.org/tx/${setReceiverVaultTxHash}`,
  );
  await publicClient.waitForTransactionReceipt({
    hash: setReceiverVaultTxHash,
  });
  await sleep(2500);

  const authReceiverOnVaultTxHash = await walletClient.writeContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "setAuthorizedReceiver",
    args: [receiverAddress],
  });
  console.log(
    "Vault setAuthorizedReceiver Tx Hash:",
    authReceiverOnVaultTxHash,
  );
  console.log(
    `BaseScan: https://sepolia.basescan.org/tx/${authReceiverOnVaultTxHash}`,
  );
  await publicClient.waitForTransactionReceipt({
    hash: authReceiverOnVaultTxHash,
  });
  await sleep(2500);

  // 4. Pre-approve collateral tokens for new Vault
  console.log("4. Approving collateral tokens for new Vault...");
  const erc20Abi = parseAbi([
    "function approve(address spender, uint256 amount) returns (bool)",
  ]);
  const maxApproval = parseEther("1000000000");

  for (let i = 0; i < TOKENS.length; i++) {
    const token = TOKENS[i];
    const appTx = await walletClient.writeContract({
      address: token,
      abi: erc20Abi,
      functionName: "approve",
      args: [vaultAddress, maxApproval],
    });
    console.log(`- Approved token ${token} in tx: ${appTx}`);
    await publicClient.waitForTransactionReceipt({ hash: appTx });
    await sleep(2000);
  }

  // 5. Save updated deployment data
  const newDeploymentData = {
    network: "base-sepolia",
    chainId: 84532,
    deployer: account.address,
    mUSD: musdAddress,
    vault: {
      address: vaultAddress,
      deploymentTx: vaultDeployTxHash,
      explorerUrl: `https://sepolia.basescan.org/address/${vaultAddress}`,
      txExplorerUrl: `https://sepolia.basescan.org/tx/${vaultDeployTxHash}`,
      minterAuthTx: authMinterTxHash,
      receiverAuthTx: authReceiverOnVaultTxHash,
      previousVault: oldDeployment.vault.address,
    },
    receiver: {
      address: receiverAddress,
      setVaultTx: setReceiverVaultTxHash,
    },
    dispatcher: {
      address: dispatcherAddress,
    },
    tokens: oldDeployment.tokens,
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(deploymentPath, JSON.stringify(newDeploymentData, null, 2));
  console.log("\n>>> Saved updated deployment to:", deploymentPath);
  console.log("\nDEPLOYMENT AND WIRING COMPLETE!");
  console.log("New Vault Address:", vaultAddress);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
