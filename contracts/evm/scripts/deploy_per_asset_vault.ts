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
  const lzEndpoint = "0x6EDCE65403992e310A62460808c4b910D972f10f" as Address;
  const bridgeReceiverAddress = "0x2e364ebfc5c22e146c6b1c3cef01f518d0bd54b1" as Address;
  const daiAddress = "0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357" as Address;

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

  console.log("===============================================================");
  console.log("Deploying Per-Asset Vault & Receiver on Base Sepolia");
  console.log("Deployer:", account.address);
  const balance = await publicClient.getBalance({ address: account.address });
  console.log("ETH Balance:", formatEther(balance), "ETH");
  console.log("===============================================================\n");

  // 1. Deploy Vault
  console.log("1. Deploying Per-Asset Vault on Base Sepolia...");
  const vaultDeployTxHash = await walletClient.deployContract({
    abi: artifacts.Vault.abi,
    bytecode: artifacts.Vault.bytecode,
    args: [musdAddress, TOKENS, FEEDS, DECIMALS],
  });
  console.log("Vault Deploy Tx Hash:", vaultDeployTxHash);
  const vaultReceipt = await publicClient.waitForTransactionReceipt({
    hash: vaultDeployTxHash,
  });
  const vaultAddress = vaultReceipt.contractAddress;
  if (!vaultAddress) throw new Error("Vault deployment failed");
  console.log(">>> Per-Asset Vault Deployed at:", vaultAddress);
  console.log(`BaseScan: https://sepolia.basescan.org/address/${vaultAddress}\n`);

  await sleep(3000);

  // 2. Deploy BedrockLayerZeroReceiver
  console.log("2. Deploying BedrockLayerZeroReceiver with relayAssetRegimes...");
  const receiverDeployTxHash = await walletClient.deployContract({
    abi: artifacts.BedrockLayerZeroReceiver.abi,
    bytecode: artifacts.BedrockLayerZeroReceiver.bytecode,
    args: [lzEndpoint, vaultAddress],
  });
  console.log("Receiver Deploy Tx Hash:", receiverDeployTxHash);
  const receiverReceipt = await publicClient.waitForTransactionReceipt({
    hash: receiverDeployTxHash,
  });
  const receiverAddress = receiverReceipt.contractAddress;
  if (!receiverAddress) throw new Error("Receiver deployment failed");
  console.log(">>> BedrockLayerZeroReceiver Deployed at:", receiverAddress);
  console.log(`BaseScan: https://sepolia.basescan.org/address/${receiverAddress}\n`);

  await sleep(3000);

  // 3. Authorize new Vault on mUSD
  console.log("3. Authorizing new Vault on mUSD Token...");
  const authMinterTxHash = await walletClient.writeContract({
    address: musdAddress,
    abi: artifacts.mUSD.abi,
    functionName: "setAuthorizedMinter",
    args: [vaultAddress],
  });
  console.log("SetAuthorizedMinter Tx Hash:", authMinterTxHash);
  await publicClient.waitForTransactionReceipt({ hash: authMinterTxHash });
  await sleep(2500);

  // 4. Wire Receiver on Vault
  console.log("4. Authorizing Receiver on Vault...");
  const authReceiverTxHash = await walletClient.writeContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "setAuthorizedReceiver",
    args: [receiverAddress],
  });
  console.log("Vault setAuthorizedReceiver Tx Hash:", authReceiverTxHash);
  await publicClient.waitForTransactionReceipt({ hash: authReceiverTxHash });
  await sleep(2500);

  // 5. Wire Bridge Receiver on Vault
  console.log("5. Setting Bridge Receiver on Vault...");
  const authBridgeTxHash = await walletClient.writeContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "setBridgeReceiver",
    args: [bridgeReceiverAddress],
  });
  console.log("Vault setBridgeReceiver Tx Hash:", authBridgeTxHash);
  await publicClient.waitForTransactionReceipt({ hash: authBridgeTxHash });
  await sleep(2500);

  // 6. Enable DAI for Per-Asset Evaluation
  console.log("6. Enabling DAI (bridged) for Per-Asset Evaluation...");
  const enableDaiTxHash = await walletClient.writeContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "setPerAssetEvaluationEnabled",
    args: [daiAddress, true],
  });
  console.log("Vault setPerAssetEvaluationEnabled(DAI, true) Tx Hash:", enableDaiTxHash);
  await publicClient.waitForTransactionReceipt({ hash: enableDaiTxHash });
  await sleep(2500);

  // 7. Approve collateral tokens for new Vault
  console.log("7. Approving collateral tokens for new Vault...");
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
    await sleep(1500);
  }

  // 8. Save updated deployment data
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
      receiverAuthTx: authReceiverTxHash,
      bridgeAuthTx: authBridgeTxHash,
      daiPerAssetEnableTx: enableDaiTxHash,
      previousVault: oldDeployment.vault.address,
    },
    receiver: {
      address: receiverAddress,
      deploymentTx: receiverDeployTxHash,
    },
    dispatcher: oldDeployment.dispatcher,
    tokens: oldDeployment.tokens,
    bridgedTokens: {
      DAI: {
        address: daiAddress,
        decimals: 18,
      },
    },
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(deploymentPath, JSON.stringify(newDeploymentData, null, 2));
  console.log("\n>>> Saved updated deployment to:", deploymentPath);
  console.log("\nDEPLOYMENT AND WIRING COMPLETE!");
  console.log("New Vault Address:", vaultAddress);
  console.log("New Receiver Address:", receiverAddress);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
