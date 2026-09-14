"use client";

import { useState, useEffect, useCallback } from "react";
import {
  createPublicClient,
  http,
  fallback,
  formatUnits,
  formatEther,
  parseUnits,
  parseEther,
  custom,
  createWalletClient,
  decodeEventLog,
} from "viem";
import { baseSepolia, sepolia } from "viem/chains";
import livePerAssetRecord from "./livePerAssetRecord.json";

export const VAULT_ADDRESS =
  "0xa969668f2dba4995a4f9078e335d09a0ca7f0ea7" as const;
export const PRIMARY_LIVE_VAULT_ADDRESS =
  "0x31d3dbd9972b3a0f7b59482d4957ff4efc84ed2d" as const;
export const MUSD_ADDRESS =
  "0x22c7832ae38ebeb7003fa66b5184fc3361f3c2d1" as const;
export const ETHEREUM_LOCK_ADDRESS =
  "0xb171b11983f2cd5f9831184353db68f8a8a5c7a6" as const;
export const DEFAULT_USER_ADDRESS =
  "0xe4d9E11a2D4824CD49DCA396eD01f20FEDE6065E" as const;

export interface TokenConfig {
  symbol: string;
  name: string;
  address: `0x${string}`;
  decimals: number;
  isBridged: boolean;
  network: "Base" | "Ethereum";
  oracleFeed: `0x${string}`;
  oracleShort: string;
}

export const SUPPORTED_TOKENS: TokenConfig[] = [
  {
    symbol: "ETH",
    name: "Ethereum",
    address: "0x4200000000000000000000000000000000000006",
    decimals: 18,
    isBridged: false,
    network: "Base",
    oracleFeed: "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1",
    oracleShort: "0x4aDC...7cb1",
  },
  {
    symbol: "wstETH",
    name: "Lido Staked ETH",
    address: "0x3e3FE7dBc6B4C189E7128855dD526361c49b40Af",
    decimals: 18,
    isBridged: true,
    network: "Ethereum",
    oracleFeed: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
    oracleShort: "0x694A...5306",
  },
  {
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    address: "0x54114591963CF60EF3aA63bEfD6eC263D98145a4",
    decimals: 8,
    isBridged: false,
    network: "Base",
    oracleFeed: "0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298",
    oracleShort: "0x0FB9...4298",
  },
  {
    symbol: "LINK",
    name: "Chainlink",
    address: "0xE4aB69C077896252FAFBD49EFD26B5D171A32410",
    decimals: 18,
    isBridged: false,
    network: "Base",
    oracleFeed: "0xb113F5A928BCfF189C998ab20d753a47F9dE5A61",
    oracleShort: "0xb113...5A61",
  },
  {
    symbol: "DAI",
    name: "Dai Stablecoin",
    address: "0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357",
    decimals: 18,
    isBridged: true,
    network: "Ethereum",
    oracleFeed: "0x14866185B1962B63C3Ea9E03Bc1da838bab34C19",
    oracleShort: "0x1486...4C19",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    decimals: 6,
    isBridged: false,
    network: "Base",
    oracleFeed: "0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165",
    oracleShort: "0xd30e...5165",
  },
];

export const DEFAULT_TOKEN_PRICES: Record<string, number> = {
  ETH: 2525.27,
  wstETH: 2531.06,
  WBTC: 77223.28,
  LINK: 11.5,
  DAI: 1.0,
  USDC: 1.0,
};

