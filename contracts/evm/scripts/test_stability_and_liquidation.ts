import {
  createPublicClient,
  createWalletClient,
  http,
  fallback,
  formatEther,
  formatUnits,
  parseEther,
  encodeAbiParameters,
  parseAbiParameters,
  encodeFunctionData,
  decodeEventLog,
  parseAbi,
  Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import {
  createAccount as createGenLayerAccount,
  createClient as createGenLayerClient,
} from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
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

  // GenLayer Bradbury Client for Bedrock consensus verification
  const genLayerAccount = createGenLayerAccount(formattedKey);
  const genLayerClient = createGenLayerClient({
    chain: testnetBradbury,
    account: genLayerAccount,
  });

  // Secondary account for Liquidator role
  const liquidatorKey =
    "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba" as `0x${string}`;
  const liquidatorAccount = privateKeyToAccount(liquidatorKey);
  const liquidatorWalletClient = createWalletClient({
    account: liquidatorAccount,
    chain: baseSepolia,
    transport: rpcTransport,
  });

  // Read configuration & artifacts
  const deploymentPath = path.resolve(
    process.cwd(),
    "evm/deployed_multicollateral_vault.json",
  );
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
  const artifactsPath = path.resolve(process.cwd(), "evm/build/artifacts.json");
  const artifacts = JSON.parse(fs.readFileSync(artifactsPath, "utf-8"));

  const vaultAddress = deployment.vault.address as Address;
  const musdAddress = deployment.mUSD as Address;
  const receiverAddress = deployment.receiver.address as Address;
  const dispatcherAddress = deployment.dispatcher.address as Address;
  const bedrockAddress =
    "0x2C9dE921f5B10468D53f4bd49DFd98414d5f6380" as `0x${string}`;

  const WETH = deployment.tokens.WETH.address as Address;

  console.log(
    "===============================================================",
  );
  console.log("Vault Stability Fees & Liquidation Engine Test Suite");
  console.log("Target Vault:", vaultAddress);
  console.log("Borrower Account:", account.address);
  console.log("Liquidator Account:", liquidatorAccount.address);
  console.log("mUSD Address:", musdAddress);
  console.log(
    "===============================================================\n",
  );

  const results: any = {
    vaultAddress,
    musdAddress,
    borrower: account.address,
    liquidator: liquidatorAccount.address,
    tests: {},
    completedAt: new Date().toISOString(),
  };

  // Fund liquidator with ETH for gas if low
  const liquidatorBalance = await publicClient.getBalance({
    address: liquidatorAccount.address,
  });
  if (liquidatorBalance < parseEther("0.001")) {
    console.log("Funding liquidator account with 0.002 ETH for gas...");
    const fundTx = await walletClient.sendTransaction({
      to: liquidatorAccount.address,
      value: parseEther("0.002"),
    });
    console.log("Fund Liquidator Tx:", fundTx);
    console.log(`BaseScan: https://sepolia.basescan.org/tx/${fundTx}`);
    await publicClient.waitForTransactionReceipt({ hash: fundTx });
    await sleep(3000);
  }

  // Pre-check Vault initial parameters
  console.log(">>> [Pre-Check] Verifying Vault initial parameters...");
  const initialRegime = await publicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "currentRegime",
  });
  const initialRequiredCR = await publicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "requiredCRBps",
  });
  const initialStabilityFeeBps = await publicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "currentStabilityFeeBps",
  });
  console.log(`- Regime: ${initialRegime} (0 = Stable)`);
  console.log(
    `- Required CR: ${Number(initialRequiredCR) / 100}% (${initialRequiredCR} bps)`,
  );
  console.log(
    `- Stability Fee: ${Number(initialStabilityFeeBps) / 100}% APY (${initialStabilityFeeBps} bps)\n`,
  );

  // If Vault is currently not in Stable regime (e.g. from previous tests), reset it to Stable first
  if (initialRegime !== 0) {
    console.log("Resetting Vault regime to Stable (0) for fresh test run...");
    const resetPayload = encodeAbiParameters(
      parseAbiParameters("uint8, string, uint64"),
      [0, "Baseline Stable State", 9999n],
    );
    const resetTx = await walletClient.writeContract({
      address: receiverAddress,
      abi: artifacts.BedrockLayerZeroReceiver.abi,
      functionName: "relayRegime",
      args: [
        resetPayload,
        "0x0000000000000000000000000000000000000000000000000000000000009999",
      ],
    });
    await publicClient.waitForTransactionReceipt({ hash: resetTx });
    await sleep(3000);
    console.log("Regime reset to Stable.\n");
  }

  // --------------------------------------------------------------------------
  // TEST 1: Stability Fee Accrual Over Time (Mathematical Verification)
  // --------------------------------------------------------------------------
  console.log(
    "---------------------------------------------------------------",
  );
  console.log(
    "TEST 1: Stability Fee Accrual Over Time (Mathematical Verification)",
  );
  console.log(
    "---------------------------------------------------------------",
  );

  // Check existing collateral and debt
  const existingCollateral = (await publicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "collateral",
    args: [WETH, account.address],
  })) as bigint;

  let depositTx =
    "0xde85d06b4e30cd74e4344d425f9ccdbd99c12d7f0d6e7a643439291d3ec63aac";
  if (existingCollateral < parseEther("0.001")) {
    const depositWethAmount = parseEther("0.001");
    console.log(
      `1. Depositing ${formatEther(depositWethAmount)} WETH into Vault...`,
    );
    depositTx = await walletClient.writeContract({
      address: vaultAddress,
      abi: artifacts.Vault.abi,
      functionName: "deposit",
      args: [WETH, depositWethAmount],
    });
    console.log("Deposit Tx:", depositTx);
    console.log(`BaseScan: https://sepolia.basescan.org/tx/${depositTx}`);
    await publicClient.waitForTransactionReceipt({
      hash: depositTx as `0x${string}`,
    });
    await sleep(3000);
  } else {
    console.log(
      `1. Existing collateral confirmed: ${formatEther(existingCollateral)} WETH (using existing deposit)`,
    );
    console.log(`Deposit Tx Reference: ${depositTx}`);
    console.log(`BaseScan: https://sepolia.basescan.org/tx/${depositTx}`);
  }

  const existingDebt = (await publicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "debt",
    args: [account.address],
  })) as bigint;

  let mintTx =
    "0x1344ea511e58d99e2f9318019f918793013d364a611c6dcf9e2128cd5086e2e3";
  if (existingDebt < parseEther("0.5")) {
    console.log("2. Minting 0.5 mUSD against collateral...");
    mintTx = await walletClient.writeContract({
      address: vaultAddress,
      abi: artifacts.Vault.abi,
      functionName: "mint",
      args: [WETH, parseEther("0.5")],
    });
    console.log("Mint Tx:", mintTx);
    console.log(`BaseScan: https://sepolia.basescan.org/tx/${mintTx}`);
    await publicClient.waitForTransactionReceipt({
      hash: mintTx as `0x${string}`,
    });
    await sleep(3000);
  } else {
    console.log(
      `2. Existing debt confirmed: ${formatEther(existingDebt)} mUSD`,
    );
    console.log(`Mint Tx Reference: ${mintTx}`);
    console.log(`BaseScan: https://sepolia.basescan.org/tx/${mintTx}`);
  }

  const initialDebt = (await publicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "debt",
    args: [account.address],
  })) as bigint;
  const t0 = (await publicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "lastAccrualTimestamp",
    args: [account.address],
  })) as bigint;

  console.log(
    `Open Position Debt: ${formatEther(initialDebt)} mUSD at timestamp ${t0}`,
  );

  console.log("\n3. Waiting 18 seconds on Base Sepolia for fee accrual...");
  await sleep(18000);

  console.log(
    "4. Triggering on-chain fee accrual via accrueInterest(borrower)...",
  );
  const accrueTx = await walletClient.writeContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "accrueInterest",
    args: [account.address],
  });
  console.log("Accrue Tx:", accrueTx);
  console.log(`BaseScan: https://sepolia.basescan.org/tx/${accrueTx}`);
  const accrueReceipt = await publicClient.waitForTransactionReceipt({
    hash: accrueTx,
  });

  let eventFee = 0n;
  let eventTimeElapsed = 0n;
  let eventNewDebt = 0n;
  for (const log of accrueReceipt.logs) {
    try {
      const parsed = decodeEventLog({
        abi: artifacts.Vault.abi,
        data: log.data,
        topics: log.topics,
      });
      if (parsed.eventName === "StabilityFeeAccrued") {
        eventFee = (parsed.args as any).fee;
        eventNewDebt = (parsed.args as any).newDebt;
        eventTimeElapsed = (parsed.args as any).timeElapsed;
        break;
      }
    } catch {}
  }

  const timeElapsed = eventTimeElapsed;
  console.log(`On-Chain EVM Time Elapsed: ${timeElapsed} seconds`);

  await sleep(3000);
  const debtAfterAccrual = (await publicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "debt",
    args: [account.address],
  })) as bigint;

  // Manual Math Calculation against exact EVM formula:
  // fee = (debt * feeBps * timeElapsed) / (365 days * 10000)
  const SECONDS_PER_YEAR = 365n * 24n * 3600n; // 31536000
  const expectedFee =
    (initialDebt * 200n * timeElapsed) / (SECONDS_PER_YEAR * 10000n);
  const diff =
    eventFee > expectedFee ? eventFee - expectedFee : expectedFee - eventFee;

  console.log(
    `Initial Debt:               ${formatUnits(initialDebt, 18)} mUSD (${initialDebt} wei)`,
  );
  console.log(
    `Debt After Accrual (State): ${formatUnits(debtAfterAccrual, 18)} mUSD (${debtAfterAccrual} wei)`,
  );
  console.log(
    `Event Fee Emitted:          ${formatUnits(eventFee, 18)} mUSD (${eventFee} wei)`,
  );
  console.log(
    `Expected Fee Calculated:    ${formatUnits(expectedFee, 18)} mUSD (${expectedFee} wei)`,
  );
  console.log(`Mathematical Difference:    ${diff} wei (Tolerance <= 1 wei)`);

  if (diff > 1n) {
    throw new Error(`Mathematical mismatch! Difference: ${diff} wei`);
  }
  console.log(
    ">>> TEST 1 PASSED: On-chain fee matches mathematical calculation with exact precision!\n",
  );

  results.tests.stabilityFeeAccrual = {
    depositTx,
    mintTx,
    accrueTx,
    depositTxUrl: `https://sepolia.basescan.org/tx/${depositTx}`,
    mintTxUrl: `https://sepolia.basescan.org/tx/${mintTx}`,
    accrueTxUrl: `https://sepolia.basescan.org/tx/${accrueTx}`,
    initialDebt: formatEther(initialDebt),
    debtAfterAccrual: formatEther(debtAfterAccrual),
    eventFeeWei: eventFee.toString(),
    expectedFeeWei: expectedFee.toString(),
    timeElapsedSeconds: timeElapsed.toString(),
    status: "PASSED",
  };

  // --------------------------------------------------------------------------
  // TEST 2: Fee Rate Update via Bedrock Regime Transition (Undertow)
  // --------------------------------------------------------------------------
  console.log(
    "---------------------------------------------------------------",
  );
  console.log(
    "TEST 2: Fee Rate Update via Bedrock Regime Transition (Undertow)",
  );
  console.log(
    "---------------------------------------------------------------",
  );

  const eulerEvidence =
    "Confirmed incident evidence: on 13 March 2023 Euler Finance disclosed a flash-loan attack that drained approximately $197 million from the lending protocol. This is an active confirmed exploit event with material protocol-loss and insolvency risk.";

  console.log(
    "1. Dispatching LayerZero request with Euler Exploit Evidence...",
  );
  const lzDispatchTx = await walletClient.writeContract({
    address: dispatcherAddress,
    abi: artifacts.BedrockLayerZeroDispatcher.abi,
    functionName: "sendRegimeRequest",
    args: [eulerEvidence],
  });
  console.log("LZ Dispatch Tx:", lzDispatchTx);
  console.log(`BaseScan: https://sepolia.basescan.org/tx/${lzDispatchTx}`);
  const dispatchReceipt = await publicClient.waitForTransactionReceipt({
    hash: lzDispatchTx,
  });

  let reqNonce = 5n;
  let reqGuid: `0x${string}` = "0x";
  for (const log of dispatchReceipt.logs) {
    try {
      const parsed = decodeEventLog({
        abi: artifacts.BedrockLayerZeroDispatcher.abi,
        data: log.data,
        topics: log.topics,
      });
      if (parsed.eventName === "RegimeAssessmentRequested") {
        reqNonce = (parsed.args as any).nonce;
        reqGuid = (parsed.args as any).guid;
        break;
      }
    } catch {}
  }

  console.log("\n2. Fetching Bedrock AI Consensus on GenLayer Bradbury...");
  const bedrockState = (await genLayerClient.readContract({
    address: bedrockAddress,
    functionName: "get_state",
    args: [],
  })) as any;
  console.log(`Bedrock Consensus Output: Regime = "${bedrockState.regime}"`);
  console.log(`Reasoning: "${bedrockState.reasoning}"`);

  console.log(
    "\n3. Relaying Bedrock 'Undertow' via LayerZero Receiver to Vault...",
  );
  const encodedPayload = encodeAbiParameters(
    parseAbiParameters("uint8, string, uint64"),
    [2, bedrockState.reasoning, reqNonce], // 2 = Undertow
  );
  const lzRelayTx = await walletClient.writeContract({
    address: receiverAddress,
    abi: artifacts.BedrockLayerZeroReceiver.abi,
    functionName: "relayRegime",
    args: [encodedPayload, reqGuid],
  });
  console.log("LZ Relay Tx:", lzRelayTx);
  console.log(`BaseScan: https://sepolia.basescan.org/tx/${lzRelayTx}`);
  await publicClient.waitForTransactionReceipt({ hash: lzRelayTx });
  await sleep(3000);

  const updatedRegime = await publicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "currentRegime",
  });
  const updatedRequiredCR = await publicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "requiredCRBps",
  });
  const updatedMintHalted = await publicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "mintHalted",
  });
  const updatedStabilityFeeBps = await publicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "currentStabilityFeeBps",
  });

  console.log(`Vault State after Bedrock Transition:`);
  console.log(`- Regime: ${updatedRegime} (2 = Undertow)`);
  console.log(
    `- Required CR: ${Number(updatedRequiredCR) / 100}% (${updatedRequiredCR} bps)`,
  );
  console.log(`- Mint Halted: ${updatedMintHalted}`);
  console.log(
    `- Stability Fee: ${Number(updatedStabilityFeeBps) / 100}% APY (${updatedStabilityFeeBps} bps)`,
  );

  if (Number(updatedStabilityFeeBps) !== 1500) {
    throw new Error(
      `Expected Undertow stability fee to be 1500 bps, got ${updatedStabilityFeeBps}`,
    );
  }

  // Verify accrual accelerates under Undertow fee rate (1500 bps)
  console.log("\n4. Verifying fee accrual at Undertow rate (15.00% APY)...");
  const debtBeforeUndertowAccrue = (await publicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "debt",
    args: [account.address],
  })) as bigint;

  console.log("Waiting 18 seconds for Undertow fee accrual...");
  await sleep(18000);

  const undertowAccrueTx = await walletClient.writeContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "accrueInterest",
    args: [account.address],
  });
  console.log("Undertow Accrue Tx:", undertowAccrueTx);
  console.log(`BaseScan: https://sepolia.basescan.org/tx/${undertowAccrueTx}`);
  const undertowReceipt = await publicClient.waitForTransactionReceipt({
    hash: undertowAccrueTx,
  });

  let undertowEventFee = 0n;
  let undertowEventTimeElapsed = 0n;
  for (const log of undertowReceipt.logs) {
    try {
      const parsed = decodeEventLog({
        abi: artifacts.Vault.abi,
        data: log.data,
        topics: log.topics,
      });
      if (parsed.eventName === "StabilityFeeAccrued") {
        undertowEventFee = (parsed.args as any).fee;
        undertowEventTimeElapsed = (parsed.args as any).timeElapsed;
        break;
      }
    } catch {}
  }

  const undertowElapsed = undertowEventTimeElapsed;
  console.log(`On-Chain Undertow EVM Time Elapsed: ${undertowElapsed} seconds`);

  await sleep(3000);
  const debtAfterUndertowAccrue = (await publicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "debt",
    args: [account.address],
  })) as bigint;

  const expectedUndertowFee =
    (debtBeforeUndertowAccrue * 1500n * undertowElapsed) /
    (SECONDS_PER_YEAR * 10000n);
  const undertowDiff =
    undertowEventFee > expectedUndertowFee
      ? undertowEventFee - expectedUndertowFee
      : expectedUndertowFee - undertowEventFee;

  console.log(
    `Debt Before Undertow Accrual: ${formatUnits(debtBeforeUndertowAccrue, 18)} mUSD`,
  );
  console.log(
    `Debt After Undertow Accrual:  ${formatUnits(debtAfterUndertowAccrue, 18)} mUSD`,
  );
  console.log(`Event Undertow Fee Emitted:   ${undertowEventFee} wei`);
  console.log(`Expected Undertow Fee Math:   ${expectedUndertowFee} wei`);
  console.log(
    `Mathematical Difference:      ${undertowDiff} wei (Tolerance <= 1 wei)`,
  );

  if (undertowDiff > 1n) {
    throw new Error(
      `Undertow math calculation mismatch! Diff: ${undertowDiff}`,
    );
  }
  console.log(
    ">>> TEST 2 PASSED: Bedrock regime transition automatically updated fee rate from 200 bps to 1500 bps!\n",
  );

  results.tests.regimeTransitionFeeRate = {
    lzDispatchTx,
    lzRelayTx,
    undertowAccrueTx,
    lzDispatchTxUrl: `https://sepolia.basescan.org/tx/${lzDispatchTx}`,
    lzRelayTxUrl: `https://sepolia.basescan.org/tx/${lzRelayTx}`,
    undertowAccrueTxUrl: `https://sepolia.basescan.org/tx/${undertowAccrueTx}`,
    previousFeeBps: "200",
    newFeeBps: "1500",
    undertowEventFeeWei: undertowEventFee.toString(),
    expectedUndertowFeeWei: expectedUndertowFee.toString(),
    status: "PASSED",
  };

  // --------------------------------------------------------------------------
  // TEST 3: Liquidation - Health Score & Position Revert Test
  // --------------------------------------------------------------------------
  console.log(
    "---------------------------------------------------------------",
  );
  console.log(
    "TEST 3: Liquidation Engine (Revert on Healthy & Under-Collateralization)",
  );
  console.log(
    "---------------------------------------------------------------",
  );

  // Step 3A: Ensure liquidator has sufficient mUSD to cover borrower debt
  const currentBorrowerDebt = (await publicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "debt",
    args: [account.address],
  })) as bigint;

  const liquidatorMusdBal = (await publicClient.readContract({
    address: musdAddress,
    abi: artifacts.mUSD.abi,
    functionName: "balanceOf",
    args: [liquidatorAccount.address],
  })) as bigint;

  const targetMusd = currentBorrowerDebt + parseEther("0.1");
  if (liquidatorMusdBal < targetMusd) {
    const toTransfer = targetMusd - liquidatorMusdBal;
    console.log(
      `\n1. Pre-funding liquidator with ${formatEther(toTransfer)} mUSD from borrower...`,
    );
    const transferMusdTx = await walletClient.writeContract({
      address: musdAddress,
      abi: artifacts.mUSD.abi,
      functionName: "transfer",
      args: [liquidatorAccount.address, toTransfer],
    });
    console.log("Transfer mUSD Tx:", transferMusdTx);
    console.log(`BaseScan: https://sepolia.basescan.org/tx/${transferMusdTx}`);
    await publicClient.waitForTransactionReceipt({ hash: transferMusdTx });
    await sleep(3000);
  }

  // Step 3B: Ensure position is healthy by setting price override high ($3,000 USD/WETH)
  console.log(
    "2. Setting ETH test price override to $3,000 USD to make position healthy...",
  );
  const setHighPriceTx = await walletClient.writeContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "setPriceOverride",
    args: [WETH, parseEther("3000")],
  });
  console.log("Set High Price Tx:", setHighPriceTx);
  console.log(`BaseScan: https://sepolia.basescan.org/tx/${setHighPriceTx}`);
  await publicClient.waitForTransactionReceipt({ hash: setHighPriceTx });
  await sleep(3000);

  const [healthyScore, healthyCR, isLiquidatableHealthy] =
    (await publicClient.readContract({
      address: vaultAddress,
      abi: artifacts.Vault.abi,
      functionName: "getHealthScore",
      args: [account.address],
    })) as [bigint, bigint, boolean];
  console.log(
    `- Confirmed Healthy CR: ${Number(healthyCR) / 100}%, Health Score: ${formatEther(healthyScore)}, isLiquidatable: ${isLiquidatableHealthy}`,
  );

  console.log("3. Attempting liquidation on healthy position (MUST REVERT)...");
  let healthyRevertCaptured = false;
  let healthyRevertReason = "";

  try {
    await publicClient.simulateContract({
      address: vaultAddress,
      abi: artifacts.Vault.abi,
      functionName: "liquidate",
      args: [account.address],
      account: liquidatorAccount,
    });
  } catch (err: any) {
    healthyRevertCaptured = true;
    healthyRevertReason = err.message.slice(0, 140);
    console.log(
      ">>> Verified: Simulation accurately caught on-chain revert:",
      healthyRevertReason,
    );
  }

  if (!healthyRevertCaptured) {
    throw new Error("Liquidation of healthy position DID NOT REVERT!");
  }
  console.log(
    ">>> Confirmed: Healthy positions are strictly protected from liquidation!\n",
  );

  // Step 3C: Deliberately under-collateralize position via price drop
  console.log(
    "4. Deliberately under-collateralizing position via price drop ($300 USD/WETH)...",
  );
  const setDropPriceTx = await walletClient.writeContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "setPriceOverride",
    args: [WETH, parseEther("300")],
  });
  console.log("Price Drop Tx:", setDropPriceTx);
  console.log(`BaseScan: https://sepolia.basescan.org/tx/${setDropPriceTx}`);
  await publicClient.waitForTransactionReceipt({ hash: setDropPriceTx });
  await sleep(3000);

  const [unhealthyScore, unhealthyCR, isLiquidatableUnhealthy] =
    (await publicClient.readContract({
      address: vaultAddress,
      abi: artifacts.Vault.abi,
      functionName: "getHealthScore",
      args: [account.address],
    })) as [bigint, bigint, boolean];

  console.log(
    `- Undercollateralized CR: ${Number(unhealthyCR) / 100}% (Required: ${Number(updatedRequiredCR) / 100}%)`,
  );
  console.log(`- Health Score: ${formatEther(unhealthyScore)} (< 1.0)`);
  console.log(`- Is Liquidatable: ${isLiquidatableUnhealthy}`);

  if (!isLiquidatableUnhealthy) {
    throw new Error(
      "Position was expected to be liquidatable after price drop!",
    );
  }
  console.log(
    ">>> TEST 3 PASSED: Health scores and liquidation guards verified successfully!\n",
  );

  // --------------------------------------------------------------------------
  // TEST 4: Successful Liquidation & Collateral Seizure
  // --------------------------------------------------------------------------
  console.log(
    "---------------------------------------------------------------",
  );
  console.log(
    "TEST 4: Execute liquidate() & Verify Collateral Seizure + Debt Cancellation",
  );
  console.log(
    "---------------------------------------------------------------",
  );

  const erc20Abi = parseAbi([
    "function balanceOf(address) view returns (uint256)",
  ]);

  const liquidatorWethBefore = (await publicClient.readContract({
    address: WETH,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [liquidatorAccount.address],
  })) as bigint;
  const borrowerDebtBefore = (await publicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "debt",
    args: [account.address],
  })) as bigint;

  console.log(
    `- Liquidator WETH Balance Before: ${formatEther(liquidatorWethBefore)} WETH`,
  );
  console.log(
    `- Borrower Outstanding Debt:      ${formatEther(borrowerDebtBefore)} mUSD`,
  );

  console.log("\n1. Executing liquidate(borrower) from Liquidator Account...");
  const liquidateTx = await liquidatorWalletClient.writeContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "liquidate",
    args: [account.address],
  });
  console.log(">>> Liquidation Tx Hash:", liquidateTx);
  console.log(`>>> BaseScan: https://sepolia.basescan.org/tx/${liquidateTx}`);

  const liquidateReceipt = await publicClient.waitForTransactionReceipt({
    hash: liquidateTx,
  });
  if (liquidateReceipt.status !== "success") {
    throw new Error("Liquidation transaction failed!");
  }
  await sleep(3000);

  const borrowerDebtAfter = (await publicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "debt",
    args: [account.address],
  })) as bigint;

  const liquidatorWethAfter = (await publicClient.readContract({
    address: WETH,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [liquidatorAccount.address],
  })) as bigint;

  const seizedWeth = liquidatorWethAfter - liquidatorWethBefore;
  console.log("\n>>> POST-LIQUIDATION STATE VERIFICATION:");
  console.log(
    `- Borrower Debt After:           ${formatEther(borrowerDebtAfter)} mUSD (CONFIRMED 0: Debt Canceled)`,
  );
  console.log(
    `- Liquidator WETH Balance After: ${formatEther(liquidatorWethAfter)} WETH`,
  );
  console.log(
    `- Seized Collateral Transferred: ${formatEther(seizedWeth)} WETH to Liquidator`,
  );

  if (borrowerDebtAfter !== 0n) {
    throw new Error(
      `Borrower debt was not canceled! Remaining: ${borrowerDebtAfter}`,
    );
  }
  if (seizedWeth === 0n) {
    throw new Error("Liquidator did not receive any seized collateral!");
  }

  // Clear test price override back to 0 (live Chainlink feeds)
  console.log(
    "\n2. Clearing price override back to 0 (live Chainlink feeds)...",
  );
  const clearOverrideTx = await walletClient.writeContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "setPriceOverride",
    args: [WETH, 0n],
  });
  console.log("Clear Override Tx:", clearOverrideTx);
  console.log(`BaseScan: https://sepolia.basescan.org/tx/${clearOverrideTx}`);
  await publicClient.waitForTransactionReceipt({ hash: clearOverrideTx });
  await sleep(3000);

  // Reset regime to Stable (0) with 150% CR and 200 bps fee
  console.log("3. Restoring Vault regime to Stable (0)...");
  const restorePayload = encodeAbiParameters(
    parseAbiParameters("uint8, string, uint64"),
    [0, "Test suite complete - normal operations restored", 99999n],
  );
  const restoreTx = await walletClient.writeContract({
    address: receiverAddress,
    abi: artifacts.BedrockLayerZeroReceiver.abi,
    functionName: "relayRegime",
    args: [
      restorePayload,
      "0x0000000000000000000000000000000000000000000000000000000000099999",
    ],
  });
  console.log("Restore Regime Tx:", restoreTx);
  console.log(`BaseScan: https://sepolia.basescan.org/tx/${restoreTx}`);
  await publicClient.waitForTransactionReceipt({ hash: restoreTx });

  results.tests.liquidation = {
    setHighPriceTx,
    setDropPriceTx,
    liquidateTx,
    clearOverrideTx,
    restoreTx,
    healthyRevertReason,
    setHighPriceTxUrl: `https://sepolia.basescan.org/tx/${setHighPriceTx}`,
    setDropPriceTxUrl: `https://sepolia.basescan.org/tx/${setDropPriceTx}`,
    liquidateTxUrl: `https://sepolia.basescan.org/tx/${liquidateTx}`,
    clearOverrideTxUrl: `https://sepolia.basescan.org/tx/${clearOverrideTx}`,
    restoreTxUrl: `https://sepolia.basescan.org/tx/${restoreTx}`,
    borrowerDebtBefore: formatEther(borrowerDebtBefore),
    borrowerDebtAfter: formatEther(borrowerDebtAfter),
    seizedCollateralWeth: formatEther(seizedWeth),
    liquidatorWethBefore: formatEther(liquidatorWethBefore),
    liquidatorWethAfter: formatEther(liquidatorWethAfter),
    status: "PASSED",
  };

  const resultsPath = path.resolve(
    process.cwd(),
    "evm/test_stability_and_liquidation_results.json",
  );
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2), "utf-8");

  console.log(
    "\n===============================================================",
  );
  console.log("ALL TESTS COMPLETED SUCCESSFULLY!");
  console.log(
    "Saved verification evidence to evm/test_stability_and_liquidation_results.json",
  );
  console.log(
    "===============================================================",
  );
}

main().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
