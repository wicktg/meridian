import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { transactionsStatusNumberToName } from "genlayer-js/types";

async function main() {
  const client = createClient({ chain: testnetBradbury });
  const txs = [
    "0xa1e64700150a0226cea7cd3755ca57f260c3819dc3e0e07ef42b39b256047349",
    "0xdab2e387c2e469c4f5057015367a11afaf3c75e14c41dc14efe862656953cab3",
    "0xc18f470ccb5f3c33fa6756e455c54ef025d1b388c519ba3d5806c9210bd073ce",
    "0x8400026c73ab480399a36281d5eb7322b7261c9a036dae73f07e27ffce5f1aa9",
    "0x513f29b8fdb2139b0eb49a5cf241d5a5a28746d0672f0f19d3a6e699be7f2186",
    "0xeed562d6bfc17598da574ea520775e18d3266bb839ffbd22a8eaf1ca8793a8a1",
    "0x5171268b08ca376be572ef62e7e0b985a994a0a5e8c516048ea6b5042774933b",
  ];

  for (const hash of txs) {
    try {
      const tx = await client.getTransaction({ hash: hash as `0x${string}` });
      const name =
        transactionsStatusNumberToName[String(tx?.status)] || tx?.status;
      console.log(`TX ${hash}: status = ${tx?.status} (${name})`);
    } catch (e: any) {
      console.log(`TX ${hash}: error: ${e.message}`);
    }
  }
}

main().catch(console.error);