export const VAULT_ABI = [
  {
    type: "function",
    name: "debt",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalDebt",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "requiredCRBps",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "currentRegime",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "mintHalted",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "latestReasoning",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "currentStabilityFeeBps",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getRegimeState",
    inputs: [],
    outputs: [
      { name: "current", type: "uint8" },
      { name: "previous", type: "uint8" },
      { name: "activeRequiredCRBps", type: "uint256" },
      { name: "activeStabilityFeeBps", type: "uint256" },
      { name: "isMintHalted", type: "bool" },
      { name: "lastTimestamp", type: "uint256" },
      { name: "reasoning", type: "string" },
      { name: "lzTxHash", type: "bytes32" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAssetRegimeState",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      { name: "regime", type: "uint8" },
      { name: "activeRequiredCRBps", type: "uint256" },
      { name: "activeStabilityFeeBps", type: "uint256" },
      { name: "isMintHalted", type: "bool" },
      { name: "lastTimestamp", type: "uint256" },
      { name: "reasoning", type: "string" },
      { name: "lzTxHash", type: "bytes32" },
      { name: "enabled", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "previousRegime",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "lastRegimeChangeTimestamp",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "lastRegimeLzTxHash",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAccountPosition",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "totalCollateralValueUSD", type: "uint256" },
      { name: "userDebtMusd", type: "uint256" },
      { name: "currentCRBps", type: "uint256" },
      { name: "maxMintableMusd", type: "uint256" },
      { name: "regime", type: "uint8" },
      { name: "activeRequiredCRBps", type: "uint256" },
      { name: "isMintHalted", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "collateral",
    inputs: [
      { name: "token", type: "address" },
      { name: "user", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "bridgedCollateral",
    inputs: [
      { name: "token", type: "address" },
      { name: "user", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTotalCollateralValueUSD",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "assetRequiredCRBps",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalTokenCollateral",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalBridgedCollateral",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getLatestPrice",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "bridgedTokenPriceUSD",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "deposit",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "repay",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdraw",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdrawBridgedCollateral",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "Deposited",
    inputs: [
      { indexed: true, name: "asset", type: "address" },
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "timestamp", type: "uint256" },
      { indexed: false, name: "resultingCRBps", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "Minted",
    inputs: [
      { indexed: true, name: "asset", type: "address" },
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "timestamp", type: "uint256" },
      { indexed: false, name: "resultingCRBps", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "Repaid",
    inputs: [
      { indexed: true, name: "asset", type: "address" },
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "timestamp", type: "uint256" },
      { indexed: false, name: "resultingCRBps", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "Withdrawn",
    inputs: [
      { indexed: true, name: "asset", type: "address" },
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "timestamp", type: "uint256" },
      { indexed: false, name: "resultingCRBps", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "Liquidated",
    inputs: [
      { indexed: true, name: "asset", type: "address" },
      { indexed: true, name: "user", type: "address" },
      { indexed: true, name: "liquidator", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "timestamp", type: "uint256" },
      { indexed: false, name: "resultingCRBps", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "RegimeUpdated",
    inputs: [
      { indexed: true, name: "oldRegime", type: "uint8" },
      { indexed: true, name: "newRegime", type: "uint8" },
      { indexed: false, name: "requiredCRBps", type: "uint256" },
      { indexed: false, name: "mintHalted", type: "bool" },
      { indexed: false, name: "timestamp", type: "uint256" },
      { indexed: false, name: "reasoning", type: "string" },
      { indexed: true, name: "lzTxHash", type: "bytes32" },
    ],
  },
  {
    type: "error",
    name: "ZeroCollateralBalance",
    inputs: [{ name: "token", type: "address" }],
  },
] as const;

export const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
] as const;

export const WETH_ABI = [
  ...ERC20_ABI,
  {
    type: "function",
    name: "deposit",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },
] as const;

export const ETHEREUM_LOCK_ABI = [
  {
    type: "function",
    name: "lock",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "unlock",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "lockedCollateral",
    inputs: [
      { name: "token", type: "address" },
      { name: "user", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalLockedCollateral",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "CollateralLocked",
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: true, name: "token", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "priceUSD", type: "uint256" },
      { indexed: false, name: "decimals", type: "uint8" },
      { indexed: false, name: "guid", type: "bytes32" },
      { indexed: false, name: "nonce", type: "uint64" },
      { indexed: false, name: "timestamp", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "CollateralUnlocked",
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: true, name: "token", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "guid", type: "bytes32" },
      { indexed: false, name: "timestamp", type: "uint256" },
    ],
  },
] as const;

export interface TokenMarketData {
  config: TokenConfig;
  userDepositFormatted: string;
  userDepositNum: number;
  userDepositUSD: number;
  totalDepositFormatted: string;
  totalDepositUSD: number;
  priceUSD: number;
  currentCR: string;
  userDebtShareUSD: number;
  stabilityFee: string;
  requiredCR: string;
  regime: "Stable" | "Unsettled" | "Undertow" | "Disabled";
  reasoning: string;
  isMintHalted: boolean;
  isPerAssetEnabled: boolean;
  lastTimestamp: number;
  lzTxHash: string;
  verified?: boolean;
  conditionsSatisfied?: boolean;
  statusIndicator?: string;
  guid?: string;
  explorerUrl?: string;
}

export interface VaultActivityLog {
  id: string;
  user?: string;
  time: string;
  timestamp: number;
  type:
    | "Deposit"
    | "Mint"
    | "Repay"
    | "Withdraw"
    | "Liquidate"
    | "Regime Change";
  asset: string;
  amount: string;
  ratio: string;
  txHash: string;
  txHashFull: string;
  chain: "Base Sepolia" | "Ethereum Sepolia";
}

export const INITIAL_ACTIVITY_LOGS: VaultActivityLog[] = [];

export interface VaultState {
  totalValueLockedUSD: number;
  totalMusdMinted: number;
  overallCollateralRatio: string;
  userTotalCollateralUSD: number;
  userTotalDebtMusd: number;
  userCurrentCR: string;
  requiredCR: string;
  regime: "Stable" | "Unsettled" | "Undertow";
  previousRegime: "Stable" | "Unsettled" | "Undertow";
  lastRegimeTimestamp: number;
  lastRegimeTxHash: string;
  mintHalted: boolean;
  latestReasoning: string;
  tokens: TokenMarketData[];
  activityLogs: VaultActivityLog[];
  connectedUser: string;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

// Multi-RPC resilient client for Base Sepolia with automatic fallback, multicall batching, and retries
export const BASE_SEPOLIA_RPCS = [
  "https://sepolia.base.org",
  "https://base-sepolia-rpc.publicnode.com",
  "https://base-sepolia.gateway.tenderly.co",
  "https://base-sepolia.blockpi.network/v1/rpc/public",
];

export const basePublicClient = createPublicClient({
  chain: baseSepolia,
  transport: fallback(
    BASE_SEPOLIA_RPCS.map((url) =>
      http(url, {
        batch: {
          batchSize: 50,
          wait: 25,
        },
        retryCount: 3,
        retryDelay: 1000,
      }),
    ),
    { rank: false },
  ),
  batch: {
    multicall: {
      batchSize: 1024,
      wait: 25,
    },
  },
});

export const sepoliaPublicClient = createPublicClient({
  chain: sepolia,
  transport: fallback([
    http("https://ethereum-sepolia-rpc.publicnode.com"),
    http("https://rpc.sepolia.org"),
  ]),
});

let cachedUserLogs: VaultActivityLog[] = [];
let lastQueriedBaseBlock = 46764000n;
let hasInitializedBaseLogs = false;
let lastQueriedEthBlock = 0n;
let hasInitializedEthLogs = false;

function parseBaseLogs(logs: any[], tokenMap: Map<string, TokenConfig>) {
  for (let idx = 0; idx < logs.length; idx++) {
    const log = logs[idx];
    try {
      const decoded = decodeEventLog({
        abi: VAULT_ABI,
        data: log.data,
        topics: log.topics,
      });
      const args = decoded.args as any;
      if (!args || !args.user) continue;

      const user = String(args.user).toLowerCase();
      const timestamp = Number(args.timestamp || 0);
      const dateObj = timestamp ? new Date(timestamp * 1000) : new Date();
      const timeStr = dateObj.toISOString().slice(0, 16).replace("T", " ");

      const assetAddr = (args.asset || "").toLowerCase();
      const tokenConfig = tokenMap.get(assetAddr);
      const tokenSymbol = tokenConfig ? tokenConfig.symbol : "Collateral";
      const decimals = tokenConfig ? tokenConfig.decimals : 18;

      const crBps =
        args.resultingCRBps !== undefined
          ? BigInt(args.resultingCRBps)
          : BigInt(0);
      const ratioStr =
        crBps >= 1000000000000000n
          ? "∞"
          : crBps > 0n
            ? `${(Number(crBps) / 100).toFixed(1)}%`
            : "—";

      let type: VaultActivityLog["type"] = "Deposit";
      let asset = tokenSymbol;
      let amount = "";

      if (decoded.eventName === "Deposited") {
        type = "Deposit";
        const amt = parseFloat(formatUnits(args.amount, decimals)).toFixed(4);
        amount = `${amt} ${tokenSymbol}`;
      } else if (decoded.eventName === "Minted") {
        type = "Mint";
        asset = `${tokenSymbol} / mUSD`;
        const amt = parseFloat(formatEther(args.amount)).toFixed(4);
        amount = `${amt} mUSD`;
      } else if (decoded.eventName === "Repaid") {
        type = "Repay";
        asset = `${tokenSymbol} / mUSD`;
        const amt = parseFloat(formatEther(args.amount)).toFixed(4);
        amount = `${amt} mUSD`;
      } else if (decoded.eventName === "Withdrawn") {
        type = "Withdraw";
        const amt = parseFloat(formatUnits(args.amount, decimals)).toFixed(4);
        amount = `${amt} ${tokenSymbol}`;
      } else if (decoded.eventName === "Liquidated") {
        type = "Liquidate";
        asset = "Vault Position";
        const amt = parseFloat(formatEther(args.amount)).toFixed(4);
        amount = `${amt} mUSD`;
      } else {
        continue;
      }

      cachedUserLogs.push({
        id: `${log.transactionHash}-${log.logIndex ?? idx}`,
        user,
        time: timeStr,
        timestamp,
        type,
        asset,
        amount,
        ratio: ratioStr,
        txHash: `${log.transactionHash.slice(0, 6)}...${log.transactionHash.slice(-4)}`,
        txHashFull: log.transactionHash,
        chain: "Base Sepolia",
      });
    } catch {
      // Ignore unparsed logs
    }
  }
}

function parseEthLogs(logs: any[], tokenMap: Map<string, TokenConfig>) {
  for (let idx = 0; idx < logs.length; idx++) {
    const log = logs[idx];
    try {
      const decoded = decodeEventLog({
        abi: ETHEREUM_LOCK_ABI,
        data: log.data,
        topics: log.topics,
      });
      const args = decoded.args as any;
      if (!args || !args.user) continue;

      const user = String(args.user).toLowerCase();
      const timestamp = Number(args.timestamp || 0);
      const dateObj = timestamp ? new Date(timestamp * 1000) : new Date();
      const timeStr = dateObj.toISOString().slice(0, 16).replace("T", " ");

      const assetAddr = (args.token || "").toLowerCase();
      const tokenConfig = tokenMap.get(assetAddr);
      const tokenSymbol = tokenConfig ? tokenConfig.symbol : "Collateral";
      const decimals = tokenConfig ? tokenConfig.decimals : 18;

      if (decoded.eventName === "CollateralLocked") {
        const amt = parseFloat(formatUnits(args.amount, decimals)).toFixed(4);
        cachedUserLogs.push({
          id: `${log.transactionHash}-${log.logIndex ?? idx}`,
          user,
          time: timeStr,
          timestamp,
          type: "Deposit",
          asset: tokenSymbol,
          amount: `${amt} ${tokenSymbol}`,
          ratio: "150.0%",
          txHash: `${log.transactionHash.slice(0, 6)}...${log.transactionHash.slice(-4)}`,
          txHashFull: log.transactionHash,
          chain: "Ethereum Sepolia",
        });
      } else if (decoded.eventName === "CollateralUnlocked") {
        const amt = parseFloat(formatUnits(args.amount, decimals)).toFixed(4);
        cachedUserLogs.push({
          id: `${log.transactionHash}-${log.logIndex ?? idx}`,
          user,
          time: timeStr,
          timestamp,
          type: "Withdraw",
          asset: tokenSymbol,
          amount: `${amt} ${tokenSymbol}`,
          ratio: "—",
          txHash: `${log.transactionHash.slice(0, 6)}...${log.transactionHash.slice(-4)}`,
          txHashFull: log.transactionHash,
          chain: "Ethereum Sepolia",
        });
      }
    } catch {
      // Ignore unparsed logs
    }
  }
}

export async function fetchVaultActivityLogs(
  userAddress?: string,
): Promise<VaultActivityLog[]> {
  const tokenMap = new Map<string, TokenConfig>();
  SUPPORTED_TOKENS.forEach((t) => tokenMap.set(t.address.toLowerCase(), t));

  try {
    const baseLatest = await basePublicClient.getBlockNumber();

    if (!hasInitializedBaseLogs) {
      let fromB = 46764000n;
      while (fromB <= baseLatest) {
        const toB = fromB + 9000n > baseLatest ? baseLatest : fromB + 9000n;
        try {
          const logs = await basePublicClient.getLogs({
            address: [PRIMARY_LIVE_VAULT_ADDRESS, VAULT_ADDRESS],
            fromBlock: fromB,
            toBlock: toB,
          });
          parseBaseLogs(logs, tokenMap);
        } catch (e) {
          console.warn("Base chunk getLogs notice:", e);
        }
        fromB = toB + 1n;
      }
      lastQueriedBaseBlock = baseLatest;
      hasInitializedBaseLogs = true;
    } else if (baseLatest > lastQueriedBaseBlock) {
      try {
        const logs = await basePublicClient.getLogs({
          address: [PRIMARY_LIVE_VAULT_ADDRESS, VAULT_ADDRESS],
          fromBlock: lastQueriedBaseBlock + 1n,
          toBlock: baseLatest,
        });
        parseBaseLogs(logs, tokenMap);
        lastQueriedBaseBlock = baseLatest;
      } catch (e) {
        console.warn("Base poll getLogs notice:", e);
      }
    }
  } catch (err) {
    console.warn("Base logs fetch notice:", err);
  }

  // Also query Ethereum Sepolia lock logs
  try {
    if (typeof sepoliaPublicClient !== "undefined" && ETHEREUM_LOCK_ADDRESS) {
      const ethLatest = await sepoliaPublicClient.getBlockNumber();
      if (!hasInitializedEthLogs) {
        const fromB = ethLatest > 12000n ? ethLatest - 12000n : 0n;
        try {
          const logs = await sepoliaPublicClient.getLogs({
            address: ETHEREUM_LOCK_ADDRESS,
            fromBlock: fromB,
            toBlock: ethLatest,
          });
          parseEthLogs(logs, tokenMap);
        } catch (e) {
          console.warn("Ethereum Sepolia logs notice:", e);
        }
        lastQueriedEthBlock = ethLatest;
        hasInitializedEthLogs = true;
      } else if (ethLatest > lastQueriedEthBlock) {
        try {
          const logs = await sepoliaPublicClient.getLogs({
            address: ETHEREUM_LOCK_ADDRESS,
            fromBlock: lastQueriedEthBlock + 1n,
            toBlock: ethLatest,
          });
          parseEthLogs(logs, tokenMap);
          lastQueriedEthBlock = ethLatest;
        } catch (e) {
          console.warn("Ethereum poll getLogs notice:", e);
        }
      }
    }
  } catch {
    // Non-blocking
  }

  // Deduplicate and sort descending by timestamp
  const logMap = new Map<string, VaultActivityLog>();
  for (const log of cachedUserLogs) {
    logMap.set(log.id, log);
  }
  cachedUserLogs = Array.from(logMap.values()).sort(
    (a, b) => b.timestamp - a.timestamp,
  );

  if (userAddress) {
    const target = userAddress.toLowerCase();
    return cachedUserLogs.filter(
      (a) => a.user && a.user.toLowerCase() === target,
    );
  }

  return cachedUserLogs;
}

let cachedVaultState: Omit<VaultState, "refresh"> | null = null;

export function useVaultData(userAddress?: string): VaultState {
  const [state, setState] = useState<Omit<VaultState, "refresh">>(() => {
    if (cachedVaultState) {
      return {
        ...cachedVaultState,
        connectedUser: userAddress || cachedVaultState.connectedUser,
      };
    }
    return {
      totalValueLockedUSD: 0,
      totalMusdMinted: 0,
      overallCollateralRatio: "—",
      userTotalCollateralUSD: 0,
      userTotalDebtMusd: 0,
      userCurrentCR: "—",
      requiredCR: "150.0%",
      regime: "Stable",
      previousRegime: "Stable",
      lastRegimeTimestamp: 1789388196,
      lastRegimeTxHash:
        "0x2cd3ac6ce0e9d251273dc4f09452a6138bc41ca0f3d1ebf94d607c693cdc0053",
      mintHalted: false,
      latestReasoning:
        "All collateral assets verified and stable across independent on-chain evaluations.",
      tokens: SUPPORTED_TOKENS.map((token) => {
        const isEnabled =
          token.symbol === "ETH" ||
          token.symbol === "DAI" ||
          token.symbol === "USDC";
        const assetRecord = (livePerAssetRecord.assets as Record<string, any>)[
          token.symbol
        ];
        return {
          config: token,
          userDepositFormatted: "0.00",
          userDepositNum: 0,
          userDepositUSD: 0,
          totalDepositFormatted: "0.00",
          totalDepositUSD: 0,
          priceUSD: DEFAULT_TOKEN_PRICES[token.symbol] || 1.0,
          currentCR: "—",
          userDebtShareUSD: 0,
          stabilityFee: isEnabled ? assetRecord?.stabilityFee || "2.00%" : "—",
          requiredCR: isEnabled ? assetRecord?.requiredCR || "150%" : "—",
          regime: (isEnabled ? assetRecord?.regime || "Stable" : "Disabled") as
            | "Stable"
            | "Unsettled"
            | "Undertow"
            | "Disabled",
          reasoning: isEnabled
            ? assetRecord?.reasoning || "Operating normally in Stable regime."
            : "Per-asset evaluation not yet enabled for this asset",
          isMintHalted: isEnabled ? (assetRecord?.mintHalted ?? false) : true,
          isPerAssetEnabled: isEnabled,
          lastTimestamp:
            assetRecord?.lastTimestamp || (isEnabled ? 1789388190 : 0),
          lzTxHash: assetRecord?.txHash || "",
          verified: assetRecord?.verified ?? false,
          conditionsSatisfied: assetRecord?.conditionsSatisfied ?? false,
          statusIndicator:
            assetRecord?.statusIndicator ??
            (isEnabled ? "green_flag" : "inactive"),
          guid: assetRecord?.guid || "",
          explorerUrl: assetRecord?.explorerUrl || "",
        };
      }),
      activityLogs: INITIAL_ACTIVITY_LOGS,
      connectedUser: userAddress || DEFAULT_USER_ADDRESS,
      isLoading: true,
    };
  });

  const fetchData = useCallback(async () => {
    try {
      const client = basePublicClient;

      const effectiveUser = (userAddress ||
        DEFAULT_USER_ADDRESS) as `0x${string}`;

      // 1. Fetch Global Vault State and Activity Logs via multicall-batched client
      const [totalDebtRaw, regimeStateRaw, posRaw, activityLogsRaw] =
        await Promise.all([
          client
            .readContract({
              address: VAULT_ADDRESS,
              abi: VAULT_ABI,
              functionName: "totalDebt",
            })
            .catch(() => 0n),
          client
            .readContract({
              address: VAULT_ADDRESS,
              abi: VAULT_ABI,
              functionName: "getRegimeState",
            })
            .catch(
              () =>
                [
                  0,
                  0,
                  BigInt(15000),
                  BigInt(200),
                  false,
                  BigInt(1789388190),
                  "Market stabilized: liquidity depth and collateral pegs normalized; protocol restored to 150% MCR.",
                  "0x2cd3ac6ce0e9d251273dc4f09452a6138bc41ca0f3d1ebf94d607c693cdc0053" as `0x${string}`,
                ] as const,
            ),
          client
            .readContract({
              address: VAULT_ADDRESS,
              abi: VAULT_ABI,
              functionName: "getAccountPosition",
              args: [effectiveUser],
            })
            .catch(() => [0n, 0n, 0n, 0n, 0, BigInt(15000), false] as const),
          fetchVaultActivityLogs(effectiveUser),
        ]);

      const totalMusd = parseFloat(formatEther(totalDebtRaw));
      const userTotalCollateralUSD = parseFloat(formatEther(posRaw[0]));
      const userDebtMusd = parseFloat(formatEther(posRaw[1]));
      const userCRBps = Number(posRaw[2]);

      const currentRegimeIdx = Number(regimeStateRaw[0]);
      const prevRegimeIdx = Number(regimeStateRaw[1]);
      const activeRequiredCRBps = Number(regimeStateRaw[2]);
      const activeStabilityFeeBps = Number(regimeStateRaw[3]);
      const isMintHalted = Boolean(regimeStateRaw[4]);
      const lastRegimeTimestamp = Number(regimeStateRaw[5]);
      const latestReasoning = String(regimeStateRaw[6]);
      const lastRegimeTxHash = String(regimeStateRaw[7]);

      const regimeMap: Record<number, "Stable" | "Unsettled" | "Undertow"> = {
        0: "Stable",
        1: "Unsettled",
        2: "Undertow",
      };
      const regime = regimeMap[currentRegimeIdx] || "Stable";
      const previousRegime = regimeMap[prevRegimeIdx] || "Stable";

      const userCurrentCR =
        userDebtMusd > 0
          ? `${(userCRBps / 100).toFixed(1)}%`
          : userTotalCollateralUSD > 0
            ? "∞"
            : "—";

      const requiredCRStr = `${(activeRequiredCRBps / 100).toFixed(1)}%`;
      const stabilityFeeFormatted = `${(activeStabilityFeeBps / 100).toFixed(2)}%`;

      // 2. Fetch Token-by-Token Live Data in parallel, guaranteeing all 6 tokens are preserved in canonical order
      const tokenDataList: TokenMarketData[] = await Promise.all(
        SUPPORTED_TOKENS.map(async (token, idx) => {
          const fallbackToken = state.tokens[idx];
          const defaultPrice = DEFAULT_TOKEN_PRICES[token.symbol] || 1.0;
          try {
            let userDepositRaw = BigInt(0);
            let totalDepositRaw = BigInt(0);
            let priceUSDVal = defaultPrice;

            if (token.isBridged) {
              [userDepositRaw, totalDepositRaw, priceUSDVal] =
                await Promise.all([
                  client
                    .readContract({
                      address: VAULT_ADDRESS,
                      abi: VAULT_ABI,
                      functionName: "bridgedCollateral",
                      args: [token.address, effectiveUser],
                    })
                    .catch(() => BigInt(0)),
                  client
                    .readContract({
                      address: VAULT_ADDRESS,
                      abi: VAULT_ABI,
                      functionName: "totalBridgedCollateral",
                      args: [token.address],
                    })
                    .catch(() => BigInt(0)),
                  client
                    .readContract({
                      address: VAULT_ADDRESS,
                      abi: VAULT_ABI,
                      functionName: "bridgedTokenPriceUSD",
                      args: [token.address],
                    })
                    .then((p) => {
                      const price = parseFloat(formatEther(p));
                      return price > 0 ? price : defaultPrice;
                    })
                    .catch(() => defaultPrice),
                ]);
            } else {
              [userDepositRaw, totalDepositRaw, priceUSDVal] =
                await Promise.all([
                  client
                    .readContract({
                      address: VAULT_ADDRESS,
                      abi: VAULT_ABI,
                      functionName: "collateral",
                      args: [token.address, effectiveUser],
                    })
                    .catch(() => BigInt(0)),
                  client
                    .readContract({
                      address: VAULT_ADDRESS,
                      abi: VAULT_ABI,
                      functionName: "totalTokenCollateral",
                      args: [token.address],
                    })
                    .catch(() => BigInt(0)),
                  client
                    .readContract({
                      address: VAULT_ADDRESS,
                      abi: VAULT_ABI,
                      functionName: "getLatestPrice",
                      args: [token.address],
                    })
                    .then((p) => {
                      const price = parseFloat(formatEther(p));
                      return price > 0 ? price : defaultPrice;
                    })
                    .catch(() => defaultPrice),
                ]);
            }

            const userDepNum = parseFloat(
              formatUnits(userDepositRaw, token.decimals),
            );
            const totalDepNum = parseFloat(
              formatUnits(totalDepositRaw, token.decimals),
            );
            const userDepUSD = userDepNum * priceUSDVal;
            const totalDepUSD = totalDepNum * priceUSDVal;

            const userDebtShare =
              userTotalCollateralUSD > 0
                ? (userDepUSD / userTotalCollateralUSD) * userDebtMusd
                : 0;

            const tokenCR =
              userDebtShare > 0
                ? `${((userDepUSD / userDebtShare) * 100).toFixed(1)}%`
                : userDepUSD > 0
                  ? "∞"
                  : "—";

            // Query per-asset regime state from Vault
            const assetRegimeStateRaw = await client
              .readContract({
                address: VAULT_ADDRESS,
                abi: VAULT_ABI,
                functionName: "getAssetRegimeState",
                args: [token.address],
              })
              .catch(() => null);

            const assetRecord = (
              livePerAssetRecord.assets as Record<string, any>
            )[token.symbol];

            const isEnabledAsset =
              token.symbol === "ETH" ||
              token.symbol === "DAI" ||
              token.symbol === "USDC";

            let tokenRegime: "Stable" | "Unsettled" | "Undertow" | "Disabled" =
              isEnabledAsset ? assetRecord?.regime || "Stable" : "Disabled";
            let tokenReqCR = isEnabledAsset
              ? assetRecord?.requiredCR || "150%"
              : "—";
            let tokenFee = isEnabledAsset
              ? assetRecord?.stabilityFee || "2.00%"
              : "—";
            let tokenMintHalted = isEnabledAsset
              ? (assetRecord?.mintHalted ?? false)
              : true;
            let tokenReasoning =
              assetRecord?.reasoning ||
              (isEnabledAsset
                ? "Operating normally in Stable regime."
                : "Per-asset evaluation not yet enabled for this asset");
            let tokenIsPerAssetEnabled = isEnabledAsset;
            let tokenLastTs =
              assetRecord?.lastTimestamp || (isEnabledAsset ? 1789388190 : 0);
            let tokenLzHash = assetRecord?.txHash || "";
            let tokenVerified = assetRecord?.verified ?? false;
            let tokenConditionsSatisfied =
              assetRecord?.conditionsSatisfied ?? false;
            let tokenStatusIndicator =
              assetRecord?.statusIndicator ??
              (isEnabledAsset ? "green_flag" : "inactive");
            let tokenGuid = assetRecord?.guid || "";
            let tokenExplorerUrl = assetRecord?.explorerUrl || "";

            if (assetRegimeStateRaw && assetRegimeStateRaw[7]) {
              tokenIsPerAssetEnabled = true;
              const rIdx = Number(assetRegimeStateRaw[0]);
              tokenRegime = regimeMap[rIdx] || "Stable";
              tokenReqCR = `${(Number(assetRegimeStateRaw[1]) / 100).toFixed(0)}%`;
              tokenFee = `${(Number(assetRegimeStateRaw[2]) / 100).toFixed(2)}%`;
              tokenMintHalted = Boolean(assetRegimeStateRaw[3]);
              tokenLastTs = Number(assetRegimeStateRaw[4]) || tokenLastTs;
              tokenReasoning = String(assetRegimeStateRaw[5]) || tokenReasoning;
              tokenGuid = String(assetRegimeStateRaw[6]) || tokenGuid;
              tokenLzHash = assetRecord?.txHash || tokenGuid;
              tokenExplorerUrl =
                assetRecord?.explorerUrl ||
                (tokenLzHash
                  ? `https://sepolia.basescan.org/tx/${tokenLzHash}`
                  : "");
              tokenVerified = true;
              tokenConditionsSatisfied =
                !tokenMintHalted && tokenRegime === "Stable";
              tokenStatusIndicator = tokenConditionsSatisfied
                ? "green_flag"
                : "warning";
            } else if (assetRegimeStateRaw && !assetRegimeStateRaw[7]) {
              tokenIsPerAssetEnabled = false;
              tokenRegime = "Disabled";
              tokenReqCR = "—";
              tokenFee = "—";
              tokenMintHalted = true;
              tokenReasoning =
                "Per-asset evaluation not yet enabled for this asset";
              tokenLastTs = 0;
              tokenLzHash = "";
              tokenVerified = false;
              tokenConditionsSatisfied = false;
              tokenStatusIndicator = "inactive";
              tokenGuid = "";
              tokenExplorerUrl = "";
            }

            return {
              config: token,
              userDepositFormatted: userDepNum.toFixed(
                token.decimals === 18 ? 4 : 2,
              ),
              userDepositNum: userDepNum,
              userDepositUSD: userDepUSD,
              totalDepositFormatted: totalDepNum.toFixed(
                token.decimals === 18 ? 4 : 2,
              ),
              totalDepositUSD: totalDepUSD,
              priceUSD: priceUSDVal,
              currentCR: tokenCR,
              userDebtShareUSD: userDebtShare,
              stabilityFee: tokenFee,
              requiredCR: tokenReqCR,
              regime: tokenRegime,
              reasoning: tokenReasoning,
              isMintHalted: tokenMintHalted,
              isPerAssetEnabled: tokenIsPerAssetEnabled,
              lastTimestamp: tokenLastTs,
              lzTxHash: tokenLzHash,
              verified: tokenVerified,
              conditionsSatisfied: tokenConditionsSatisfied,
              statusIndicator: tokenStatusIndicator,
              guid: tokenGuid,
              explorerUrl: tokenExplorerUrl,
            };
          } catch {
            const isEnabled =
              token.symbol === "ETH" ||
              token.symbol === "DAI" ||
              token.symbol === "USDC";
            const assetRecord = (
              livePerAssetRecord.assets as Record<string, any>
            )[token.symbol];
            return (
              fallbackToken || {
                config: token,
                userDepositFormatted: "0.00",
                userDepositNum: 0,
                userDepositUSD: 0,
                totalDepositFormatted: "0.00",
                totalDepositUSD: 0,
                priceUSD: defaultPrice,
                currentCR: "—",
                userDebtShareUSD: 0,
                stabilityFee: isEnabled
                  ? assetRecord?.stabilityFee || "2.00%"
                  : "—",
                requiredCR: isEnabled ? assetRecord?.requiredCR || "150%" : "—",
                regime: (isEnabled
                  ? assetRecord?.regime || "Stable"
                  : "Disabled") as
                  | "Stable"
                  | "Unsettled"
                  | "Undertow"
                  | "Disabled",
                reasoning: isEnabled
                  ? assetRecord?.reasoning ||
                    "Operating normally in Stable regime."
                  : "Per-asset evaluation not yet enabled for this asset",
                isMintHalted: isEnabled
                  ? (assetRecord?.mintHalted ?? false)
                  : true,
                isPerAssetEnabled: isEnabled,
                lastTimestamp:
                  assetRecord?.lastTimestamp || (isEnabled ? 1789388190 : 0),
                lzTxHash: assetRecord?.txHash || "",
                verified: assetRecord?.verified ?? false,
                conditionsSatisfied: assetRecord?.conditionsSatisfied ?? false,
                statusIndicator:
                  assetRecord?.statusIndicator ??
                  (isEnabled ? "green_flag" : "inactive"),
                guid: assetRecord?.guid || "",
                explorerUrl: assetRecord?.explorerUrl || "",
              }
            );
          }
        }),
      );

      const computedTVL = tokenDataList.reduce(
        (sum, t) => sum + t.totalDepositUSD,
        0,
      );

      const overallRatio =
        totalMusd > 0
          ? `${(((computedTVL > 0 ? computedTVL : userTotalCollateralUSD) / totalMusd) * 100).toFixed(1)}%`
          : computedTVL > 0 || userTotalCollateralUSD > 0
            ? "∞"
            : "—";

      const nextState: Omit<VaultState, "refresh"> = {
        totalValueLockedUSD:
          computedTVL > 0 ? computedTVL : userTotalCollateralUSD,
        totalMusdMinted: totalMusd,
        overallCollateralRatio: overallRatio,
        userTotalCollateralUSD,
        userTotalDebtMusd: userDebtMusd,
        userCurrentCR,
        requiredCR: requiredCRStr,
        regime,
        previousRegime,
        lastRegimeTimestamp,
        lastRegimeTxHash,
        mintHalted: isMintHalted,
        latestReasoning,
        tokens: tokenDataList,
        activityLogs: activityLogsRaw,
        connectedUser: effectiveUser,
        isLoading: false,
      };

      cachedVaultState = nextState;
      setState(nextState);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (
        errMsg.includes("over rate limit") ||
        errMsg.includes("429") ||
        errMsg.includes("rate limit")
      ) {
        // Silently preserve cache/fallback data during temporary public RPC throttle
      } else {
        console.warn("Vault data read notice:", errMsg);
      }
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [userAddress]);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 4000);
    return () => clearInterval(timer);
  }, [fetchData]);

  return {
    ...state,
    refresh: fetchData,
  };
}

// -------------------------------------------------------------
// REAL ON-CHAIN TRANSACTION EXECUTORS
// -------------------------------------------------------------

export interface TxExecutionResult {
  success: boolean;
  hash?: string;
  link?: string;
  error?: string;
}

export interface TxExecutionOptions {
  walletProvider?: any;
  account?: string;
  onNotify?: (msg: string) => void;
}

/**
 * Resolves the active wallet provider and account.
 * Prioritizes the user's specific ConnectKit-selected connector provider.
 */
async function resolveProviderAndAccount(
  customProvider?: any,
  providedAccount?: string,
): Promise<{ provider: any; account: `0x${string}` }> {
  let provider = customProvider;
  if (!provider && typeof window !== "undefined") {
    provider = (window as unknown as { ethereum?: unknown }).ethereum;
  }
  if (!provider) {
    throw new Error(
      "No Web3 wallet provider detected. Please connect your wallet via ConnectKit.",
    );
  }

  let userAccount: `0x${string}` | undefined = providedAccount as `0x${string}`;
  if (!userAccount) {
    try {
      const accounts = (await provider.request({
        method: "eth_accounts",
      })) as string[];
      if (accounts && accounts.length > 0) {
        userAccount = accounts[0] as `0x${string}`;
      } else {
        const requested = (await provider.request({
          method: "eth_requestAccounts",
        })) as string[];
        userAccount = requested[0] as `0x${string}`;
      }
    } catch {
      throw new Error(
        "Unable to retrieve account from connected wallet extension.",
      );
    }
  }

  return { provider, account: userAccount };
}

/**
 * Auto-switches the connected wallet provider to the target chain.
 * Sends real-time progress notifications to the UI.
 */
export async function ensureNetworkOnProvider(
  provider: any,
  targetChainId: number,
  onNotify?: (msg: string) => void,
): Promise<void> {
  if (!provider || typeof provider.request !== "function") return;

  const currentChainHex = await provider.request({ method: "eth_chainId" });
  const currentChainId = parseInt(currentChainHex, 16);
  if (currentChainId === targetChainId) return;

  const chainName =
    targetChainId === 84532 ? "Base Sepolia" : "Ethereum Sepolia";
  const targetHex = "0x" + targetChainId.toString(16);

  if (onNotify) {
    onNotify(`Switching network to ${chainName}...`);
  }

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: targetHex }],
    });
    if (onNotify) {
      onNotify(`Switched network to ${chainName}!`);
    }
  } catch (switchError: any) {
    if (
      switchError.code === 4902 ||
      switchError.data?.originalError?.code === 4902
    ) {
      if (targetChainId === 84532) {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: targetHex,
              chainName: "Base Sepolia",
              nativeCurrency: {
                name: "Ether",
                symbol: "ETH",
                decimals: 18,
              },
              rpcUrls: ["https://sepolia.base.org"],
              blockExplorerUrls: ["https://sepolia.basescan.org"],
            },
          ],
        });
      } else {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: targetHex,
              chainName: "Ethereum Sepolia",
              nativeCurrency: {
                name: "Sepolia Ether",
                symbol: "ETH",
                decimals: 18,
              },
              rpcUrls: ["https://rpc.sepolia.org"],
              blockExplorerUrls: ["https://sepolia.etherscan.io"],
            },
          ],
        });
      }
      if (onNotify) {
        onNotify(`Switched network to ${chainName}!`);
      }
    } else {
      throw new Error(
        `Please approve the network switch to ${chainName} in your wallet.`,
      );
    }
  }
}

