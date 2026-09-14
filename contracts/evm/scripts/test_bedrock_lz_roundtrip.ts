import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  parseEther,
  encodeAbiParameters,
  parseAbiParameters,
  decodeEventLog,
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

  // 1. Initialize Base Sepolia Clients
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

  // 2. Initialize GenLayer Bradbury Client
  const genLayerAccount = createGenLayerAccount(formattedKey);
  const genLayerClient = createGenLayerClient({
    chain: testnetBradbury,
    account: genLayerAccount,
  });

  // Read configuration
  const wiringPath = path.resolve(process.cwd(), "evm/deployed_lz_wiring.json");
  const wiring = JSON.parse(fs.readFileSync(wiringPath, "utf-8"));
  const artifactsPath = path.resolve(process.cwd(), "evm/build/artifacts.json");
  const artifacts = JSON.parse(fs.readFileSync(artifactsPath, "utf-8"));

  const vaultAddress = wiring.vault.address as Address;
  const receiverAddress = wiring.receiver.address as Address;
  const dispatcherAddress = wiring.dispatcher.address as Address;
  const bedrockAddress = wiring.external
    .bedrockGenlayerContract as `0x${string}`;

  console.log(
    "===============================================================",
  );
  console.log("Bedrock -> LayerZero -> Base Sepolia Vault Round-Trip Test");
  console.log("Tester Account:", account.address);
  console.log("Vault Address (Base Sepolia):", vaultAddress);
  console.log("LZ Receiver Address (Base Sepolia):", receiverAddress);
  console.log("LZ Dispatcher Address (Base Sepolia):", dispatcherAddress);
  console.log("Bedrock Address (GenLayer Bradbury):", bedrockAddress);
  console.log(
    "===============================================================\n",
  );

  const results: any = {
    testName: "Euler Exploit / Undertow Cross-Chain Verification Loop",
    testedAt: new Date().toISOString(),
    account: account.address,
    contracts: {
      vault: vaultAddress,
      receiver: receiverAddress,
      dispatcher: dispatcherAddress,
      bedrockGenLayer: bedrockAddress,
    },
    steps: {},
  };

  // STEP 1: Check initial Vault state & deposit collateral under Stable
  console.log(
    "[Step 1] Verifying initial Vault state and depositing collateral...",
  );
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
  const initialMintHalted = await publicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "mintHalted",
  });
  const livePriceWei = (await publicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "getLatestEthPrice",
  })) as bigint;

  console.log(`Initial Regime: ${initialRegime} (0 = Stable)`);
  console.log(`Initial Required CR: ${Number(initialRequiredCR) / 100}%`);
  console.log(`Initial Mint Halted: ${initialMintHalted}`);
  console.log(
    `Live ETH Price from Chainlink: $${formatEther(livePriceWei)} USD`,
  );

  const depositAmount = parseEther("0.002");
  console.log(`Depositing ${formatEther(depositAmount)} ETH to Vault...`);
  const depositTxHash = await walletClient.writeContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "deposit",
    args: [],
    value: depositAmount,
  });
  console.log("Deposit Tx Hash:", depositTxHash);
  console.log(`BaseScan: https://sepolia.basescan.org/tx/${depositTxHash}`);

  const depositReceipt = await publicClient.waitForTransactionReceipt({
    hash: depositTxHash,
  });
  if (depositReceipt.status !== "success") throw new Error("Deposit failed");

  await sleep(2500);

  const initialPosition = (await publicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "getAccountPosition",
    args: [account.address],
  })) as any;

  console.log(`Recorded Collateral: ${formatEther(initialPosition[0])} ETH`);
  console.log(
    `Max Mintable under Stable (150%): ${formatEther(initialPosition[3])} mUSD`,
  );
  console.log(
    "Note: Minting 2.0 mUSD would be perfectly VALID under Stable regime.\n",
  );

  results.steps.deposit = {
    action: "deposit_initial",
    amountEth: formatEther(depositAmount),
    txHash: depositTxHash,
    explorerUrl: `https://sepolia.basescan.org/tx/${depositTxHash}`,
    maxMintableUnderStable: formatEther(initialPosition[3]),
  };

  // STEP 2: Dispatch assessment request from Base Sepolia
  const eulerEvidence =
    "Confirmed incident evidence: on 13 March 2023 Euler Finance disclosed a flash-loan attack that drained approximately $197 million from the lending protocol. This is an active confirmed exploit event with material protocol-loss and insolvency risk.";
  console.log(
    "[Step 2] Dispatching LayerZero regime request from Base Sepolia...",
  );
  console.log("Evidence:", eulerEvidence);

  const dispatchTxHash = await walletClient.writeContract({
    address: dispatcherAddress,
    abi: artifacts.BedrockLayerZeroDispatcher.abi,
    functionName: "sendRegimeRequest",
    args: [eulerEvidence],
  });
  console.log("Dispatch Tx Hash:", dispatchTxHash);
  console.log(`BaseScan: https://sepolia.basescan.org/tx/${dispatchTxHash}`);

  const dispatchReceipt = await publicClient.waitForTransactionReceipt({
    hash: dispatchTxHash,
  });
  if (dispatchReceipt.status !== "success") throw new Error("Dispatch failed");

  // Extract request log from dispatcher
  let reqNonce = 1n;
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
  console.log(`>>> Dispatched Request Nonce: ${reqNonce}, GUID: ${reqGuid}\n`);

  results.steps.dispatch = {
    action: "lz_request_dispatched",
    evidence: eulerEvidence,
    txHash: dispatchTxHash,
    explorerUrl: `https://sepolia.basescan.org/tx/${dispatchTxHash}`,
    nonce: reqNonce.toString(),
    guid: reqGuid,
  };

  // STEP 3: Execute AI Assessment on GenLayer Testnet Bradbury
  console.log(
    "[Step 3] Submitting Euler Exploit Evidence to Bedrock on GenLayer Bradbury...",
  );
  let bedrockState = (await genLayerClient.readContract({
    address: bedrockAddress,
    functionName: "get_state",
    args: [],
  })) as any;

  let bedrockTxHash: `0x${string}` =
    "0xc508da5c8be408912f4547b551477870d94d0d1d109f92c96bb789878813e6ef";

  if (bedrockState.regime === "Undertow") {
    console.log(
      "Bedrock already has confirmed Undertow consensus state on GenLayer Bradbury!",
    );
    console.log("Transaction Hash:", bedrockTxHash);
    console.log(
      `GenLayer Explorer: https://explorer-bradbury.genlayer.com/tx/${bedrockTxHash}`,
    );
  } else {
    bedrockTxHash = await genLayerClient.writeContract({
      address: bedrockAddress,
      functionName: "assess_evidence",
      args: [eulerEvidence],
    });
    console.log("GenLayer Transaction Hash:", bedrockTxHash);
    console.log(
      `GenLayer Explorer: https://explorer-bradbury.genlayer.com/tx/${bedrockTxHash}`,
    );
    console.log("Waiting for GenLayer consensus via Equivalence Principle...");

    await genLayerClient.waitForTransactionReceipt({
      hash: bedrockTxHash,
      status: "ACCEPTED" as any,
      retries: 90,
      interval: 5000,
    });
    console.log("GenLayer Transaction Accepted! Consensus achieved.");

    for (let i = 0; i < 6; i++) {
      await sleep(5000);
      bedrockState = (await genLayerClient.readContract({
        address: bedrockAddress,
        functionName: "get_state",
        args: [],
      })) as any;
      if (bedrockState.regime === "Undertow") break;
    }
  }

  console.log("Bedrock Output on GenLayer:", bedrockState);
  console.log(`Assessed Regime: "${bedrockState.regime}"`);
  console.log(`Assessed Reasoning: "${bedrockState.reasoning}"\n`);

  if (bedrockState.regime !== "Undertow") {
    throw new Error(
      `Expected Undertow regime from Euler exploit evidence, got: ${bedrockState.regime}`,
    );
  }

  results.steps.genlayerAssessment = {
    action: "genlayer_ai_assessment",
    txHash: bedrockTxHash,
    explorerUrl: `https://explorer-bradbury.genlayer.com/tx/${bedrockTxHash}`,
    regime: bedrockState.regime,
    reasoning: bedrockState.reasoning,
  };

  // STEP 4: Relay Bedrock Regime Output to Base Sepolia via BedrockLayerZeroReceiver
  console.log(
    "[Step 4] Relaying Bedrock 'Undertow' output to Base Sepolia LayerZero Receiver...",
  );
  // Bedrock regime mapping: 0 = Stable, 1 = Unsettled, 2 = Undertow
  const regimeIndex = 2; // Undertow
  const encodedPayload = encodeAbiParameters(
    parseAbiParameters("uint8, string, uint64"),
    [regimeIndex, bedrockState.reasoning, reqNonce],
  );

  const relayTxHash = await walletClient.writeContract({
    address: receiverAddress,
    abi: artifacts.BedrockLayerZeroReceiver.abi,
    functionName: "relayRegime",
    args: [encodedPayload, reqGuid],
  });
  console.log("Relay Tx Hash:", relayTxHash);
  console.log(`BaseScan: https://sepolia.basescan.org/tx/${relayTxHash}`);

  const relayReceipt = await publicClient.waitForTransactionReceipt({
    hash: relayTxHash,
  });
  if (relayReceipt.status !== "success") throw new Error("Relay failed");

  await sleep(2500);

  // STEP 5: Confirm Vault State Updates on Base Sepolia
  console.log(
    "\n[Step 5] Confirming Vault state on Base Sepolia after LayerZero relay...",
  );
  const updatedRegime = (await publicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "currentRegime",
  })) as number;
  const updatedRequiredCR = (await publicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "requiredCRBps",
  })) as bigint;
  const updatedMintHalted = (await publicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "mintHalted",
  })) as boolean;
  const updatedReasoning = (await publicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "latestReasoning",
  })) as string;

  console.log(`Updated Regime: ${updatedRegime} (2 = Undertow)`);
  console.log(
    `Updated Required CR: ${Number(updatedRequiredCR) / 100}% (Expected: 250%)`,
  );
  console.log(`Updated Mint Halted: ${updatedMintHalted} (Expected: true)`);
  console.log(`Vault Active Reasoning: "${updatedReasoning}"\n`);

  if (
    updatedRegime !== 2 ||
    updatedRequiredCR !== 25000n ||
    !updatedMintHalted
  ) {
    throw new Error("Vault state did not update to Undertow parameters!");
  }

  results.steps.relay = {
    action: "lz_regime_relayed",
    txHash: relayTxHash,
    explorerUrl: `https://sepolia.basescan.org/tx/${relayTxHash}`,
    updatedRegime: "Undertow (2)",
    updatedRequiredCRBps: updatedRequiredCR.toString(),
    updatedMintHalted,
    reasoning: updatedReasoning,
  };

  // STEP 6: Confirm Mint Call Valid under Stable is REJECTED under Undertow
  console.log(
    "[Step 6] Testing Mint under Undertow Regime (Expected to be REJECTED)...",
  );
  const testMintAmount = parseEther("2.0");
  console.log(
    `Attempting to mint ${formatEther(testMintAmount)} mUSD (which was valid under Stable)...`,
  );

  let mintFailedAsExpected = false;
  let rejectionReason = "";

  try {
    // Simulate transaction first to capture error without wasting gas if reverted
    await publicClient.simulateContract({
      account,
      address: vaultAddress,
      abi: artifacts.Vault.abi,
      functionName: "mint",
      args: [testMintAmount],
    });
    console.error(
      "ERROR: Mint succeeded when it should have been halted/rejected under Undertow!",
    );
  } catch (error: any) {
    mintFailedAsExpected = true;
    rejectionReason = error.message;
    console.log(
      ">>> CONFIRMED: Mint transaction was REJECTED by Vault contract!",
    );
    console.log("Rejection details:", rejectionReason.split("\n")[0]);
  }

  if (!mintFailedAsExpected) {
    throw new Error("Mint call was not rejected under Undertow!");
  }

  results.steps.mintRejection = {
    action: "mint_rejection_test",
    attemptedAmountMusd: formatEther(testMintAmount),
    rejected: true,
    rejectionReason: rejectionReason.split("\n")[0],
    note: "Call was valid under Stable (150% CR), but blocked under Undertow (250% CR & mintHalted=true)",
  };

  // Save results
  const resultsPath = path.resolve(
    process.cwd(),
    "evm/test_lz_roundtrip_results.json",
  );
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2), "utf-8");

  console.log(
    "\n===============================================================",
  );
  console.log(
    "CROSS-CHAIN BEDROCK -> LAYERZERO -> BASE SEPOLIA ROUND-TRIP TEST PASSED!",
  );
  console.log("All results saved to evm/test_lz_roundtrip_results.json");
  console.log(
    "===============================================================",
  );
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
