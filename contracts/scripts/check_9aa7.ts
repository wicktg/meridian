import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

async function main() {
  const client = createClient({ chain: testnetBradbury });
  const addr = "0x9aa7cf833cdff6a4b1b452238b8db6d650004965";
  console.log("Reading state from", addr);
  try {
    const res = await client.readContract({
      address: addr,
      functionName: "get_state",
      args: [],
    });
    console.log("get_state result:", JSON.stringify(res, null, 2));
  } catch (e: any) {
    console.log("get_state err:", e.message);
  }
}

main().catch(console.error);
