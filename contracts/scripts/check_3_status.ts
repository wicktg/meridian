import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { transactionsStatusNumberToName } from "genlayer-js/types";

async function main() {
  const client = createClient({ chain: testnetBradbury });
  const txs = [
    {
      name: "ETH",
      hash: "0x513f29b8fdb2139b0eb49a5cf241d5a5a28746d0672f0f19d3a6e699be7f2186",
    },
    {
      name: "DAI",
      hash: "0xeed562d6bfc17598da574ea520775e18d3266bb839ffbd22a8eaf1ca8793a8a1",
    },
    {
      name: "USDC",
      hash: "0x5171268b08ca376be572ef62e7e0b985a994a0a5e8c516048ea6b5042774933b",
    },
  ];

  for (const item of txs) {
    const tx = await client.getTransaction({
      hash: item.hash as `0x${string}`,
    });
    const statusName =
      transactionsStatusNumberToName[String(tx?.status)] || tx?.status;
    console.log(
      `${item.name} (${item.hash}): status = ${tx?.status} (${statusName}), txSlot: ${(tx as any)?.txSlot}, queuePos: ${(tx as any)?.queuePosition}, activator: ${(tx as any)?.activator}`,
    );
    if ((tx as any)?.lastRound) {
      console.log(
        `  lastRound: round ${(tx as any).lastRound.round}, votes: ${(tx as any).lastRound.validatorVotesName?.join(", ")}`,
      );
    }
  }
}

main().catch(console.error);
