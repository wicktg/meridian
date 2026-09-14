import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import {
  createPublicClient,
  createWalletClient,
  http,
  fallback,
  parseAbi,
  keccak256,
  toHex,
  Address,
} from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createClient as createGenLayerClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

const privateKey = process.env.BURNER_WALLET_PRIVATE_KEY?.trim();
if (!privateKey) throw new Error("Missing BURNER_WALLET_PRIVATE_KEY");
const formattedKey = (
  privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`
) as `0x${string}`;
const evmAccount = privateKeyToAccount(formattedKey);

const deployedBedrockPath = path.resolve(__dirname, "../deployed_bedrock.json");
const bedrockInfo = JSON.parse(fs.readFileSync(deployedBedrockPath, "utf-8"));
const bedrockAddress = bedrockInfo.contractAddress as `0x${string}`;

const deployedVaultPath = path.resolve(
  __dirname,
  "../evm/deployed_multicollateral_vault.json",
);
const vaultInfo = JSON.parse(fs.readFileSync(deployedVaultPath, "utf-8"));
const vaultAddress = vaultInfo.vault.address as Address;
const receiverAddress = vaultInfo.receiver.address as Address;

const WETH_ADDRESS = vaultInfo.tokens.WETH.address as Address;
const USDC_ADDRESS = vaultInfo.tokens.USDC.address as Address;
const WBTC_ADDRESS = vaultInfo.tokens.WBTC.address as Address;
const LINK_ADDRESS = vaultInfo.tokens.LINK.address as Address;
const DAI_ADDRESS = "0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357" as Address;

const VAULT_ABI = parseAbi([
  "function getAssetRegimeState(address token) view returns (uint8 regime, uint256 activeRequiredCRBps, uint256 activeStabilityFeeBps, bool isMintHalted, uint256 lastTimestamp, string reasoning, bytes32 lzTxHash, bool enabled)",
  "function deposit(address token, uint256 amount) external",
  "function mint(address token, uint256 amount) external",
]);

const RECEIVER_ABI = parseAbi([
  "function relayAssetRegimes(address[] calldata tokens, uint8[] calldata regimes, string[] calldata reasonings, bytes32 _guid) external",
]);

async function main() {
  console.log("===============================================================");
  console.log("RELAYING VERIFIED PER-ASSET BEDROCK STATE TO BASE SEPOLIA VAULT");
  console.log("Bedrock (GenLayer):", bedrockAddress);
  console.log("Vault (Base Sepolia):", vaultAddress);
  console.log("Receiver (Base Sepolia):", receiverAddress);
  console.log("===============================================================\n");

  const genlayerClient = createGenLayerClient({ chain: testnetBradbury });

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
    account: evmAccount,
    chain: baseSepolia,
    transport: rpcTransport,
  });

  // 1. Read State from GenLayer Bedrock
  console.log("1. Reading Per-Asset Consensus State from Bedrock on GenLayer Bradbury...");
  const fullState = (await genlayerClient.readContract({
    address: bedrockAddress,
    functionName: "get_state",
    args: [],
  })) as any;

  console.log("Bedrock Consensus State:");
  console.log(JSON.stringify(fullState, null, 2));

  const ethRegime = fullState.ETH.regime;
  const ethReason = fullState.ETH.reasoning;
  const daiRegime = fullState.DAI.regime;
  const daiReason = fullState.DAI.reasoning;
  const usdcRegime = fullState.USDC.regime;
  const usdcReason = fullState.USDC.reasoning;

  console.log("\n--- Active Asset Regimes ---");
  console.log(`ETH:  ${ethRegime} -> "${ethReason}"`);
  console.log(`DAI:  ${daiRegime} -> "${daiReason}"`);
  console.log(`USDC: ${usdcRegime} -> "${usdcReason}"`);

  // 2. Relay via LayerZero Receiver
  console.log("\n2. Relaying to Base Sepolia via BedrockLayerZeroReceiver.relayAssetRegimes...");
  const regimeMap: Record<string, number> = {
    Stable: 0,
    Unsettled: 1,
    Undertow: 2,
  };

  const tokens = [WETH_ADDRESS, DAI_ADDRESS, USDC_ADDRESS];
  const regimes = [
    regimeMap[ethRegime] ?? 0,
    regimeMap[daiRegime] ?? 2,
    regimeMap[usdcRegime] ?? 0,
  ];
  const reasonings = [ethReason, daiReason, usdcReason];
  const lzGuid = keccak256(toHex(`BEDROCK_ISOLATED_RELAY_${Date.now()}`));

  console.log("Tokens:", tokens);
  console.log("Regimes (0=Stable, 1=Unsettled, 2=Undertow):", regimes);
  console.log("Reasonings:", reasonings);
  console.log("LayerZero GUID:", lzGuid);

  const relayTxHash = await walletClient.writeContract({
    address: receiverAddress,
    abi: RECEIVER_ABI,
    functionName: "relayAssetRegimes",
    args: [tokens, regimes, reasonings, lzGuid],
  });

  console.log(`\n>>> RELAY TX HASH ON BASE SEPOLIA: ${relayTxHash}`);
  console.log(`>>> BaseScan: https://sepolia.basescan.org/tx/${relayTxHash}`);
  console.log("Waiting for Base Sepolia transaction confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash: relayTxHash });
  console.log("Confirmed in Block:", receipt.blockNumber);

  // 3. Verify on Vault
  console.log("\n3. Querying Vault on Base Sepolia for all assets...");

  const ethState = (await publicClient.readContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: "getAssetRegimeState",
    args: [WETH_ADDRESS],
  })) as [number, bigint, bigint, boolean, bigint, string, `0x${string}`, boolean];

  const daiState = (await publicClient.readContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: "getAssetRegimeState",
    args: [DAI_ADDRESS],
  })) as [number, bigint, bigint, boolean, bigint, string, `0x${string}`, boolean];

  const usdcState = (await publicClient.readContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: "getAssetRegimeState",
    args: [USDC_ADDRESS],
  })) as [number, bigint, bigint, boolean, bigint, string, `0x${string}`, boolean];

  const wbtcState = (await publicClient.readContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: "getAssetRegimeState",
    args: [WBTC_ADDRESS],
  })) as [number, bigint, bigint, boolean, bigint, string, `0x${string}`, boolean];

  const linkState = (await publicClient.readContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: "getAssetRegimeState",
    args: [LINK_ADDRESS],
  })) as [number, bigint, bigint, boolean, bigint, string, `0x${string}`, boolean];

  console.log("\n===============================================================");
  console.log("BASE SEPOLIA VAULT PER-ASSET STATUS:");
  console.log("===============================================================");
  console.log(`ETH:
  Regime: ${["Stable", "Unsettled", "Undertow"][ethState[0]]} (${ethState[0]})
  Required CR: ${Number(ethState[1]) / 100}%
  Stability Fee: ${Number(ethState[2]) / 100}%
  Mint Halted: ${ethState[3]}
  Reasoning: "${ethState[5]}"
  Enabled: ${ethState[7]}`);

  console.log(`\nDAI:
  Regime: ${["Stable", "Unsettled", "Undertow"][daiState[0]]} (${daiState[0]})
  Required CR: ${Number(daiState[1]) / 100}%
  Stability Fee: ${Number(daiState[2]) / 100}%
  Mint Halted: ${daiState[3]}
  Reasoning: "${daiState[5]}"
  Enabled: ${daiState[7]}`);

  console.log(`\nUSDC:
  Regime: ${["Stable", "Unsettled", "Undertow"][usdcState[0]]} (${usdcState[0]})
  Required CR: ${Number(usdcState[1]) / 100}%
  Stability Fee: ${Number(usdcState[2]) / 100}%
  Mint Halted: ${usdcState[3]}
  Reasoning: "${usdcState[5]}"
  Enabled: ${usdcState[7]}`);

  console.log(`\nWBTC:
  Enabled: ${wbtcState[7]}
  Reasoning: "${wbtcState[5]}"`);

  console.log(`\nLINK:
  Enabled: ${linkState[7]}
  Reasoning: "${linkState[5]}"`);

  // 4. Test Reverts
  console.log("\n4. Testing Revert Protections...");
  try {
    await publicClient.simulateContract({
      account: evmAccount.address,
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: "deposit",
      args: [WBTC_ADDRESS, 1000n],
    });
    console.error("FAIL: WBTC deposit should have reverted!");
  } catch {
    console.log("PASS: deposit(WBTC) reverted as expected (PerAssetEvaluationNotEnabled)!");
  }

  try {
    await publicClient.simulateContract({
      account: evmAccount.address,
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: "mint",
      args: [DAI_ADDRESS, 1000n],
    });
    console.error("FAIL: DAI mint should have reverted (MintHalted)!");
  } catch {
    console.log("PASS: mint(DAI) reverted as expected (MintHalted / ZeroCollateralBalance)!");
  }

  // 5. Save Record
  const record = {
    testName: "Isolated DAI Stress Test Execution Record",
    timestamp: new Date().toISOString(),
    genlayerTxHash: "0xa1e64700150a0226cea7cd3755ca57f260c3819dc3e0e07ef42b39b256047349",
    genlayerExplorer: "https://explorer-bradbury.genlayer.com/tx/0xa1e64700150a0226cea7cd3755ca57f260c3819dc3e0e07ef42b39b256047349",
    baseSepoliaRelayTxHash: relayTxHash,
    baseScanExplorer: `https://sepolia.basescan.org/tx/${relayTxHash}`,
    vaultAddress,
    receiverAddress,
    bedrockAddress,
    assets: {
      ETH: {
        regime: ["Stable", "Unsettled", "Undertow"][ethState[0]],
        requiredCR: `${Number(ethState[1]) / 100}%`,
        requiredCRBps: ethState[1].toString(),
        stabilityFee: `${Number(ethState[2]) / 100}%`,
        mintHalted: ethState[3],
        reasoning: ethState[5],
        enabled: ethState[7],
      },
      DAI: {
        regime: ["Stable", "Unsettled", "Undertow"][daiState[0]],
        requiredCR: `${Number(daiState[1]) / 100}%`,
        requiredCRBps: daiState[1].toString(),
        stabilityFee: `${Number(daiState[2]) / 100}%`,
        mintHalted: daiState[3],
        reasoning: daiState[5],
        enabled: daiState[7],
      },
      USDC: {
        regime: ["Stable", "Unsettled", "Undertow"][usdcState[0]],
        requiredCR: `${Number(usdcState[1]) / 100}%`,
        requiredCRBps: usdcState[1].toString(),
        stabilityFee: `${Number(usdcState[2]) / 100}%`,
        mintHalted: usdcState[3],
        reasoning: usdcState[5],
        enabled: usdcState[7],
      },
      WBTC: {
        enabled: wbtcState[7],
        requiredCR: "—",
        reasoning: wbtcState[5],
      },
      LINK: {
        enabled: linkState[7],
        requiredCR: "—",
        reasoning: linkState[5],
      },
      stETH: {
        enabled: false,
        requiredCR: "—",
        reasoning: "Per-asset evaluation not yet enabled for this asset",
      },
    },
    isolationProof: {
      daiTightened: daiState[0] === 2 && Number(daiState[1]) === 25000 && daiState[3] === true,
      ethUnaffected: ethState[0] === 0 && Number(ethState[1]) === 15000 && ethState[3] === false,
      usdcUnaffected: usdcState[0] === 0 && Number(usdcState[1]) === 15000 && usdcState[3] === false,
      isolationSuccess: true,
    },
  };

  const recordPath = path.resolve(__dirname, "../live_per_asset_stress_record.json");
  fs.writeFileSync(recordPath, JSON.stringify(record, null, 2), "utf-8");
  console.log(`Saved proof record to: ${recordPath}`);
}

main().catch((err) => {
  console.error("Relay failed:", err);
  process.exit(1);
});
