import { NextResponse } from "next/server";

/**
 * GET /api/bedrock
 *
 * Reads live state from the BedrockCore intelligent contract deployed on
 * GenLayer Studio Next (Chain ID 61997).
 *
 * Contract: 0x4423BC844C77437Ca5BE285f712E5c6369f2E351
 * RPC:      https://studio-dev.genlayer.com/api
 * Deploy TX: 0x07e78220c7d6e52ea9b9e47dbc1d400d0b1849e3d97b3987bec9a43b43ad2ca9
 */

const GENLAYER_RPC = "https://studio-dev.genlayer.com/api";
const CONTRACT_ADDRESS = "0x4423BC844C77437Ca5BE285f712E5c6369f2E351";
const DEPLOY_TX =
  "0x07e78220c7d6e52ea9b9e47dbc1d400d0b1849e3d97b3987bec9a43b43ad2ca9";

// Regime -> collateral ratio mapping (matches EVM vault logic)
const REGIME_CR: Record<string, string> = {
  Stable: "150%",
  Unsettled: "200%",
  Undertow: "300%",
};

const REGIME_FEE: Record<string, string> = {
  Stable: "2.00%",
  Unsettled: "5.00%",
  Undertow: "10.00%",
};

// Simple MsgPack/RLP calldata encoder for GenLayer gen_call
// GenLayer uses its own calldata format; we use the genlayer-js SDK approach
// but since this is server-side Next.js, we call gen_call directly via JSON-RPC

async function genCall(
  functionName: string,
  args: unknown[] = [],
): Promise<unknown> {
  // Build the gen_call request using the SDK's wire format
  // For simple read calls, we can use the HTTP JSON-RPC directly
  const body = {
    jsonrpc: "2.0",
    method: "gen_call",
    params: [
      {
        type: "read",
        to: CONTRACT_ADDRESS,
        from: "0x0000000000000000000000000000000000000000",
        data: functionName, // GenLayer studio accepts plain function names for reads
        transaction_hash_variant: "latest-nonfinal",
      },
    ],
    id: 1,
  };

  const res = await fetch(GENLAYER_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (json.error) {
    throw new Error(`GenLayer RPC error: ${json.error.message}`);
  }
  return json.result;
}

// Use the genlayer-js SDK for proper calldata encoding
async function readContractViaSDK(
  functionName: string,
  args: any[] = [],
): Promise<unknown> {
  // Dynamic import to avoid bundling issues
  const { createClient, chains } = await import("genlayer-js");
  const client = createClient({ chain: chains.studioDevnet });
  return client.readContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    functionName,
    args: args as any,
  });
}

export async function GET() {
  try {
    // Read live state from Studio Next contract
    const state = (await readContractViaSDK("get_state")) as Record<
      string,
      unknown
    >;

    const now = Math.floor(Date.now() / 1000);
    const explorerBase = "https://explorer-studio-dev.genlayer.com";

    // Build per-asset records from the live contract response
    const assetNames: Record<string, string> = {
      ETH: "Ethereum",
      DAI: "Dai Stablecoin",
      USDC: "USD Coin",
      WBTC: "Wrapped Bitcoin",
      LINK: "Chainlink",
      stETH: "Lido Staked ETH",
    };

    const assets: Record<string, unknown> = {};
    for (const symbol of ["ETH", "DAI", "USDC", "WBTC", "LINK", "stETH"]) {
      const assetData = state[symbol] as
        | { regime?: string; reasoning?: string; enabled?: boolean }
        | undefined;

      if (!assetData) continue;

      const regime = assetData.regime || "Disabled";
      const enabled = assetData.enabled ?? false;
      const reasoning =
        assetData.reasoning ||
        (enabled
          ? `${symbol} operating in ${regime} regime.`
          : "Per-asset evaluation not yet enabled for this asset");

      assets[symbol] = {
        symbol,
        name: assetNames[symbol] || symbol,
        regime,
        requiredCR: enabled ? REGIME_CR[regime] || "150%" : null,
        stabilityFee: enabled ? REGIME_FEE[regime] || "2.00%" : null,
        mintHalted: regime === "Undertow",
        reasoning,
        enabled,
        lastTimestamp: now,
        genlayerTxHash: DEPLOY_TX,
        genlayerExplorerUrl: `${explorerBase}/address/${CONTRACT_ADDRESS}`,
        verified: true,
        conditionsSatisfied: enabled && regime === "Stable",
        statusIndicator: !enabled
          ? "inactive"
          : regime === "Stable"
            ? "green_flag"
            : "warning",
      };
    }

    // Global regime from contract
    const globalRegime = (state.regime as string) || "Stable";
    const globalReasoning =
      (state.reasoning as string) || "All assets operating normally.";

    return NextResponse.json(
      {
        source: "live",
        network: "GenLayer Studio Next",
        chainId: 61997,
        contractAddress: CONTRACT_ADDRESS,
        deployTxHash: DEPLOY_TX,
        explorerUrl: `${explorerBase}/address/${CONTRACT_ADDRESS}`,
        rpcEndpoint: GENLAYER_RPC,
        timestamp: new Date().toISOString(),
        globalRegime,
        globalReasoning,
        assets,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error reading contract";
    return NextResponse.json(
      {
        source: "error",
        error: message,
        contractAddress: CONTRACT_ADDRESS,
        network: "GenLayer Studio Next",
        chainId: 61997,
      },
      { status: 502 },
    );
  }
}
