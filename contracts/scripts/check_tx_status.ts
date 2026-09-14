import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

async function main() {
  const client = createClient({ chain: testnetBradbury });
  const txHash =
    "0xc18f470ccb5f3c33fa6756e455c54ef025d1b388c519ba3d5806c9210bd073ce";

  try {
    const status = await client.request({
      method: "gen_getTransactionStatus",
      params: [txHash],
    });
    console.log("Raw Status:", status);
  } catch (e: any) {
    console.log("Status error:", e.message);
  }

  try {
    const receipt = await client.request({
      method: "gen_getTransactionReceipt",
      params: [{ txId: txHash }],
    });
    console.log("Receipt:", receipt);
  } catch (e: any) {
    console.log("Receipt error:", e.message);
  }
}

main();