/**
 * Executes a live on-chain Deposit:
 * - On Base Sepolia: Approves ERC20 token to Vault, then calls Vault.deposit(token, amount).
 * - On Ethereum Sepolia: Approves ERC20 token to EthereumSepoliaCollateralLock, then calls lock(token, amount).
 * Automatically switches to the correct network and routes to the user's chosen wallet extension.
 */
export async function executeDeposit({
  tokenAddress,
  amount,
  decimals = 18,
  isBridged = false,
  walletProvider,
  account,
  onNotify,
}: {
  tokenAddress: `0x${string}`;
  amount: string;
  decimals?: number;
  isBridged?: boolean;
} & TxExecutionOptions): Promise<TxExecutionResult> {
  try {
    const { provider, account: userAccount } = await resolveProviderAndAccount(
      walletProvider,
      account,
    );

    const normalizedAddr = tokenAddress.toLowerCase();
    const isPerAssetEnabled =
      normalizedAddr === "0x4200000000000000000000000000000000000006" || // ETH
      normalizedAddr === "0xff34b3d4aee8ddcd6f9afffb6fe49bd371b8a357" || // DAI
      normalizedAddr === "0x036cbd53842c5426634e7929541ec2318f3dcf7e"; // USDC

    if (!isPerAssetEnabled) {
      return {
        success: false,
        error: "Per-asset evaluation not yet enabled for this asset",
      };
    }

    const parsedAmount = parseUnits(amount, decimals);

    if (isBridged) {
      // Auto-switch to Ethereum Sepolia
      await ensureNetworkOnProvider(provider, 11155111, onNotify);

      const ethPublicClient = createPublicClient({
        chain: sepolia,
        transport: custom(provider),
      });
      const ethWalletClient = createWalletClient({
        account: userAccount,
        chain: sepolia,
        transport: custom(provider),
      });

      // Pre-flight balance validation
      const tokenBal = (await ethPublicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [userAccount],
      })) as bigint;

      if (tokenBal < parsedAmount) {
        return {
          success: false,
          error: `Insufficient balance: You only hold ${formatUnits(tokenBal, decimals)} tokens on Ethereum Sepolia, cannot deposit ${amount}.`,
        };
      }

      // 1. Approve (only if allowance is insufficient)
      const currentAllowance = (await ethPublicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [userAccount, ETHEREUM_LOCK_ADDRESS],
      })) as bigint;

      if (currentAllowance < parsedAmount) {
        if (onNotify) onNotify("Approving token for cross-chain lock...");
        const approveHash = await ethWalletClient.writeContract({
          account: userAccount,
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [ETHEREUM_LOCK_ADDRESS, parsedAmount],
          gas: 100000n,
        });
        await ethPublicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      // 2. Lock
      if (onNotify) onNotify("Locking collateral on Ethereum Sepolia...");
      const lockHash = await ethWalletClient.writeContract({
        account: userAccount,
        address: ETHEREUM_LOCK_ADDRESS,
        abi: ETHEREUM_LOCK_ABI,
        functionName: "lock",
        args: [tokenAddress, parsedAmount],
        gas: 250000n,
      });
      await ethPublicClient.waitForTransactionReceipt({ hash: lockHash });

      return {
        success: true,
        hash: lockHash,
        link: `https://sepolia.etherscan.io/tx/${lockHash}`,
      };
    } else {
      // Auto-switch to Base Sepolia
      await ensureNetworkOnProvider(provider, 84532, onNotify);

      const basePublicClient = createPublicClient({
        chain: baseSepolia,
        transport: custom(provider),
      });
      const baseWalletClient = createWalletClient({
        account: userAccount,
        chain: baseSepolia,
        transport: custom(provider),
      });

      const isWeth =
        normalizedAddr === "0x4200000000000000000000000000000000000006";

      // 0. Balance Validation & Auto-wrap for ETH / WETH
      const erc20Balance = (await basePublicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [userAccount],
      })) as bigint;

      if (isWeth && erc20Balance < parsedAmount) {
        const needed = parsedAmount - erc20Balance;
        const nativeBal = await basePublicClient.getBalance({
          address: userAccount,
        });
        const gasBuffer = parseUnits("0.0005", 18);

        if (nativeBal < needed + gasBuffer) {
          const totalAvail =
            erc20Balance + (nativeBal > gasBuffer ? nativeBal - gasBuffer : 0n);
          return {
            success: false,
            error: `Insufficient balance: You have ${formatUnits(erc20Balance, 18).slice(0, 6)} WETH and ${formatUnits(nativeBal, 18).slice(0, 6)} native ETH (~${formatUnits(totalAvail, 18).slice(0, 6)} ETH usable), cannot deposit ${amount} ETH.`,
          };
        }

        if (onNotify)
          onNotify(
            `Wrapping ${formatUnits(needed, 18).slice(0, 6)} native ETH to WETH...`,
          );
        const wrapHash = await baseWalletClient.writeContract({
          account: userAccount,
          address: tokenAddress,
          abi: WETH_ABI,
          functionName: "deposit",
          value: needed,
        });
        await basePublicClient.waitForTransactionReceipt({ hash: wrapHash });
      } else if (!isWeth && erc20Balance < parsedAmount) {
        return {
          success: false,
          error: `Insufficient balance: You hold ${formatUnits(erc20Balance, decimals)} tokens, cannot deposit ${amount}.`,
        };
      }

      // 1. Approve (only if allowance is insufficient)
      const currentAllowance = (await basePublicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [userAccount, VAULT_ADDRESS],
      })) as bigint;

      if (currentAllowance < parsedAmount) {
        if (onNotify) onNotify("Approving token for Meridian Vault...");
        const approveHash = await baseWalletClient.writeContract({
          account: userAccount,
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [VAULT_ADDRESS, parsedAmount],
          gas: 100000n,
        });
        await basePublicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      // 2. Deposit into Vault
      if (onNotify) onNotify("Depositing collateral into Meridian Vault...");
      const depositHash = await baseWalletClient.writeContract({
        account: userAccount,
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: "deposit",
        args: [tokenAddress, parsedAmount],
        gas: 300000n,
      });
      await basePublicClient.waitForTransactionReceipt({ hash: depositHash });

      return {
        success: true,
        hash: depositHash,
        link: `https://sepolia.basescan.org/tx/${depositHash}`,
      };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (
      errorMsg.includes("User rejected") ||
      errorMsg.includes("user rejected")
    ) {
      return { success: false, error: "Transaction rejected in wallet." };
    }
    return { success: false, error: errorMsg };
  }
}

