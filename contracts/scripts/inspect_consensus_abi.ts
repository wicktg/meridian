import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

async function main() {
  const client = createClient({ chain: testnetBradbury });
  const consensusAddress = client.chain.consensusMainContract?.address;
  const abi = client.chain.consensusMainContract?.abi;

  console.log("Consensus contract functions:");
  const viewFunctions = (abi as any[]).filter(
    (x) =>
      x.type === "function" &&
      (x.stateMutability === "view" || x.stateMutability === "pure"),
  );
  console.log(
    viewFunctions.map(
      (x) =>
        `${x.name}(${x.inputs.map((i: any) => `${i.type} ${i.name}`).join(", ")})`,
    ),
  );
}

main().catch(console.error);
