import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  parseEther,
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

  const deploymentPath = path.resolve(
    process.cwd(),
    "evm/deployed_base_sepolia.json",
  );
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(
      "deployed_base_sepolia.json not found. Run deploy_base_sepolia.ts first.",
    );
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
  const musdAddress = deployment.mUSD.address as Address;
  const vaultAddress = deployment.vault.address as Address;

  const artifactsPath = path.resolve(process.cwd(), "evm/build/artifacts.json");
  const artifacts = JSON.parse(fs.readFileSync(artifactsPath, "utf-8"));

  console.log(
    "===============================================================",
  );
  console.log("Starting Full Vault Lifecycle Verification on Base Sepolia");
  console.log("Tester Account:", account.address);
  console.log("mUSD Token Address:", musdAddress);
  console.log("Vault Address:", vaultAddress);

  // Query live Chainlink price feed
  const livePriceWei = (await publicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "getLatestEthPrice",
  })) as bigint;
  const livePriceEth = formatEther(livePriceWei);
  console.log(
    `Live Dynamic Chainlink ETH Price: $${Number(livePriceEth).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`,
  );
  console.log(
    "===============================================================\n",
  );

  const results: any = {
    network: "base-sepolia",
    chainId: 84532,
    account: account.address,
    liveEthPriceUSD: livePriceEth,
    steps: {},
  };

  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  // STEP 1: Deposit ETH
  const depositAmount = parseEther("0.002");
  console.log(
    `[Step 1] Depositing ${formatEther(depositAmount)} ETH to Vault...`,
  );
  const depositTxHash = await walletClient.writeContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "deposit",
    args: [],
    value: depositAmount,
  });
  console.log("Deposit Tx Hash:", depositTxHash);
  console.log(`BaseScan URL: https://sepolia.basescan.org/tx/${depositTxHash}`);

  const depositReceipt = await publicClient.waitForTransactionReceipt({
    hash: depositTxHash,
  });
  if (depositReceipt.status !== "success")
    throw new Error("Deposit failed on-chain");

  await sleep(2500);

  const collateralAfterDeposit = (await publicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "collateral",
    args: [account.address],
  })) as bigint;
  console.log(
    `Recorded Vault Collateral: ${formatEther(collateralAfterDeposit)} ETH\n`,
  );

  results.steps.deposit = {
    action: "deposit",
    amountEth: formatEther(depositAmount),
    txHash: depositTxHash,
    explorerUrl: `https://sepolia.basescan.org/tx/${depositTxHash}`,
    collateralRecordedEth: formatEther(collateralAfterDeposit),
    status: depositReceipt.status,
  };

  // STEP 2: Mint mUSD
  // At dynamic ETH price (e.g. ~$2,500), 0.002 ETH = ~$5.00 USD.
  // 150% MCR requires 1.5x collateral. Max debt allowed = $5.00 / 1.5 = ~$3.33 mUSD.
  // We mint 1.0 mUSD ($1.00), giving a safe ~500% CR.
  const mintAmount = parseEther("1.0");
  console.log(
    `[Step 2] Minting ${formatEther(mintAmount)} mUSD against deposited collateral (150% MCR dynamic check)...`,
  );
  const mintTxHash = await walletClient.writeContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "mint",
    args: [mintAmount],
  });
  console.log("Mint Tx Hash:", mintTxHash);
  console.log(`BaseScan URL: https://sepolia.basescan.org/tx/${mintTxHash}`);

  const mintReceipt = await publicClient.waitForTransactionReceipt({
    hash: mintTxHash,
  });
  if (mintReceipt.status !== "success") throw new Error("Mint failed on-chain");

  await sleep(2500);

  const musdBalanceAfterMint = (await publicClient.readContract({
    address: musdAddress,
    abi: artifacts.mUSD.abi,
    functionName: "balanceOf",
    args: [account.address],
  })) as bigint;

  const debtAfterMint = (await publicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "debt",
    args: [account.address],
  })) as bigint;

  console.log(
    `User mUSD Wallet Balance: ${formatEther(musdBalanceAfterMint)} mUSD`,
  );
  console.log(`User Recorded Vault Debt: ${formatEther(debtAfterMint)} mUSD\n`);

  results.steps.mint = {
    action: "mint",
    amountMusd: formatEther(mintAmount),
    txHash: mintTxHash,
    explorerUrl: `https://sepolia.basescan.org/tx/${mintTxHash}`,
    musdBalanceRecorded: formatEther(musdBalanceAfterMint),
    debtRecorded: formatEther(debtAfterMint),
    status: mintReceipt.status,
  };

  // STEP 3: Repay mUSD
  // User repays the 1.0 mUSD debt. Vault burns it directly from user's balance.
  console.log(`[Step 3] Repaying ${formatEther(mintAmount)} mUSD to Vault...`);
  const repayTxHash = await walletClient.writeContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "repay",
    args: [mintAmount],
  });
  console.log("Repay Tx Hash:", repayTxHash);
  console.log(`BaseScan URL: https://sepolia.basescan.org/tx/${repayTxHash}`);

  const repayReceipt = await publicClient.waitForTransactionReceipt({
    hash: repayTxHash,
  });
  if (repayReceipt.status !== "success")
    throw new Error("Repay failed on-chain");

  await sleep(2500);

  const musdBalanceAfterRepay = (await publicClient.readContract({
    address: musdAddress,
    abi: artifacts.mUSD.abi,
    functionName: "balanceOf",
    args: [account.address],
  })) as bigint;

  const debtAfterRepay = (await publicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "debt",
    args: [account.address],
  })) as bigint;

  console.log(
    `User mUSD Wallet Balance after Repay: ${formatEther(musdBalanceAfterRepay)} mUSD`,
  );
  console.log(
    `User Recorded Vault Debt after Repay: ${formatEther(debtAfterRepay)} mUSD\n`,
  );

  results.steps.repay = {
    action: "repay",
    amountMusd: formatEther(mintAmount),
    txHash: repayTxHash,
    explorerUrl: `https://sepolia.basescan.org/tx/${repayTxHash}`,
    musdBalanceRecorded: formatEther(musdBalanceAfterRepay),
    debtRecorded: formatEther(debtAfterRepay),
    status: repayReceipt.status,
  };

  // STEP 4: Withdraw Collateral ETH
  // With 0 debt, user withdraws all safely collateralized ETH (0.002 ETH).
  console.log(
    `[Step 4] Withdrawing remaining ${formatEther(depositAmount)} ETH collateral...`,
  );
  const withdrawTxHash = await walletClient.writeContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "withdraw",
    args: [depositAmount],
  });
  console.log("Withdraw Tx Hash:", withdrawTxHash);
  console.log(
    `BaseScan URL: https://sepolia.basescan.org/tx/${withdrawTxHash}`,
  );

  const withdrawReceipt = await publicClient.waitForTransactionReceipt({
    hash: withdrawTxHash,
  });
  if (withdrawReceipt.status !== "success")
    throw new Error("Withdrawal failed on-chain");

  await sleep(2500);

  const collateralAfterWithdraw = (await publicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "collateral",
    args: [account.address],
  })) as bigint;
  console.log(
    `Recorded Vault Collateral after Withdraw: ${formatEther(collateralAfterWithdraw)} ETH\n`,
  );

  results.steps.withdraw = {
    action: "withdraw",
    amountEth: formatEther(depositAmount),
    txHash: withdrawTxHash,
    explorerUrl: `https://sepolia.basescan.org/tx/${withdrawTxHash}`,
    remainingCollateralEth: formatEther(collateralAfterWithdraw),
    status: withdrawReceipt.status,
  };

  const finalBalance = await publicClient.getBalance({
    address: account.address,
  });
  console.log("Final Wallet ETH Balance:", formatEther(finalBalance), "ETH");

  const testResultsPath = path.resolve(
    process.cwd(),
    "evm/test_vault_results.json",
  );
  fs.writeFileSync(testResultsPath, JSON.stringify(results, null, 2), "utf-8");

  console.log(
    "\n===============================================================",
  );
  console.log("ALL 4 STEPS OF THE VAULT LIFECYCLE COMPLETED SUCCESSFULLY!");
  console.log("Detailed results saved to evm/test_vault_results.json");
  console.log(
    "===============================================================",
  );
}

main().catch((err) => {
  console.error("Test loop failed:", err);
  process.exit(1);
});
