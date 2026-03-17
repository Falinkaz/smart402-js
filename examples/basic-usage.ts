/**
 * Minimal smart402 integration.
 *
 * Run:
 *   SMART402_API_KEY=ag_live_... npx tsx examples/basic-usage.ts
 *
 * Without a valid API key the script will import correctly and fail at the
 * HTTP call with a 401 error — you can read the code before signing up.
 */

import { createSmart402Guard } from "../src/index.js";

const guard = createSmart402Guard({
  apiKey: process.env.SMART402_API_KEY ?? "ag_live_invalid",
  agentId: "example-agent",
});

const result = await guard.evaluate({
  amount: "100000",        // Raw x402 token units as integer string. "100000" = $0.10 USDC (6 decimals). SDK converts automatically.
  token: "USDC",
  network: "eip155:8453",  // Base mainnet (CAIP-2)
  pay_to: "0x9dBA414637c611a16BEa6f0796BFcbcBdc410df8",
});

console.log(`Decision:      ${result.decision}`);
console.log(`Risk score:    ${result.counterparty_risk_score ?? "n/a"}`);
console.log(`Rules checked: ${result.rules_checked}`);
console.log(`Latency:       ${result.latency_ms}ms`);

if (result.triggered_rules.length > 0) {
  console.log(`Blocked by:    ${result.triggered_rules.join(", ")}`);
}

if (result.remaining_daily_budget !== null) {
  console.log(`Daily budget remaining: $${result.remaining_daily_budget}`);
}
