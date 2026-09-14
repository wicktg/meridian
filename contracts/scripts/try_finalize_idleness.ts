import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

const privateKey = process.env.BURNER_WALLET_PRIVATE_KEY?.trim()!;
const formattedKey = (
  privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`
) as `0x${string}`;

async function main() {
  const account = createAccount(formattedKey);
  const client = createClient({
    chain: testnetBradbury,
    account,
  });

  const txIds = [
    "0x513f29b8fdb2139b0eb49a5cf241d5a5a28746d0672f0f19d3a6e699be7f2186",
    "0xeed562d6bfc17598da574ea520775e18d3266bb839ffbd22a8eaf1ca8793a8a1",
    "0x5171268b08ca376be572ef62e7e0b985a994a0a5e8c516048ea6b5042774933b",
  ];

  try {
    console.log("Calling finalizeIdlenessTxs...");
    const res = await (client as any).finalizeIdlenessTxs({ txIds });
    console.log("finalizeIdlenessTxs result:", res);
  } catch (e: any) {
    console.log("finalizeIdlenessTxs error:", e.message);
  }
}

main().catch(console.error);