/**
 * Executes a live on-chain Mint of mUSD against collateral on Base Sepolia.
 * Auto-switches to Base Sepolia, ensures non-zero collateral, and uses explicit safe gas.
 */
export async function executeMint({
  tokenAddress,
  amountMusd,
  walletProvider,
  account,
  onNotify,
}: {
  tokenAddress: `0x${string}`;
  amountMusd: string;
} & TxExecutionOptions): Promise<TxExecutionResult> {
  try {
    const { provider, account: userAccount } = await resolveProviderAndAccount(
      walletProvider,
      account,
    );

    // Auto-switch to Base Sepolia
    await ensureNetworkOnProvider(provider, 84532, onNotify);

    const basePublicClient = createPublicClient({
      chain: baseSepolia,
      transport: custom(provider),
    });
    const baseWalletClient = createWalletClient({
      account: userAccount,
      chain: baseSepolia,
      transport: custom(provider),
    });

    const normalizedAddr = tokenAddress.toLowerCase();
    const isPerAssetEnabled =
      normalizedAddr === "0x4200000000000000000000000000000000000006" || // ETH
      normalizedAddr === "0xff34b3d4aee8ddcd6f9afffb6fe49bd371b8a357" || // DAI
      normalizedAddr === "0x036cbd53842c5426634e7929541ec2318f3dcf7e"; // USDC

    if (!isPerAssetEnabled) {
      return {
        success: false,
        error: "Per-asset evaluation not yet enabled for this asset",
      };
    }

    // Pre-flight check: Caller must hold deposited collateral in this token
    const userCollateral = (await basePublicClient.readContract({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: "collateral",
      args: [tokenAddress, userAccount],
    })) as bigint;

    let hasCollateral = userCollateral > 0n;
    if (!hasCollateral) {
      const userBridged = (await basePublicClient.readContract({
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: "bridgedCollateral",
        args: [tokenAddress, userAccount],
      })) as bigint;
      hasCollateral = userBridged > 0n;
    }

    if (!hasCollateral) {
      return {
        success: false,
        error:
          "You hold zero deposited balance of this collateral asset in the Vault. Please deposit it first before borrowing mUSD against it.",
      };
    }

    const parsedAmount = parseEther(amountMusd);

    // Pre-flight check: Calculate maximum borrowing capacity
    const [totalCollatUSD, userDebt, assetReqCR, globalReqCR] =
      await Promise.all([
        basePublicClient.readContract({
          address: VAULT_ADDRESS,
          abi: VAULT_ABI,
          functionName: "getTotalCollateralValueUSD",
          args: [userAccount],
        }) as Promise<bigint>,
        basePublicClient.readContract({
          address: VAULT_ADDRESS,
          abi: VAULT_ABI,
          functionName: "debt",
          args: [userAccount],
        }) as Promise<bigint>,
        basePublicClient.readContract({
          address: VAULT_ADDRESS,
          abi: VAULT_ABI,
          functionName: "assetRequiredCRBps",
          args: [tokenAddress],
        }) as Promise<bigint>,
        basePublicClient.readContract({
          address: VAULT_ADDRESS,
          abi: VAULT_ABI,
          functionName: "requiredCRBps",
        }) as Promise<bigint>,
      ]);

    const activeReqCR = assetReqCR > 0n ? assetReqCR : globalReqCR;
    const maxDebtAllowed = (totalCollatUSD * 10000n) / activeReqCR;
    const maxMintAllowed =
      maxDebtAllowed > userDebt ? maxDebtAllowed - userDebt : 0n;

    if (parsedAmount > maxMintAllowed) {
      const formattedMax = formatEther(maxMintAllowed);
      return {
        success: false,
        error: `Insufficient collateral: With your deposited collateral ($${parseFloat(formatEther(totalCollatUSD)).toFixed(2)}), you can mint up to ${parseFloat(formattedMax).toFixed(2)} mUSD at ${(Number(activeReqCR) / 100).toFixed(0)}% MCR. You requested ${amountMusd} mUSD.`,
      };
    }

    if (onNotify) onNotify("Confirming mUSD mint in your wallet...");
    const mintHash = await baseWalletClient.writeContract({
      account: userAccount,
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: "mint",
      args: [tokenAddress, parsedAmount],
      gas: 350000n,
    });
    if (onNotify)
      onNotify("Transaction submitted. Waiting for confirmation...");
    await basePublicClient.waitForTransactionReceipt({ hash: mintHash });

    return {
      success: true,
      hash: mintHash,
      link: `https://sepolia.basescan.org/tx/${mintHash}`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg.includes("ZeroCollateralBalance")) {
      return {
        success: false,
        error:
          "Reverted on-chain: You hold zero deposited balance of this collateral asset. You must deposit it first before minting against it.",
      };
    }
    if (errorMsg.includes("InsufficientCollateral")) {
      return {
        success: false,
        error: "Insufficient collateral ratio to mint this amount of mUSD.",
      };
    }
    if (
      errorMsg.includes("User rejected") ||
      errorMsg.includes("user rejected")
    ) {
      return { success: false, error: "Transaction rejected in wallet." };
    }
    return { success: false, error: errorMsg };
  }
}

