import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

async function main() {
  const client = createClient({ chain: testnetBradbury });
  const txs = [
    {
      name: "Finalized 1",
      hash: "0xa1e64700150a0226cea7cd3755ca57f260c3819dc3e0e07ef42b39b256047349",
    },
    {
      name: "Finalized 2",
      hash: "0xdab2e387c2e469c4f5057015367a11afaf3c75e14c41dc14efe862656953cab3",
    },
    {
      name: "Finalized 3",
      hash: "0xc18f470ccb5f3c33fa6756e455c54ef025d1b388c519ba3d5806c9210bd073ce",
    },
    {
      name: "Finalized 4",
      hash: "0x8400026c73ab480399a36281d5eb7322b7261c9a036dae73f07e27ffce5f1aa9",
    },
    {
      name: "Pending ETH",
      hash: "0x513f29b8fdb2139b0eb49a5cf241d5a5a28746d0672f0f19d3a6e699be7f2186",
    },
  ];

  for (const item of txs) {
    const tx = await client.getTransaction({
      hash: item.hash as `0x${string}`,
    });
    console.log(`\n=== ${item.name} (${item.hash}) ===`);
    console.log(`  status: ${tx?.status} (${(tx as any)?.statusName})`);
    console.log(`  sender: ${tx?.sender}`);
    console.log(`  recipient: ${tx?.recipient}`);
    console.log(`  txSlot: ${(tx as any)?.txSlot}`);
    console.log(`  createdTimestamp: ${(tx as any)?.createdTimestamp}`);
    console.log(`  readStateBlockRange:`, (tx as any)?.readStateBlockRange);
    console.log(`  txExecutionResult: ${(tx as any)?.txExecutionResultName}`);
  }
}

main().catch(console.error);
