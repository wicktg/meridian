import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

async function main() {
  const client = createClient({ chain: testnetBradbury });
  const consensusAddress = client.chain.consensusMainContract
    ?.address as `0x${string}`;

  const addrManager = await client.readContract({
    address: consensusAddress,
    abi: [
      {
        name: "getAddressManager",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ type: "address" }],
      },
    ],
    functionName: "getAddressManager",
    args: [],
  });
  console.log("Address Manager:", addrManager);
}

main().catch(console.error);