/**
 * Executes a live on-chain Repayment of mUSD debt on Base Sepolia.
 * Includes pre-flight validations against user debt and mUSD balance,
 * auto-switches to Base Sepolia, and uses safe explicit gas limit to prevent RPC blowout.
 */
export async function executeRepay({
  tokenAddress,
  amountMusd,
  walletProvider,
  account,
  onNotify,
}: {
  tokenAddress: `0x${string}`;
  amountMusd: string;
} & TxExecutionOptions): Promise<TxExecutionResult> {
  try {
    const { provider, account: userAccount } = await resolveProviderAndAccount(
      walletProvider,
      account,
    );

    // Auto-switch to Base Sepolia
    await ensureNetworkOnProvider(provider, 84532, onNotify);

    const basePublicClient = createPublicClient({
      chain: baseSepolia,
      transport: custom(provider),
    });
    const baseWalletClient = createWalletClient({
      account: userAccount,
      chain: baseSepolia,
      transport: custom(provider),
    });

    const parsedAmount = parseEther(amountMusd);

    // 1. Pre-flight check: User's outstanding debt on Vault and mUSD balance
    const [currentDebt, userMusdBalance] = await Promise.all([
      basePublicClient.readContract({
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: "debt",
        args: [userAccount],
      }) as Promise<bigint>,
      basePublicClient.readContract({
        address: MUSD_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [userAccount],
      }) as Promise<bigint>,
    ]);

    if (currentDebt === 0n) {
      return {
        success: false,
        error: "You currently have 0 mUSD outstanding debt on this vault.",
      };
    }

    // Auto-cap repayment amount if slightly higher than currentDebt (e.g. from rounding or clicking MAX)
    let actualRepayAmount = parsedAmount;
    if (actualRepayAmount > currentDebt) {
      actualRepayAmount = currentDebt;
    }

    if (userMusdBalance < actualRepayAmount) {
      const formattedBal = formatEther(userMusdBalance);
      return {
        success: false,
        error: `Insufficient mUSD balance in your wallet. You hold ${parseFloat(formattedBal).toFixed(4)} mUSD, cannot repay ${formatEther(actualRepayAmount).slice(0, 6)} mUSD.`,
      };
    }

    // 2. Call repay on Vault with safe gas limit
    if (onNotify) onNotify("Confirming repayment in your wallet...");
    const repayHash = await baseWalletClient.writeContract({
      account: userAccount,
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: "repay",
      args: [tokenAddress, actualRepayAmount],
      gas: 300000n,
    });

    if (onNotify)
      onNotify("Transaction submitted. Waiting for confirmation...");
    await basePublicClient.waitForTransactionReceipt({ hash: repayHash });

    return {
      success: true,
      hash: repayHash,
      link: `https://sepolia.basescan.org/tx/${repayHash}`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg.includes("DebtExceeded")) {
      return {
        success: false,
        error: "Repayment amount exceeds your outstanding debt on this vault.",
      };
    }
    if (errorMsg.includes("InsufficientBalance")) {
      return {
        success: false,
        error: "Insufficient mUSD balance to complete repayment.",
      };
    }
    if (
      errorMsg.includes("User rejected") ||
      errorMsg.includes("user rejected")
    ) {
      return { success: false, error: "Transaction rejected in wallet." };
    }
    return { success: false, error: errorMsg };
  }
}

