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

  const musdAddress = "0x22c7832ae38ebeb7003fa66b5184fc3361f3c2d1" as Address;
  const receiverAddress =
    "0xae10b473c6502ea707657dca72e410adf13e41a6" as Address;
  const dispatcherAddress =
    "0xbe142e597b7c20858a626310ec10259b8ae337da" as Address;

  // The 4 canonical collateral tokens and feeds
  const TOKENS: Address[] = [
    "0x4200000000000000000000000000000000000006", // WETH
    "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC
    "0xE4aB69C077896252FAFBD49EFD26B5D171A32410", // LINK
    "0x54114591963CF60EF3aA63bEfD6eC263D98145a4", // WBTC
  ];

  const FEEDS: Address[] = [
    "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1", // ETH/USD (WETH)
    "0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165", // USDC/USD
    "0xb113F5A928BCfF189C998ab20d753a47F9dE5A61", // LINK/USD
    "0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298", // BTC/USD (WBTC)
  ];

  const DECIMALS: number[] = [18, 6, 18, 8];

  const artifactsPath = path.resolve(process.cwd(), "evm/build/artifacts.json");
  const artifacts = JSON.parse(fs.readFileSync(artifactsPath, "utf-8"));

  console.log(
    "===============================================================",
  );
  console.log("Deploying Multi-Collateral Vault (WETH, USDC, LINK, WBTC)");
  console.log("Deployer / Tester:", account.address);
  const balance = await publicClient.getBalance({ address: account.address });
  console.log("ETH Balance:", formatEther(balance), "ETH");
  console.log(
    "===============================================================\n",
  );

  // 1. Deploy Multi-Collateral Vault
  console.log("1. Deploying Multi-Collateral Vault on Base Sepolia...");
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
  console.log(">>> Vault Deployed at:", vaultAddress);
  console.log(
    `BaseScan: https://sepolia.basescan.org/address/${vaultAddress}\n`,
  );

  await sleep(2500);

  // 2. Authorize new Vault as sole minter on mUSD
  console.log("2. Authorizing new Multi-Collateral Vault on mUSD Token...");
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
  if (
    (confirmedMinter as string).toLowerCase() !== vaultAddress.toLowerCase()
  ) {
    throw new Error("Minter authorization mismatch! Stop and report.");
  }

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

  // 4. Verify Supported Tokens on Vault
  const onchainTokens = (await publicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "getSupportedTokens",
  })) as Address[];

  console.log(
    ">>> Confirmed On-Chain Supported Tokens on Vault:",
    onchainTokens,
  );
  if (onchainTokens.length !== 4) {
    throw new Error("Supported token list length mismatch! Stop and report.");
  }

  // 5. Pre-fund Collateral Assets
  console.log("\n5. Pre-funding Tester Wallet with Collateral Assets...");

  const erc20Abi = parseAbi([
    "function balanceOf(address) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function deposit() payable", // WETH
  ]);

  // A. Wrap 0.003 ETH to WETH
  console.log("Wrapping 0.003 ETH to WETH...");
  const wrapTx = await walletClient.writeContract({
    address: TOKENS[0],
    abi: erc20Abi,
    functionName: "deposit",
    args: [],
    value: parseEther("0.003"),
  });
  console.log("WETH deposit Tx:", wrapTx);
  await publicClient.waitForTransactionReceipt({ hash: wrapTx });

  // B. Swap 0.0015 ETH to USDC on Uniswap
  console.log("Swapping 0.0015 ETH to USDC via Uniswap SwapRouter02...");
  const uniRouter = "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4" as Address;
  const uniAbi = parseAbi([
    "struct ExactInputSingleParams { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }",
    "function exactInputSingle(ExactInputSingleParams params) payable returns (uint256 amountOut)",
  ]);

  const swapUsdcTx = await walletClient.writeContract({
    address: uniRouter,
    abi: uniAbi,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: TOKENS[0],
        tokenOut: TOKENS[1],
        fee: 3000,
        recipient: account.address,
        amountIn: parseEther("0.0015"),
        amountOutMinimum: 0n,
        sqrtPriceLimitX96: 0n,
      },
    ],
    value: parseEther("0.0015"),
  });
  console.log("USDC Swap Tx:", swapUsdcTx);
  await publicClient.waitForTransactionReceipt({ hash: swapUsdcTx });

  // C. Swap 0.0015 ETH to LINK on Uniswap
  console.log("Swapping 0.0015 ETH to LINK via Uniswap SwapRouter02...");
  const swapLinkTx = await walletClient.writeContract({
    address: uniRouter,
    abi: uniAbi,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: TOKENS[0],
        tokenOut: TOKENS[2],
        fee: 3000,
        recipient: account.address,
        amountIn: parseEther("0.0015"),
        amountOutMinimum: 0n,
        sqrtPriceLimitX96: 0n,
      },
    ],
    value: parseEther("0.0015"),
  });
  console.log("LINK Swap Tx:", swapLinkTx);
  await publicClient.waitForTransactionReceipt({ hash: swapLinkTx });

  // D. Mint WBTC from Aave V3 Testnet Faucet
  console.log(
    "Minting 0.001 WBTC from Aave V3 Faucet (0xD9145b5F45Ad4519c7ACcD6E0A4A82e83bB8A6Dc)...",
  );
  const aaveFaucet = "0xD9145b5F45Ad4519c7ACcD6E0A4A82e83bB8A6Dc" as Address;
  const faucetAbi = parseAbi([
    "function mint(address token, address to, uint256 amount) returns (uint256)",
  ]);

  const mintWbtcTx = await walletClient.writeContract({
    address: aaveFaucet,
    abi: faucetAbi,
    functionName: "mint",
    args: [TOKENS[3], account.address, 100000n], // 0.001 WBTC (8 decimals)
  });
  console.log("WBTC Faucet Mint Tx:", mintWbtcTx);
  await publicClient.waitForTransactionReceipt({ hash: mintWbtcTx });

  await sleep(3000);

  // 6. Check Token Balances & Approve Vault
  console.log("\n6. Checking Token Balances and Approving Vault...");
  const tokenNames = ["WETH", "USDC", "LINK", "WBTC"];
  const maxApproval = parseEther("1000000000");

  for (let i = 0; i < TOKENS.length; i++) {
    const token = TOKENS[i];
    const name = tokenNames[i];
    const dec = DECIMALS[i];

    const bal = (await publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    })) as bigint;

    console.log(`- ${name} Balance: ${formatUnits(bal, dec)}`);

    const appTx = await walletClient.writeContract({
      address: token,
      abi: erc20Abi,
      functionName: "approve",
      args: [vaultAddress, maxApproval],
    });
    console.log(`  Approve ${name} Tx: ${appTx}`);
    await publicClient.waitForTransactionReceipt({ hash: appTx });
  }

  const deploymentData = {
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
    },
    receiver: {
      address: receiverAddress,
      setVaultTx: setReceiverVaultTxHash,
    },
    dispatcher: {
      address: dispatcherAddress,
    },
    tokens: {
      WETH: { address: TOKENS[0], feed: FEEDS[0], decimals: 18 },
      USDC: { address: TOKENS[1], feed: FEEDS[1], decimals: 6 },
      LINK: { address: TOKENS[2], feed: FEEDS[2], decimals: 18 },
      WBTC: { address: TOKENS[3], feed: FEEDS[3], decimals: 8 },
    },
    deployedAt: new Date().toISOString(),
  };

  const outputPath = path.resolve(
    process.cwd(),
    "evm/deployed_multicollateral_vault.json",
  );
  fs.writeFileSync(
    outputPath,
    JSON.stringify(deploymentData, null, 2),
    "utf-8",
  );

  console.log(
    "\n===============================================================",
  );
  console.log("Multi-Collateral Vault deployed, authorized, and pre-funded!");
  console.log("Saved configuration to evm/deployed_multicollateral_vault.json");
  console.log(
    "===============================================================",
  );
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
