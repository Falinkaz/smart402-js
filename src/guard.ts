import { Smart402Client } from "./client";
import { Smart402Denied, Smart402Unavailable } from "./errors";
import type { Smart402Config, EvaluateRequest, PaymentRequirements } from "./types";

const SDK_VERSION = "0.4.0";
const _USDC_DECIMALS = 6;

/**
 * Convert a raw USDC amount string (integer, smallest units) to a decimal dollar string.
 * 100000 → "0.1", 1000000 → "1", 1500000 → "1.5"
 * Throws if rawAmount is not a positive integer string.
 * @internal
 */
function _rawUsdcToDecimal(rawAmount: string): string {
  if (!/^\d+$/.test(rawAmount) || rawAmount === "0") {
    throw new Error(
      `amount must be a positive integer string of raw USDC units ` +
        `(e.g. "100000" for $0.10). Got: "${rawAmount}"`,
    );
  }
  const whole = BigInt(rawAmount) / 1_000_000n;
  const frac = BigInt(rawAmount) % 1_000_000n;
  if (frac === 0n) return `${whole}`;
  return `${whole}.${frac.toString().padStart(_USDC_DECIMALS, "0").replace(/0+$/, "")}`;
}

/**
 * Creates a smart402 evaluation function that can be called
 * before any x402 payment is signed.
 *
 * Usage (standalone pattern):
 *
 *   import { createSmart402Guard } from "smart402";
 *
 *   const guard = createSmart402Guard({
 *     apiKey: process.env.SMART402_API_KEY!,
 *     agentId: "weather-agent-001",
 *   });
 *
 *   // Before signing any payment:
 *   const decision = await guard.evaluate(paymentRequirements);
 *   if (decision.decision === "deny") {
 *     // Don't sign — payment blocked
 *   }
 */
export function createSmart402Guard(config: Smart402Config) {
  const client = new Smart402Client(
    config.apiKey,
    config.baseUrl,
    config.timeoutMs,
  );

  return {
    /**
     * Evaluate a payment against smart402 policies.
     * Returns the evaluation result.
     * Throws Smart402Denied on deny (if throwOnDeny is true).
     * Handles API errors according to failMode.
     */
    async evaluate(
      paymentReqs: PaymentRequirements,
      options?: { requestUrl?: string; throwOnDeny?: boolean },
    ) {
      if (paymentReqs.token.toUpperCase() !== "USDC") {
        throw new Error(`smart402 supports USDC only. Got: ${paymentReqs.token}`);
      }

      const amountDecimal = _rawUsdcToDecimal(paymentReqs.amount);

      const evalRequest: EvaluateRequest = {
        agent_id: config.agentId,
        agent_wallet_address: config.agentWalletAddress,
        wallet_provider: config.walletProvider,
        agent_framework: config.agentFramework,
        sdk_version: SDK_VERSION,
        request_url: options?.requestUrl,
        payment_requirements: { ...paymentReqs, amount: amountDecimal },
      };

      try {
        const result = await client.evaluate(evalRequest);

        if (result.decision === "approve") {
          console.log(
            `✅ APPROVED | ${amountDecimal} ${paymentReqs.token} → ` +
              `${paymentReqs.pay_to.slice(0, 10)}... | ${result.latency_ms}ms`,
          );
          return result;
        }

        console.warn(
          `🚫 DENIED | ${amountDecimal} ${paymentReqs.token} | ` +
            `rules: ${result.triggered_rules.join(", ")}`,
        );

        if (options?.throwOnDeny) {
          throw new Smart402Denied(result.triggered_rules, result.evaluation_id);
        }

        return result;
      } catch (error) {
        // If it's already a Smart402Denied, re-throw
        if (error instanceof Smart402Denied) throw error;

        // API error — apply fail mode
        const failMode = config.failMode ?? "fail_open";

        if (failMode === "fail_closed") {
          console.error(`🔒 FAIL_CLOSED | smart402 unreachable: ${error}`);
          throw new Smart402Unavailable(error instanceof Error ? error : undefined);
        }

        console.warn(`⚠️ FAIL_OPEN | smart402 unreachable: ${error} — allowing payment`);
        // Return a synthetic approve response
        return {
          decision: "approve" as const,
          evaluation_id: "fail_open_bypass",
          evaluated_at: new Date().toISOString(),
          remaining_daily_budget: null,
          rules_checked: 0,
          triggered_rules: [],
          counterparty_risk_score: "unknown",
          counterparty_details: null,
          latency_ms: 0,
        };
      }
    },

    /** Direct access to the underlying client (useful for testing) */
    client,
  };
}
