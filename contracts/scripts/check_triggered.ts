import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

async function main() {
  const client = createClient({ chain: testnetBradbury });
  const address = "0xe4d9E11a2D4824CD49DCA396eD01f20FEDE6065E";

  // Check pending or triggered txs
  try {
    const triggered = await (client as any).getTriggeredTransactionIds?.({
      address,
    });
    console.log("Triggered tx ids:", triggered);
  } catch (e: any) {
    console.log("getTriggeredTransactionIds err:", e.message);
  }
}

main().catch(console.error);
