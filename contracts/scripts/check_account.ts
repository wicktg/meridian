import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

async function main() {
  const client = createClient({ chain: testnetBradbury });
  const address = "0xe4d9E11a2D4824CD49DCA396eD01f20FEDE6065E";

  try {
    const nonce = await client.getTransactionCount({ address });
    console.log("Account Nonce / TxCount:", nonce);
  } catch (e: any) {
    console.log("Nonce err:", e.message);
  }

  try {
    const balance = await client.getBalance({ address });
    console.log("Account Balance:", balance.toString());
  } catch (e: any) {
    console.log("Balance err:", e.message);
  }

  try {
    const currentNonce = await (client as any).getCurrentNonce({ address });
    console.log("getCurrentNonce:", currentNonce);
  } catch (e: any) {
    console.log("getCurrentNonce err:", e.message);
  }

  const ethHash =
    "0x513f29b8fdb2139b0eb49a5cf241d5a5a28746d0672f0f19d3a6e699be7f2186";
  try {
    const qPos = await (client as any).getTransactionQueuePosition({
      hash: ethHash,
    });
    console.log("ETH queue position:", qPos);
  } catch (e: any) {
    console.log("ETH queue position err:", e.message);
  }
}

main().catch(console.error);
