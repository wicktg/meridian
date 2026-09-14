import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

async function main() {
  const client = createClient({ chain: testnetBradbury });
  const txs = [
    {
      name: "ETH",
      hash: "0x513f29b8fdb2139b0eb49a5cf241d5a5a28746d0672f0f19d3a6e699be7f2186",
    },
    {
      name: "DAI",
      hash: "0xeed562d6bfc17598da574ea520775e18d3266bb839ffbd22a8eaf1ca8793a8a1",
    },
    {
      name: "USDC",
      hash: "0x5171268b08ca376be572ef62e7e0b985a994a0a5e8c516048ea6b5042774933b",
    },
  ];

  for (const item of txs) {
    console.log(`\n--- Checking ${item.name} (${item.hash}) ---`);
    try {
      const statusRes = await client.request({
        method: "gen_getTransactionStatus",
        params: [item.hash],
      });
      console.log("Status:", JSON.stringify(statusRes));
    } catch (e: any) {
      console.log("Status error:", e.message);
    }

    try {
      const tx = await client.getTransaction({
        hash: item.hash as `0x${string}`,
      });
      console.log("getTransaction:", {
        status: tx?.status,
        from: tx?.from,
        to: tx?.to,
        hash: tx?.hash,
      });
    } catch (e: any) {
      console.log("getTransaction error:", e.message);
    }
  }
}

main().catch(console.error);
