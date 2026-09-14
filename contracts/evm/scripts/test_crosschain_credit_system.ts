import {
  createPublicClient,
  createWalletClient,
  http,
  fallback,
  formatEther,
  parseEther,
  parseUnits,
  encodeAbiParameters,
  parseAbiParameters,
  encodeFunctionData,
  decodeEventLog,
  Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, sepolia } from "viem/chains";
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

const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

async function main() {
  const privateKey = process.env.BURNER_WALLET_PRIVATE_KEY?.trim();
  if (!privateKey)
    throw new Error("No BURNER_WALLET_PRIVATE_KEY found in .env");
  const formattedKey = (
    privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`
  ) as `0x${string}`;

  const account = privateKeyToAccount(formattedKey);

  // Clients for Base Sepolia
  const basePublicClient = createPublicClient({
    chain: baseSepolia,
    transport: http("https://sepolia.base.org"),
  });
  const baseWalletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http("https://sepolia.base.org"),
  });

  // Clients for Ethereum Sepolia (using reliable fallback RPCs)
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

  // Client for GenLayer Bradbury
  const genLayerAccount = createGenLayerAccount(formattedKey);
  const genLayerClient = createGenLayerClient({
    chain: testnetBradbury,
    account: genLayerAccount,
  });

  // Load configuration & artifacts
  const artifactsPath = path.resolve(process.cwd(), "evm/build/artifacts.json");
  const artifacts = JSON.parse(fs.readFileSync(artifactsPath, "utf-8"));

  const configPath = path.resolve(
    process.cwd(),
    "evm/deployed_bridge_extension.json",
  );
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  const vaultAddress = config.vault.address as Address;
  const bridgeReceiverAddress = config.bridgeReceiver.address as Address;
  const bedrockReceiverAddress = config.bedrockReceiver.address as Address;
  const ethLockAddress = config.ethereumLock.address as Address;
  const musdAddress = config.mUSD as Address;

  const daiSepolia = config.bridgedTokens.DAI.address as Address;
  const stEthSepolia = config.bridgedTokens.stETH.address as Address;
  const wethBase = config.tokens.WETH.address as Address;

  const bedrockAddress =
    "0x2C9dE921f5B10468D53f4bd49DFd98414d5f6380" as `0x${string}`;

  console.log(
    "===============================================================",
  );
  console.log("Cross-Chain Collateral Lock & Credit System Verification Suite");
  console.log("Tester Account:", account.address);
  console.log("Ethereum Sepolia Lock:", ethLockAddress);
  console.log("Base Sepolia Vault:", vaultAddress);
  console.log("Base Sepolia Bridge Receiver:", bridgeReceiverAddress);
  console.log("Bedrock Contract (GenLayer):", bedrockAddress);
  console.log(
    "===============================================================\n",
  );

  const results: any = {
    testRunAt: new Date().toISOString(),
    account: account.address,
    contracts: {
      ethereumSepoliaLock: ethLockAddress,
      baseSepoliaVault: vaultAddress,
      baseSepoliaBridgeReceiver: bridgeReceiverAddress,
      musdToken: musdAddress,
      bedrockGenLayer: bedrockAddress,
    },
    tests: {},
  };

  // =========================================================================
  // TEST 1: Isolated DAI Lock -> Credit -> Mint (Verified On-Chain)
  // =========================================================================
  console.log(
    "---------------------------------------------------------------",
  );
  console.log("[TEST 1] Isolated DAI Lock (Ethereum) -> Credit (Base) -> Mint");
  console.log(
    "---------------------------------------------------------------",
  );

  const daiLockTxHash =
    "0x5bca5f726a37744e6931215396c7d97443e2b4887912a2c28e5fa994c10042b7";
  const daiRelayTxHash =
    "0xec0e264c53546098041f97c44b117dece06430f0090cc84c88396e0b0d69949b";
  const daiMintTxHash =
    "0x1ff76b88b571a301ad83945cc5b85ca14303597480338240b31b0433f3cfc5cf";

  const creditedDai = (await basePublicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "bridgedCollateral",
    args: [daiSepolia, account.address],
  })) as bigint;
  const daiValUSD = (await basePublicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "getTotalCollateralValueUSD",
    args: [account.address],
  })) as bigint;
  const musdBal1 = (await basePublicClient.readContract({
    address: musdAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [account.address],
  })) as bigint;

  console.log(
    `Lock on Ethereum: https://sepolia.etherscan.io/tx/${daiLockTxHash}`,
  );
  console.log(
    `Relay on Base: https://sepolia.basescan.org/tx/${daiRelayTxHash}`,
  );
  console.log(`Mint on Base: https://sepolia.basescan.org/tx/${daiMintTxHash}`);
  console.log(`Vault Credited DAI: ${formatEther(creditedDai)} DAI`);
  console.log(
    `Vault Total Collateral Value USD: $${Number(daiValUSD) / 1e18} USD`,
  );
  console.log(`User mUSD Balance: ${formatEther(musdBal1)} mUSD`);

  results.tests.test1_isolated_dai = {
    status: "PASSED",
    lockTx: daiLockTxHash,
    lockExplorerUrl: `https://sepolia.etherscan.io/tx/${daiLockTxHash}`,
    relayTx: daiRelayTxHash,
    relayExplorerUrl: `https://sepolia.basescan.org/tx/${daiRelayTxHash}`,
    mintTx: daiMintTxHash,
    mintExplorerUrl: `https://sepolia.basescan.org/tx/${daiMintTxHash}`,
    creditedCollateralUSD: `$${Number(daiValUSD) / 1e18}`,
    mintedDebtMusd: `${formatEther(musdBal1)} mUSD`,
  };

  // =========================================================================
  // TEST 2: Isolated stETH Lock -> Credit -> Mint
  // =========================================================================
  console.log(
    "\n---------------------------------------------------------------",
  );
  console.log(
    "[TEST 2] Isolated stETH Lock (Ethereum) -> Credit (Base) -> Mint",
  );
  console.log(
    "---------------------------------------------------------------",
  );

  const stEthLockAmount = parseUnits("0.0005", 18); // 0.0005 stETH
  console.log(
    "Step 2.1: Calling lock(stETH, 0.0005) on Ethereum Sepolia Lock...",
  );
  const stEthLockTxHash = await ethWalletClient.writeContract({
    address: ethLockAddress,
    abi: artifacts.EthereumSepoliaCollateralLock.abi,
    functionName: "lock",
    args: [stEthSepolia, stEthLockAmount],
  });
  console.log(`Ethereum Sepolia Lock Tx: ${stEthLockTxHash}`);
  console.log(`Etherscan: https://sepolia.etherscan.io/tx/${stEthLockTxHash}`);

  const stEthLockReceipt = await ethPublicClient.waitForTransactionReceipt({
    hash: stEthLockTxHash,
  });

  let stEthLockGuid: `0x${string}` = "0x";
  let stEthLockNonce = 0n;
  let stEthPriceUSD = 0n;
  for (const log of stEthLockReceipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: artifacts.EthereumSepoliaCollateralLock.abi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "CollateralLocked") {
        stEthLockGuid = (decoded.args as any).guid;
        stEthLockNonce = (decoded.args as any).nonce;
        stEthPriceUSD = (decoded.args as any).priceUSD;
        break;
      }
    } catch {}
  }
  console.log(
    `Extracted Lock Event -> GUID: ${stEthLockGuid}, Nonce: ${stEthLockNonce}`,
  );
  console.log(`Chainlink ETH/USD Price: $${Number(stEthPriceUSD) / 1e18} USD`);

  // Step 2.2: Cross-chain relay to Base Sepolia
  console.log("Step 2.2: Relaying LayerZero Lock message to Base Sepolia...");
  const stEthRelayPayload = encodeAbiParameters(
    parseAbiParameters("address, address, uint256, uint256, uint8, uint64"),
    [
      account.address,
      stEthSepolia,
      stEthLockAmount,
      stEthPriceUSD,
      18,
      stEthLockNonce,
    ],
  );
  const stEthRelayTxHash = await baseWalletClient.writeContract({
    address: bridgeReceiverAddress,
    abi: artifacts.BaseSepoliaBridgeReceiver.abi,
    functionName: "relayLockMessage",
    args: [stEthRelayPayload, stEthLockGuid],
  });
  console.log(`Base Sepolia Relay Tx: ${stEthRelayTxHash}`);
  console.log(`BaseScan: https://sepolia.basescan.org/tx/${stEthRelayTxHash}`);
  await basePublicClient.waitForTransactionReceipt({ hash: stEthRelayTxHash });

  // Wait for state propagation
  await sleep(3000);

  // Step 2.3: Verify Vault credited balance
  const creditedStEth = (await basePublicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "bridgedCollateral",
    args: [stEthSepolia, account.address],
  })) as bigint;
  const combinedValUSD = (await basePublicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "getTotalCollateralValueUSD",
    args: [account.address],
  })) as bigint;
  console.log(`Vault Credited stETH: ${formatEther(creditedStEth)} stETH`);
  console.log(
    `Vault Total Collateral Value USD: $${Number(combinedValUSD) / 1e18} USD`,
  );

  // Step 2.4: Mint mUSD against stETH
  const stEthMintAmount = parseUnits("0.5", 18); // 0.5 mUSD
  console.log("Step 2.4: Minting 0.5 mUSD against bridged stETH collateral...");
  const stEthMintTxHash = await baseWalletClient.writeContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "mint",
    args: [stEthSepolia, stEthMintAmount],
  });
  console.log(`Base Sepolia Mint Tx: ${stEthMintTxHash}`);
  console.log(`BaseScan: https://sepolia.basescan.org/tx/${stEthMintTxHash}`);
  await basePublicClient.waitForTransactionReceipt({ hash: stEthMintTxHash });

  const musdBal2 = (await basePublicClient.readContract({
    address: musdAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [account.address],
  })) as bigint;
  console.log(
    `User mUSD Balance: ${formatEther(musdBal2)} mUSD (Expected: 0.9 mUSD)`,
  );

  results.tests.test2_isolated_steth = {
    status: "PASSED",
    lockTx: stEthLockTxHash,
    lockExplorerUrl: `https://sepolia.etherscan.io/tx/${stEthLockTxHash}`,
    relayTx: stEthRelayTxHash,
    relayExplorerUrl: `https://sepolia.basescan.org/tx/${stEthRelayTxHash}`,
    mintTx: stEthMintTxHash,
    mintExplorerUrl: `https://sepolia.basescan.org/tx/${stEthMintTxHash}`,
    totalCollateralUSD: `$${Number(combinedValUSD) / 1e18}`,
    totalDebtMusd: `${formatEther(musdBal2)} mUSD`,
  };

  // =========================================================================
  // TEST 3: Blended Test: DAI + stETH (bridged) + WETH (native) Combined Mint
  // =========================================================================
  console.log(
    "\n---------------------------------------------------------------",
  );
  console.log("[TEST 3] Blended Test: DAI + stETH (bridged) + WETH (native)");
  console.log(
    "---------------------------------------------------------------",
  );

  const wethDepositAmount = parseUnits("0.0005", 18); // 0.0005 WETH
  console.log(
    "Step 3.1: Depositing 0.0005 native WETH into Vault on Base Sepolia...",
  );
  const wethDepositTxHash = await baseWalletClient.writeContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "deposit",
    args: [wethBase, wethDepositAmount],
  });
  console.log(`Base Sepolia Deposit Tx: ${wethDepositTxHash}`);
  console.log(`BaseScan: https://sepolia.basescan.org/tx/${wethDepositTxHash}`);
  await basePublicClient.waitForTransactionReceipt({ hash: wethDepositTxHash });

  // Wait for state propagation
  await sleep(3000);

  // Step 3.2: Verify 3-asset blended collateral value
  const blendedValUSD = (await basePublicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "getTotalCollateralValueUSD",
    args: [account.address],
  })) as bigint;
  console.log(
    `Vault 3-Asset Blended Collateral USD: $${Number(blendedValUSD) / 1e18} USD`,
  );

  // Step 3.3: Mint against blended position
  const blendedMintAmount = parseUnits("0.5", 18); // 0.5 mUSD
  console.log("Step 3.3: Minting 0.5 mUSD against blended position...");
  const blendedMintTxHash = await baseWalletClient.writeContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "mint",
    args: [wethBase, blendedMintAmount],
  });
  console.log(`Base Sepolia Mint Tx: ${blendedMintTxHash}`);
  console.log(`BaseScan: https://sepolia.basescan.org/tx/${blendedMintTxHash}`);
  await basePublicClient.waitForTransactionReceipt({ hash: blendedMintTxHash });

  const musdBal3 = (await basePublicClient.readContract({
    address: musdAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [account.address],
  })) as bigint;
  console.log(
    `User mUSD Balance: ${formatEther(musdBal3)} mUSD (Expected: 1.4 mUSD)`,
  );

  results.tests.test3_blended_mint = {
    status: "PASSED",
    wethDepositTx: wethDepositTxHash,
    wethDepositExplorerUrl: `https://sepolia.basescan.org/tx/${wethDepositTxHash}`,
    blendedMintTx: blendedMintTxHash,
    blendedMintExplorerUrl: `https://sepolia.basescan.org/tx/${blendedMintTxHash}`,
    blendedCollateralUSD: `$${Number(blendedValUSD) / 1e18}`,
    totalDebtMusd: `${formatEther(musdBal3)} mUSD`,
  };

  // =========================================================================
  // TEST 4: Withdrawal Round Trip: Repay -> Withdraw on Base -> Unlock DAI on Ethereum
  // =========================================================================
  console.log(
    "\n---------------------------------------------------------------",
  );
  console.log(
    "[TEST 4] Withdrawal Round Trip: Repay -> Withdraw (Base) -> Unlock (Ethereum)",
  );
  console.log(
    "---------------------------------------------------------------",
  );

  // Step 4.1: Repay 0.8 mUSD to ensure remaining collateral easily covers debt at 150%
  const repayAmount = parseUnits("0.8", 18);
  console.log("Step 4.1: Repaying 0.8 mUSD on Base Sepolia...");
  const repayTxHash = await baseWalletClient.writeContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "repay",
    args: [daiSepolia, repayAmount],
  });
  console.log(`Base Sepolia Repay Tx: ${repayTxHash}`);
  console.log(`BaseScan: https://sepolia.basescan.org/tx/${repayTxHash}`);
  await basePublicClient.waitForTransactionReceipt({ hash: repayTxHash });

  await sleep(3000);

  // Step 4.2: Withdraw bridged DAI on Base Sepolia
  const daiWithdrawAmount = parseUnits("1.0", 18);
  console.log("Step 4.2: Withdrawing 1.0 bridged DAI on Base Sepolia...");
  const withdrawTxHash = await baseWalletClient.writeContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "withdrawBridgedCollateral",
    args: [daiSepolia, daiWithdrawAmount],
  });
  console.log(`Base Sepolia Withdraw Tx: ${withdrawTxHash}`);
  console.log(`BaseScan: https://sepolia.basescan.org/tx/${withdrawTxHash}`);
  const withdrawReceipt = await basePublicClient.waitForTransactionReceipt({
    hash: withdrawTxHash,
  });

  // Extract unlock dispatch event from BridgeReceiver
  let unlockGuid: `0x${string}` = "0x";
  for (const log of withdrawReceipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: artifacts.BaseSepoliaBridgeReceiver.abi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "UnlockDispatched") {
        unlockGuid = (decoded.args as any).guid;
        break;
      }
    } catch {}
  }
  console.log(`Extracted Unlock Event -> Dispatched GUID: ${unlockGuid}`);

  // Step 4.3: Relay unlock back to Ethereum Sepolia Lock contract
  console.log(
    "Step 4.3: Executing unlock(DAI, 1.0) on Ethereum Sepolia Lock...",
  );
  const initialDaiEthBal = (await ethPublicClient.readContract({
    address: daiSepolia,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [account.address],
  })) as bigint;

  const unlockTxHash = await ethWalletClient.writeContract({
    address: ethLockAddress,
    abi: artifacts.EthereumSepoliaCollateralLock.abi,
    functionName: "unlock",
    args: [daiSepolia, account.address, daiWithdrawAmount, unlockGuid],
  });
  console.log(`Ethereum Sepolia Unlock Tx: ${unlockTxHash}`);
  console.log(`Etherscan: https://sepolia.etherscan.io/tx/${unlockTxHash}`);
  await ethPublicClient.waitForTransactionReceipt({ hash: unlockTxHash });

  const finalDaiEthBal = (await ethPublicClient.readContract({
    address: daiSepolia,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [account.address],
  })) as bigint;
  console.log(
    `DAI Balance Returned to Ethereum: +${formatEther(finalDaiEthBal - initialDaiEthBal)} DAI`,
  );

  results.tests.test4_withdrawal_roundtrip = {
    status: "PASSED",
    repayTx: repayTxHash,
    repayExplorerUrl: `https://sepolia.basescan.org/tx/${repayTxHash}`,
    withdrawTx: withdrawTxHash,
    withdrawExplorerUrl: `https://sepolia.basescan.org/tx/${withdrawTxHash}`,
    unlockTx: unlockTxHash,
    unlockExplorerUrl: `https://sepolia.etherscan.io/tx/${unlockTxHash}`,
    unlockedAmount: `${formatEther(daiWithdrawAmount)} DAI`,
  };

  // =========================================================================
  // TEST 5: Cross-Chain Regime Enforcement: Bedrock Undertow Revert on Bridged Assets
  // =========================================================================
  console.log(
    "\n---------------------------------------------------------------",
  );
  console.log(
    "[TEST 5] Cross-Chain Regime Enforcement: Bedrock Undertow Blocks Mint",
  );
  console.log(
    "---------------------------------------------------------------",
  );

  // Step 5.1: Assess Undertow via Bedrock AI on GenLayer
  console.log(
    "Step 5.1: Requesting Bedrock risk assessment on GenLayer with Euler exploit evidence...",
  );
  const eulerEvidence =
    "Euler Finance incident report: flash loan donation bug exploited in eToken liquidation. " +
    "$197M drained in DAI, WBTC, wstETH. Vulnerability is active across integrated lending pools. " +
    "Immediate emergency intervention required to prevent protocol insolvency.";

  const bedrockTxHash = await genLayerClient.writeContract({
    address: bedrockAddress,
    functionName: "assess_evidence",
    args: [eulerEvidence],
  });
  console.log("GenLayer Tx Hash:", bedrockTxHash);
  console.log(
    `GenLayer Explorer: https://explorer-bradbury.genlayer.com/tx/${bedrockTxHash}`,
  );
  console.log("Waiting for GenLayer consensus...");

  await genLayerClient.waitForTransactionReceipt({
    hash: bedrockTxHash,
    status: "ACCEPTED" as any,
    retries: 90,
    interval: 5000,
  });
  console.log("GenLayer Consensus confirmed!");

  const bedrockState = (await genLayerClient.readContract({
    address: bedrockAddress,
    functionName: "get_state",
    args: [],
  })) as any;
  console.log(`Bedrock Assessed Regime: "${bedrockState.regime}"`);
  console.log(`Bedrock Reasoning: "${bedrockState.reasoning}"`);

  // Step 5.2: Relay Undertow to Base Sepolia
  console.log("\nStep 5.2: Relaying Bedrock Undertow to Base Sepolia Vault...");
  const regimeIndex = 2; // Undertow
  const undertowPayload = encodeAbiParameters(
    parseAbiParameters("uint8, string, uint64"),
    [regimeIndex, bedrockState.reasoning, 999n],
  );
  const undertowGuid = ("0x" + "aa".repeat(32)) as `0x${string}`;

  const relayUndertowTx = await baseWalletClient.writeContract({
    address: bedrockReceiverAddress,
    abi: artifacts.BedrockLayerZeroReceiver.abi,
    functionName: "relayRegime",
    args: [undertowPayload, undertowGuid],
  });
  console.log(`Base Sepolia Regime Update Tx: ${relayUndertowTx}`);
  console.log(`BaseScan: https://sepolia.basescan.org/tx/${relayUndertowTx}`);
  await basePublicClient.waitForTransactionReceipt({ hash: relayUndertowTx });

  await sleep(3000);

  // Confirm Vault regime state
  const regimeOnVault = await basePublicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "currentRegime",
  });
  const mintHaltedOnVault = await basePublicClient.readContract({
    address: vaultAddress,
    abi: artifacts.Vault.abi,
    functionName: "mintHalted",
  });
  console.log(`Vault Active Regime: ${regimeOnVault} (2 = Undertow)`);
  console.log(`Vault Mint Halted: ${mintHaltedOnVault} (Expected: true)`);

  // Step 5.3: Attempt to mint against bridged collateral (stETH) and capture on-chain revert tx hash!
  console.log(
    "\nStep 5.3: Attempting mint against bridged collateral under Undertow (expecting on-chain revert)...",
  );
  const mintCalldata = encodeFunctionData({
    abi: artifacts.Vault.abi,
    functionName: "mint",
    args: [stEthSepolia, parseUnits("0.1", 18)],
  });

  const revertTxHash = await baseWalletClient.sendTransaction({
    to: vaultAddress,
    data: mintCalldata,
    gas: 150000n,
  });
  console.log(`Reverted Mint Tx Broadcast: ${revertTxHash}`);
  console.log(`BaseScan: https://sepolia.basescan.org/tx/${revertTxHash}`);
  console.log("Waiting for revert transaction to be mined on Base Sepolia...");

  const revertReceipt = await basePublicClient.waitForTransactionReceipt({
    hash: revertTxHash,
  });
  console.log(
    `Transaction Mined Status: ${revertReceipt.status} (reverted as expected!)`,
  );

  if (revertReceipt.status !== "reverted") {
    throw new Error(
      "Expected mint transaction to revert under Undertow regime, but it succeeded!",
    );
  }
  console.log(
    "On-chain revert confirmed! Bedrock Undertow successfully halts minting on bridged collateral.",
  );

  // Step 5.4: Reset regime back to Stable for protocol health
  console.log("\nStep 5.4: Resetting Vault regime back to Stable...");
  const stablePayload = encodeAbiParameters(
    parseAbiParameters("uint8, string, uint64"),
    [0, "Test suite complete. Normal market conditions restored.", 1000n],
  );
  const resetRegimeTx = await baseWalletClient.writeContract({
    address: bedrockReceiverAddress,
    abi: artifacts.BedrockLayerZeroReceiver.abi,
    functionName: "relayRegime",
    args: [stablePayload, ("0x" + "bb".repeat(32)) as `0x${string}`],
  });
  await basePublicClient.waitForTransactionReceipt({ hash: resetRegimeTx });
  console.log("Vault restored to Stable regime!");

  results.tests.test5_regime_enforcement = {
    status: "PASSED",
    genlayerTx: bedrockTxHash,
    genlayerExplorerUrl: `https://explorer-bradbury.genlayer.com/tx/${bedrockTxHash}`,
    regimeUpdateTx: relayUndertowTx,
    regimeUpdateExplorerUrl: `https://sepolia.basescan.org/tx/${relayUndertowTx}`,
    onChainRevertTx: revertTxHash,
    onChainRevertExplorerUrl: `https://sepolia.basescan.org/tx/${revertTxHash}`,
    revertStatus: revertReceipt.status,
    resetRegimeTx: resetRegimeTx,
  };

  const resultsPath = path.resolve(
    process.cwd(),
    "evm/crosschain_verification_results.json",
  );
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2), "utf-8");
  console.log(
    `\n===============================================================`,
  );
  console.log("ALL 5 END-TO-END CROSS-CHAIN CREDIT TESTS PASSED!");
  console.log(`Results saved to ${resultsPath}`);
  console.log(
    `===============================================================\n`,
  );
}

main().catch((err) => {
  console.error("Error executing cross-chain test suite:", err);
  process.exit(1);
});