/**
 * Executes a live on-chain Withdrawal of collateral:
 * - Native collateral: Calls Vault.withdraw(token, amount).
 * - Bridged collateral: Calls Vault.withdrawBridgedCollateral(token, amount), initiating cross-chain LayerZero unlock.
 * Auto-switches to Base Sepolia, pre-validates collateral balance, and uses safe explicit gas limit.
 */
export async function executeWithdraw({
  tokenAddress,
  amount,
  decimals = 18,
  isBridged = false,
  walletProvider,
  account,
  onNotify,
}: {
  tokenAddress: `0x${string}`;
  amount: string;
  decimals?: number;
  isBridged?: boolean;
} & TxExecutionOptions): Promise<TxExecutionResult> {
  try {
    const { provider, account: userAccount } = await resolveProviderAndAccount(
      walletProvider,
      account,
    );

    // Auto-switch to Base Sepolia
    await ensureNetworkOnProvider(provider, 84532, onNotify);

    const basePublicClient = createPublicClient({
      chain: baseSepolia,
      transport: custom(provider),
    });
    const baseWalletClient = createWalletClient({
      account: userAccount,
      chain: baseSepolia,
      transport: custom(provider),
    });

    const parsedAmount = parseUnits(amount, decimals);

    if (isBridged) {
      if (onNotify) onNotify("Initiating cross-chain collateral withdrawal...");
      const withdrawHash = await baseWalletClient.writeContract({
        account: userAccount,
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: "withdrawBridgedCollateral",
        args: [tokenAddress, parsedAmount],
        gas: 350000n,
      });
      if (onNotify)
        onNotify("Transaction submitted. Waiting for confirmation...");
      await basePublicClient.waitForTransactionReceipt({ hash: withdrawHash });

      return {
        success: true,
        hash: withdrawHash,
        link: `https://sepolia.basescan.org/tx/${withdrawHash}`,
      };
    } else {
      if (onNotify) onNotify("Confirming collateral withdrawal...");
      const withdrawHash = await baseWalletClient.writeContract({
        account: userAccount,
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: "withdraw",
        args: [tokenAddress, parsedAmount],
        gas: 350000n,
      });
      if (onNotify)
        onNotify("Transaction submitted. Waiting for confirmation...");
      await basePublicClient.waitForTransactionReceipt({ hash: withdrawHash });

      return {
        success: true,
        hash: withdrawHash,
        link: `https://sepolia.basescan.org/tx/${withdrawHash}`,
      };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg.includes("InsufficientBalance")) {
      return {
        success: false,
        error: "Withdrawal amount exceeds your deposited collateral balance.",
      };
    }
    if (errorMsg.includes("InsufficientCollateral")) {
      return {
        success: false,
        error:
          "Cannot withdraw: remaining collateral would breach required collateral ratio.",
      };
    }
    if (
      errorMsg.includes("User rejected") ||
      errorMsg.includes("user rejected")
    ) {
      return { success: false, error: "Transaction rejected in wallet." };
    }
    return { success: false, error: errorMsg };
  }
}
