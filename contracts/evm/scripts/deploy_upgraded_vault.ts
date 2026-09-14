import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  formatUnits,
  parseEther,
  parseUnits,
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
  console.log("Deploying Upgraded Vault (Stability Fees + Liquidation Engine)");
  console.log("Deployer:", account.address);
  const balance = await publicClient.getBalance({ address: account.address });
  console.log("ETH Balance:", formatEther(balance), "ETH");
  console.log(
    "===============================================================\n",
  );

  // 1. Upgraded Vault already deployed in previous step
  const vaultAddress = "0xc3f13ce0446e61ec1888e7bb7e9858d21aa7dd78" as Address;
  const vaultDeployTxHash =
    "0xeeca0dd46b81417159faef54d63894955bf3d5ed9a658e90fcaa77df88b69e1c" as `0x${string}`;
  console.log("1. Using already deployed Upgraded Vault on Base Sepolia:");
  console.log("Vault Deploy Tx Hash:", vaultDeployTxHash);
  console.log(`BaseScan: https://sepolia.basescan.org/tx/${vaultDeployTxHash}`);
  console.log(">>> Upgraded Vault at:", vaultAddress);
  console.log(
    `BaseScan: https://sepolia.basescan.org/address/${vaultAddress}\n`,
  );

  await sleep(4000);

  // 2. Authorize new Vault as sole minter on mUSD
  console.log("2. Authorizing new Upgraded Vault on mUSD Token...");
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

  // 4. Pre-approve tokens for new Vault
  console.log("4. Approving collateral tokens for new Vault...");
  const erc20Abi = parseAbi([
    "function approve(address spender, uint256 amount) returns (bool)",
    "function balanceOf(address) view returns (uint256)",
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
    await sleep(4000);
  }

  // 5. Update configuration file
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

  fs.writeFileSync(
    deploymentPath,
    JSON.stringify(newDeploymentData, null, 2),
    "utf-8",
  );
  console.log(
    "\n>>> Upgraded Vault fully wired, authorized, and saved to deployed_multicollateral_vault.json!",
  );
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
