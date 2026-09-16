"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Live GenLayer Studio Next contract state.
 * Fetched from /api/bedrock which reads the deployed BedrockCore contract
 * on Chain ID 61997 at 0x420c9791cF622A5C7c9D58a51dd214b8B1b6Ca9E.
 */

export const BEDROCK_CONTRACT_ADDRESS =
  "0x4423BC844C77437Ca5BE285f712E5c6369f2E351";
export const BEDROCK_DEPLOY_TX =
  "0x07e78220c7d6e52ea9b9e47dbc1d400d0b1849e3d97b3987bec9a43b43ad2ca9";
export const GENLAYER_EXPLORER_BASE =
  "https://explorer-studio-dev.genlayer.com";

export interface BedrockAssetState {
  symbol: string;
  name: string;
  regime: string;
  requiredCR: string | null;
  stabilityFee: string | null;
  mintHalted: boolean;
  reasoning: string;
  enabled: boolean;
  lastTimestamp: number;
  genlayerTxHash: string;
  genlayerExplorerUrl: string;
  verified: boolean;
  conditionsSatisfied: boolean;
  statusIndicator: string;
}

export interface BedrockState {
  source: "live" | "fallback" | "error";
  network: string;
  chainId: number;
  contractAddress: string;
  deployTxHash: string;
  explorerUrl: string;
  globalRegime: string;
  globalReasoning: string;
  assets: Record<string, BedrockAssetState>;
  timestamp: string;
  isLoading: boolean;
  error?: string;
}

const FALLBACK_STATE: BedrockState = {
  source: "fallback",
  network: "GenLayer Studio Next",
  chainId: 61997,
  contractAddress: BEDROCK_CONTRACT_ADDRESS,
  deployTxHash: BEDROCK_DEPLOY_TX,
  explorerUrl: `${GENLAYER_EXPLORER_BASE}/address/${BEDROCK_CONTRACT_ADDRESS}`,
  globalRegime: "Stable",
  globalReasoning: "Protocol initialized in Stable regime.",
  assets: {
    ETH: {
      symbol: "ETH",
      name: "Ethereum",
      regime: "Stable",
      requiredCR: "150%",
      stabilityFee: "2.00%",
      mintHalted: false,
      reasoning:
        "ETH operating normally: spot price and volatility within healthy bounds.",
      enabled: true,
      lastTimestamp: Math.floor(Date.now() / 1000),
      genlayerTxHash: BEDROCK_DEPLOY_TX,
      genlayerExplorerUrl: `${GENLAYER_EXPLORER_BASE}/address/${BEDROCK_CONTRACT_ADDRESS}`,
      verified: true,
      conditionsSatisfied: true,
      statusIndicator: "green_flag",
    },
    DAI: {
      symbol: "DAI",
      name: "Dai Stablecoin",
      regime: "Stable",
      requiredCR: "150%",
      stabilityFee: "2.00%",
      mintHalted: false,
      reasoning:
        "DAI peg is stable at $0.9998 (-0.02% parity) with fresh oracle heartbeats.",
      enabled: true,
      lastTimestamp: Math.floor(Date.now() / 1000),
      genlayerTxHash: BEDROCK_DEPLOY_TX,
      genlayerExplorerUrl: `${GENLAYER_EXPLORER_BASE}/address/${BEDROCK_CONTRACT_ADDRESS}`,
      verified: true,
      conditionsSatisfied: true,
      statusIndicator: "green_flag",
    },
    USDC: {
      symbol: "USDC",
      name: "USD Coin",
      regime: "Stable",
      requiredCR: "150%",
      stabilityFee: "2.00%",
      mintHalted: false,
      reasoning: "USDC peg fully backed and stable at $1.00 parity.",
      enabled: true,
      lastTimestamp: Math.floor(Date.now() / 1000),
      genlayerTxHash: BEDROCK_DEPLOY_TX,
      genlayerExplorerUrl: `${GENLAYER_EXPLORER_BASE}/address/${BEDROCK_CONTRACT_ADDRESS}`,
      verified: true,
      conditionsSatisfied: true,
      statusIndicator: "green_flag",
    },
  },
  timestamp: new Date().toISOString(),
  isLoading: false,
};

export function useBedrockState(): BedrockState {
  const [state, setState] = useState<BedrockState>({
    ...FALLBACK_STATE,
    isLoading: true,
  });

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/bedrock", { next: { revalidate: 30 } });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setState({
        ...data,
        source: data.source || "live",
        isLoading: false,
      });
    } catch (err) {
      // Use fallback on error
      setState({
        ...FALLBACK_STATE,
        source: "fallback",
        isLoading: false,
        error: err instanceof Error ? err.message : "Fetch failed",
      });
    }
  }, []);

  useEffect(() => {
    fetchState();
    // Refresh every 60 seconds
    const interval = setInterval(fetchState, 60_000);
    return () => clearInterval(interval);
  }, [fetchState]);

  return state;
}
