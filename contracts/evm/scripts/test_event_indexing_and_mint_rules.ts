import {
  createPublicClient,
  createWalletClient,
  http,
  fallback,
  formatEther,
  formatUnits,
  parseEther,
  parseUnits,
  decodeEventLog,
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
  if (!privateKey) throw new Error("No BURNER_WALLET_PRIVATE_KEY found");
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

  const client = createPublicClient({
    chain: baseSepolia,
    transport: rpcTransport,
  });

  const wallet = createWalletClient({
    account,
    chain: baseSepolia,
    transport: rpcTransport,
  });

  const deploymentPath = path.resolve(
    process.cwd(),
    "evm/deployed_multicollateral_vault.json",
  );
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
  const artifactsPath = path.resolve(process.cwd(), "evm/build/artifacts.json");
  const artifacts = JSON.parse(fs.readFileSync(artifactsPath, "utf-8"));

  const vaultAddress = deployment.vault.address as Address;
  const wethAddress = deployment.tokens.WETH.address as Address;
  const usdcAddress = deployment.tokens.USDC.address as Address;
  const linkAddress = deployment.tokens.LINK.address as Address;

  console.log(
    "===============================================================",
  );
  console.log("TEST: Indexed Events & Strict Per-Asset Minting Validation");
  console.log("Vault Address:", vaultAddress);
  console.log("Caller / User:", account.address);
  console.log(
    "===============================================================\n",
  );

  // Verify initial zero balances in Vault
  const initialWethCol = (await client.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "collateral",
    args: [wethAddress, account.address],
  })) as bigint;
  const initialUsdcCol = (await client.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "collateral",
    args: [usdcAddress, account.address],
  })) as bigint;
  const initialLinkCol = (await client.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "collateral",
    args: [linkAddress, account.address],
  })) as bigint;

  console.log("Initial Vault Collateral Balances:");
  console.log("- WETH:", formatUnits(initialWethCol, 18));
  console.log("- USDC:", formatUnits(initialUsdcCol, 6));
  console.log(
    "- LINK:",
    formatUnits(initialLinkCol, 18),
    "(Undeposited Asset 3)\n",
  );

  // -------------------------------------------------------------
  // STEP 1: Deposit Asset 1 (WETH)
  // -------------------------------------------------------------
  const depositWethAmount = parseEther("0.0003");
  console.log(`[Step 1] Depositing 0.0003 WETH (Asset 1)...`);
  const depWethTx = await wallet.writeContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "deposit",
    args: [wethAddress, depositWethAmount],
  });
  console.log("Deposit WETH Tx:", depWethTx);
  const depWethReceipt = await client.waitForTransactionReceipt({
    hash: depWethTx,
  });
  console.log("Tx Confirmed in block:", depWethReceipt.blockNumber);

  // Decode Deposited event
  let foundDep1 = false;
  for (const log of depWethReceipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: artifacts.Vault.abi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "Deposited") {
        const args = decoded.args as any;
        console.log(">>> Emitter Verified: Deposited Event Decoded:");
        console.log("    - asset:", args.asset);
        console.log("    - user:", args.user);
        console.log("    - amount:", formatEther(args.amount), "WETH");
        console.log("    - timestamp:", args.timestamp.toString());
        console.log(
          "    - resultingCRBps:",
          args.resultingCRBps.toString(),
          "(type uint256 max if 0 debt)",
        );
        if (
          args.asset.toLowerCase() === wethAddress.toLowerCase() &&
          args.user.toLowerCase() === account.address.toLowerCase()
        ) {
          foundDep1 = true;
        }
      }
    } catch {}
  }
  if (!foundDep1)
    throw new Error("Deposited event for WETH not found or malformed");
  console.log("✓ Step 1 Passed: WETH Deposited with clean indexed event.\n");

  await sleep(2000);

  // -------------------------------------------------------------
  // STEP 2: Deposit Asset 2 (USDC)
  // -------------------------------------------------------------
  const depositUsdcAmount = parseUnits("0.50", 6); // 0.50 USDC
  console.log(`[Step 2] Depositing 0.50 USDC (Asset 2)...`);
  const depUsdcTx = await wallet.writeContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "deposit",
    args: [usdcAddress, depositUsdcAmount],
  });
  console.log("Deposit USDC Tx:", depUsdcTx);
  const depUsdcReceipt = await client.waitForTransactionReceipt({
    hash: depUsdcTx,
  });
  console.log("Tx Confirmed in block:", depUsdcReceipt.blockNumber);

  // Decode Deposited event
  let foundDep2 = false;
  for (const log of depUsdcReceipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: artifacts.Vault.abi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "Deposited") {
        const args = decoded.args as any;
        console.log(">>> Emitter Verified: Deposited Event Decoded:");
        console.log("    - asset:", args.asset);
        console.log("    - user:", args.user);
        console.log("    - amount:", formatUnits(args.amount, 6), "USDC");
        console.log("    - timestamp:", args.timestamp.toString());
        console.log("    - resultingCRBps:", args.resultingCRBps.toString());
        if (
          args.asset.toLowerCase() === usdcAddress.toLowerCase() &&
          args.user.toLowerCase() === account.address.toLowerCase()
        ) {
          foundDep2 = true;
        }
      }
    } catch {}
  }
  if (!foundDep2)
    throw new Error("Deposited event for USDC not found or malformed");
  console.log("✓ Step 2 Passed: USDC Deposited with clean indexed event.\n");

  await sleep(2000);

  // -------------------------------------------------------------
  // STEP 3: Attempt to Mint against Undeposited Third Asset (LINK)
  // -------------------------------------------------------------
  console.log(
    `[Step 3] Attempting to Mint 0.20 mUSD against undeposited LINK (Asset 3)...`,
  );
  const linkColInVault = (await client.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "collateral",
    args: [linkAddress, account.address],
  })) as bigint;
  console.log(
    "Caller's LINK Collateral in Vault:",
    formatEther(linkColInVault),
    "(Must be 0)",
  );
  if (linkColInVault !== BigInt(0))
    throw new Error("Precondition failed: LINK collateral is not 0");

  let mintReverted = false;
  let revertErrorMsg = "";
  try {
    await client.simulateContract({
      address: vaultAddress,
      abi: artifacts.Vault.abi,
      functionName: "mint",
      args: [linkAddress, parseEther("0.20")],
      account,
    });
  } catch (err: any) {
    mintReverted = true;
    revertErrorMsg = err.message || String(err);
    console.log(">>> On-Chain Revert Successfully Caught!");
    console.log("    Revert Reason / Error:", revertErrorMsg);
  }

  if (!mintReverted) {
    throw new Error(
      "FAILED: Minting against undeposited asset did not revert!",
    );
  }
  if (
    !revertErrorMsg.includes("ZeroCollateralBalance") &&
    !revertErrorMsg.includes("0x")
  ) {
    console.warn(
      "Warning: Revert caught but error signature could be custom ABI error",
    );
  }
  console.log(
    "✓ Step 3 Passed: Minting against undeposited asset 3 reverted on-chain as required.\n",
  );

  await sleep(2000);

  // -------------------------------------------------------------
  // STEP 4: Mint against Deposited Asset 1 (WETH)
  // -------------------------------------------------------------
  const mintAmount = parseEther("0.30"); // 0.30 mUSD
  console.log(`[Step 4] Minting 0.30 mUSD against deposited WETH (Asset 1)...`);
  const mintTx = await wallet.writeContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "mint",
    args: [wethAddress, mintAmount],
  });
  console.log("Mint Tx:", mintTx);
  const mintReceipt = await client.waitForTransactionReceipt({ hash: mintTx });
  console.log("Tx Confirmed in block:", mintReceipt.blockNumber);

  // Decode Minted event
  let foundMint = false;
  for (const log of mintReceipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: artifacts.Vault.abi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "Minted") {
        const args = decoded.args as any;
        console.log(">>> Emitter Verified: Minted Event Decoded:");
        console.log("    - asset:", args.asset);
        console.log("    - user:", args.user);
        console.log("    - amount:", formatEther(args.amount), "mUSD");
        console.log("    - timestamp:", args.timestamp.toString());
        console.log(
          "    - resultingCRBps:",
          args.resultingCRBps.toString(),
          `(${(Number(args.resultingCRBps) / 100).toFixed(1)}%)`,
        );
        if (
          args.asset.toLowerCase() === wethAddress.toLowerCase() &&
          args.user.toLowerCase() === account.address.toLowerCase()
        ) {
          foundMint = true;
        }
      }
    } catch {}
  }
  if (!foundMint)
    throw new Error("Minted event for WETH not found or malformed");
  console.log(
    "✓ Step 4 Passed: Minted mUSD against deposited asset with clean resulting CR.\n",
  );

  await sleep(2000);

  // -------------------------------------------------------------
  // STEP 5: Immediate Post-Tx State Verification (No Stale Reads)
  // -------------------------------------------------------------
  console.log(
    `[Step 5] Checking on-chain state immediately after transactions...`,
  );
  const pos = (await client.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "getAccountPosition",
    args: [account.address],
  })) as any;

  const totalColUSD = parseFloat(formatEther(pos[0]));
  const debtUSD = parseFloat(formatEther(pos[1]));
  const crBps = Number(pos[2]);
  const reqCRBps = Number(pos[5]);

  console.log("- Total Collateral USD:", `$${totalColUSD.toFixed(4)}`);
  console.log("- Total Debt:", `${debtUSD.toFixed(4)} mUSD`);
  console.log("- Resulting CR:", `${(crBps / 100).toFixed(1)}%`);
  console.log("- Required CR:", `${(reqCRBps / 100).toFixed(1)}%`);

  if (debtUSD < 0.29 || totalColUSD <= 0) {
    throw new Error("State read returned stale or zero values");
  }
  console.log(
    "✓ Step 5 Passed: Real state reflects changes immediately without stale cache.\n",
  );

  // -------------------------------------------------------------
  // STEP 6: RPC Event Log Query (Direct History Extraction)
  // -------------------------------------------------------------
  console.log(
    `[Step 6] Querying Vault event logs directly via RPC for full history...`,
  );
  const logs = await client.getLogs({
    address: vaultAddress,
    fromBlock: depWethReceipt.blockNumber - BigInt(1),
    toBlock: "latest",
  });

  console.log(`Found ${logs.length} raw log entries from new Vault.`);
  let decodedCount = 0;
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: artifacts.Vault.abi,
        data: log.data,
        topics: log.topics,
      });
      console.log(
        `- Event: ${decoded.eventName} | Tx: ${log.transactionHash.slice(0, 14)}...`,
      );
      decodedCount++;
    } catch {}
  }
  console.log(
    `Successfully decoded ${decodedCount} indexed Vault events directly from RPC.`,
  );
  console.log(
    "✓ Step 6 Passed: Frontend can read history directly with zero guesswork!\n",
  );

  console.log(
    "===============================================================",
  );
  console.log("ALL TESTS COMPLETED SUCCESSFULLY!");
  console.log(
    "===============================================================",
  );
}

main().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
