import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

async function main() {
  const client = createClient({ chain: testnetBradbury });
  const blockNumber = await client.getBlockNumber();
  console.log("Current block:", blockNumber.toString());

  // Check last 10 blocks for transactions
  for (let b = blockNumber; b > blockNumber - 15n; b--) {
    const blk = await client.getBlock({ blockNumber: b });
    if (blk.transactions && blk.transactions.length > 0) {
      console.log(
        `Block ${b} has ${blk.transactions.length} txs:`,
        blk.transactions,
      );
      for (const tHash of blk.transactions.slice(0, 3)) {
        const tx = await client.getTransaction({
          hash: tHash as `0x${string}`,
        });
        console.log(
          `  Tx ${tHash}: to=${tx?.to}, status=${tx?.status}, txSlot=${(tx as any)?.txSlot}`,
        );
      }
    }
  }
}

main().catch(console.error);
