import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

async function main() {
  const client = createClient({ chain: testnetBradbury });
  const addr = "0x2C9dE921f5B10468D53f4bd49DFd98414d5f6380";
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

  try {
    const regime = await client.readContract({
      address: addr,
      functionName: "get_regime",
      args: [],
    });
    console.log("get_regime result:", regime);
  } catch (e: any) {
    console.log("get_regime err:", e.message);
  }
}

main().catch(console.error);
