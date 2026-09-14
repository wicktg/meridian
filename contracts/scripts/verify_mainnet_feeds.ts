import { createPublicClient, http, fallback, parseAbi, Address } from "viem";
import { mainnet } from "viem/chains";

const client = createPublicClient({
  chain: mainnet,
  transport: fallback([
    http("https://cloudflare-eth.com", { timeout: 5000 }),
    http("https://ethereum-rpc.publicnode.com", { timeout: 5000 }),
    http("https://1rpc.io/eth", { timeout: 5000 }),
  ]),
});

const AGG_ABI = parseAbi([
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function getRoundData(uint80 _roundId) view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function decimals() view returns (uint8)",
  "function description() view returns (string)",
]);

const FEEDS: Record<string, Address> = {
  "ETH/USD": "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
  "BTC/USD": "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c",
  "LINK/USD": "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c",
  "stETH/USD": "0xCfE54B5cD566aB89272946F602D76Ea879CAb4a8",
  "DAI/USD": "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9",
  "USDC/USD": "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
};

async function main() {
  console.log(
    "===============================================================",
  );
  console.log("TESTING ETHEREUM MAINNET CHAINLINK ORACLE FEEDS (READ-ONLY)");
  console.log(
    "===============================================================\n",
  );

  const nowSec = Math.floor(Date.now() / 1000);

  for (const [pair, addr] of Object.entries(FEEDS)) {
    try {
      const [desc, dec, round] = await Promise.all([
        client.readContract({
          address: addr,
          abi: AGG_ABI,
          functionName: "description",
        }),
        client.readContract({
          address: addr,
          abi: AGG_ABI,
          functionName: "decimals",
        }),
        client.readContract({
          address: addr,
          abi: AGG_ABI,
          functionName: "latestRoundData",
        }),
      ]);
      const price = Number(round[1]) / 10 ** Number(dec);
      const latencySec = Math.max(0, nowSec - Number(round[3]));
      console.log(`✓ ${desc} (${pair}):`);
      console.log(`  - Address: ${addr}`);
      console.log(`  - Price: $${price.toFixed(4)} USD`);
      console.log(`  - Latency: ${latencySec}s ago`);
      console.log(`  - Round ID: ${round[0].toString()}`);
    } catch (err: any) {
      console.error(`✗ Error on ${pair}:`, err.message);
    }
  }

  // Test historical volatility extraction for ETH/USD
  console.log(
    "\n---------------------------------------------------------------",
  );
  console.log("Testing ETH/USD Historical Volatility via Chainlink Rounds...");
  const ethAddr = FEEDS["ETH/USD"];
  const [ethDec, latestEthRound] = await Promise.all([
    client.readContract({
      address: ethAddr,
      abi: AGG_ABI,
      functionName: "decimals",
    }),
    client.readContract({
      address: ethAddr,
      abi: AGG_ABI,
      functionName: "latestRoundData",
    }),
  ]);

  const latestPrice = Number(latestEthRound[1]) / 10 ** Number(ethDec);
  const latestRoundId = latestEthRound[0];
  const latestTs = Number(latestEthRound[3]);

  console.log(
    `Latest ETH/USD: $${latestPrice.toFixed(2)} (Round ${latestRoundId}) at ${new Date(latestTs * 1000).toISOString()}`,
  );

  // Look back rounds: on mainnet ETH/USD updates roughly every ~20-60 minutes or 0.5% dev
  // Let's sample prior rounds (e.g. 5 rounds back, 20 rounds back, 50 rounds back)
  const priorDeltas: any[] = [];
  const testSteps = [2n, 5n, 10n, 25n, 50n];
  for (const step of testSteps) {
    try {
      const pastRoundId = latestRoundId - step;
      const pastRound = await client.readContract({
        address: ethAddr,
        abi: AGG_ABI,
        functionName: "getRoundData",
        args: [pastRoundId],
      });
      const pastPrice = Number(pastRound[1]) / 10 ** Number(ethDec);
      const pastTs = Number(pastRound[3]);
      const ageHours = (latestTs - pastTs) / 3600;
      const pctChange = ((latestPrice - pastPrice) / pastPrice) * 100;
      console.log(
        `  Round -${step}: $${pastPrice.toFixed(2)} (${ageHours.toFixed(1)}h ago) -> ${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(2)}%`,
      );
      priorDeltas.push({ step, ageHours, pctChange, pastPrice });
    } catch {}
  }
}

main().catch(console.error);
