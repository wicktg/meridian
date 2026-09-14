import path from "path";
import { readFileSync, writeFileSync } from "fs";
import dotenv from "dotenv";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

interface TestScenario {
  id: number;
  name: string;
  expectedRegime: "Stable" | "Unsettled" | "Undertow";
  evidence: string;
}

const SCENARIOS: TestScenario[] = [
  {
    id: 1,
    name: "Scenario 1: Normal Baseline Conditions (Expected: Stable)",
    expectedRegime: "Stable",
    evidence: `Market Telemetry Report:
- Asset: WETH/USD = $3,452.10 (Chainlink: $3,451.95, Uniswap TWAP: $3,452.20, Divergence: 0.007%).
- Protocol Collateralization Ratio: 285% (Safe threshold: 140%).
- Debt Ceiling Utilization: 42% ($21M minted out of $50M cap).
- Liquidity Pool Health: Curve mUSD/USDC pool balance is 50.2% / 49.8%, depth $45M within 15bps.
- Protocol Status: Clean audit track record, zero security disclosures, borrow APR stable at 3.25%.`,
  },
  {
    id: 2,
    name: "Scenario 2: Approaching-Stress Turbulence (Expected: Unsettled)",
    expectedRegime: "Unsettled",
    evidence: `Market Telemetry Report & Vulnerability Disclosure:
- Asset: WETH/USD = $2,890.00 (down 12% in 4 hours).
- Secondary Collateral (stETH): Minor discount to ETH at 0.988 on Curve pool; pool imbalance 68% stETH / 32% ETH.
- Borrow Rates: Spiked from 3.5% to 28.4% due to rapid liquidity withdrawal.
- Incident Alert: Whitehat security report disclosed potential reentrancy edge-case in Curve Vyper 0.2.15 pools. Protocol multisig paused borrow operations on affected collateral pending confirmation.
- Solvency & Liquidations: Protocol remains fully solvent with average collateral ratio at 168% (above 135% liquidation threshold), $1.2M in liquidations processed smoothly with no bad debt.`,
  },
  {
    id: 3,
    name: "Scenario 3: Active Exploit & Crisis Breakdown (Expected: Undertow)",
    expectedRegime: "Undertow",
    evidence: `Emergency Protocol Incident Report & Market Breakdown:
- Incident: Critical flash-loan donation exploit executed against lending pools; attacker drained $197M across multiple vaults.
- Oracle Divergence & Depeg: Secondary market peg collapsed; mUSD trading at $0.68 on Uniswap V3 against USDC. Chainlink oracle heartbeat delayed by 45 minutes under L2 sequencer congestion.
- Cascade Liquidations: Over $34M in positions underwater; bad debt accumulating rapidly ($8.4M shortfall).
- Emergency Action: Protocol guardian invoked emergency shutdown; collateral redemption queue frozen. Active exploitation ongoing across connected lending pools.`,
  },
];

async function main() {
  const privateKey = process.env.BURNER_WALLET_PRIVATE_KEY?.trim();
  if (!privateKey)
    throw new Error("No BURNER_WALLET_PRIVATE_KEY found in .env");
  const formattedKey = (
    privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`
  ) as `0x${string}`;
  const account = createAccount(formattedKey);

  const client = createClient({
    chain: testnetBradbury,
    account,
  });

  const deployedInfo = JSON.parse(
    readFileSync(path.resolve(process.cwd(), "deployed_bedrock.json"), "utf-8"),
  );
  const contractAddress = deployedInfo.contractAddress as `0x${string}`;

  console.log(
    "===============================================================",
  );
  console.log(
    "Bedrock Core Reasoning Verification on GenLayer Testnet Bradbury",
  );
  console.log("Contract Address:", contractAddress);
  console.log("Tester Account:", account.address);
  console.log(
    "===============================================================\n",
  );

  const results: any[] = [];

  for (const scenario of SCENARIOS) {
    console.log(
      `\n---------------------------------------------------------------`,
    );
    console.log(`Executing [${scenario.name}]`);
    console.log(`Expected Regime: ${scenario.expectedRegime}`);
    console.log(
      `Submitting evidence transaction to GenLayer Testnet Bradbury...`,
    );

    const txHash = await client.writeContract({
      address: contractAddress,
      functionName: "assess_evidence",
      args: [scenario.evidence],
    });

    console.log(`Transaction Hash: ${txHash}`);
    console.log(
      `Explorer URL: https://explorer-bradbury.genlayer.com/tx/${txHash}`,
    );
    console.log(
      `Waiting for validators to achieve consensus via Equivalence Principle...`,
    );

    const receipt = await client.waitForTransactionReceipt({
      hash: txHash,
      status: "ACCEPTED" as any,
      retries: 100,
      interval: 5000,
    });

    const txReceiptData = await client.request({
      method: "gen_getTransactionReceipt",
      params: [{ txId: txHash }],
    });

    const executionSuccess = txReceiptData.txExecutionResult === 1;

    // Read back state from the contract
    const currentRegime = await client.readContract({
      address: contractAddress,
      functionName: "get_regime",
      args: [],
    });

    const currentReasoning = await client.readContract({
      address: contractAddress,
      functionName: "get_reasoning",
      args: [],
    });

    console.log(`\n>>> Consensus Achieved! <<<`);
    console.log(
      `Resulting Regime: "${currentRegime}" (Expected: "${scenario.expectedRegime}")`,
    );
    console.log(`Reasoning Output: "${currentReasoning}"`);
    console.log(
      `Execution Success: ${executionSuccess} (txExecutionResult: ${txReceiptData.txExecutionResult})`,
    );
    console.log(`Consensus Status: ${txReceiptData.status}`);

    const matchesExpectation = currentRegime === scenario.expectedRegime;
    console.log(
      `Matches Expectation: ${matchesExpectation ? "YES (PASS)" : "NO (FAIL)"}`,
    );

    results.push({
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      expectedRegime: scenario.expectedRegime,
      actualRegime: currentRegime,
      reasoning: currentReasoning,
      txHash,
      explorerUrl: `https://explorer-bradbury.genlayer.com/tx/${txHash}`,
      executionSuccess,
      matchesExpectation,
    });
  }

  console.log(
    "\n===============================================================",
  );
  console.log(
    "SUMMARY OF BEDROCK REASONING TESTS ON GENLAYER TESTNET BRADBURY",
  );
  console.log(
    "===============================================================",
  );
  console.table(
    results.map((r) => ({
      Scenario: r.scenarioId,
      Expected: r.expectedRegime,
      Actual: r.actualRegime,
      Pass: r.matchesExpectation ? "PASS" : "FAIL",
      TxHash: r.txHash.slice(0, 18) + "...",
    })),
  );

  writeFileSync(
    path.resolve(process.cwd(), "test_results.json"),
    JSON.stringify(results, null, 2),
    "utf-8",
  );
  console.log("\nComplete results written to test_results.json");
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
