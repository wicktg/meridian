import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

async function main() {
  const client = createClient({ chain: testnetBradbury });
  console.log(
    "Consensus main contract:",
    client.chain.consensusMainContract?.address,
  );

  const blockNum = await client.getBlockNumber();
  console.log("Current block number:", blockNum.toString());

  // Let's check getBlock
  const block = await client.getBlock();
  console.log(
    "Latest block timestamp:",
    new Date(Number(block.timestamp) * 1000).toISOString(),
  );
  console.log("Block tx count:", block.transactions.length);
}

main().catch(console.error);
