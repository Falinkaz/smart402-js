// src/client.ts
var Smart402Client = class {
  apiKey;
  baseUrl;
  timeoutMs;
  /**
   * @param apiKey    smart402 API key (Bearer token).
   * @param baseUrl   Base URL of the smart402 API. Defaults to `"https://streetsmart-api.fly.dev"`.
   * @param timeoutMs Request timeout in milliseconds. Defaults to `5000`.
   */
  constructor(apiKey, baseUrl = "https://streetsmart-api.fly.dev", timeoutMs = 5e3) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.timeoutMs = timeoutMs;
    this._warnIfInsecure();
  }
  /**
   * Send a payment evaluation request to the smart402 API.
   *
   * @param request  The evaluation request including agent ID and payment details.
   * @returns        The evaluation result with `decision`, triggered rules, and budget info.
   * @throws         `Error` if the API returns a non-2xx status.
   */
  async evaluate(request) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/evaluate`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(request),
        signal: controller.signal
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error(
          `smart402 API error ${response.status}: ${error.detail ?? JSON.stringify(error)}`
        );
      }
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }
  _warnIfInsecure() {
    try {
      const url = new URL(this.baseUrl);
      if (url.protocol === "http:" && !["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
        console.warn(
          `\u26A0\uFE0F  smart402 SDK is connecting over HTTP to ${url.hostname}. API keys sent over HTTP are vulnerable to interception. Use https:// for non-localhost connections.`
        );
      }
    } catch {
    }
  }
};

// src/errors.ts
var Smart402Denied = class extends Error {
  /** Policy names that caused the denial (e.g. `["max_transaction_amount"]`). */
  triggeredRules;
  /** Evaluation ID for audit trail lookup. */
  evaluationId;
  constructor(triggeredRules, evaluationId) {
    super(`Transaction denied: ${triggeredRules.join(", ")}`);
    this.name = "Smart402Denied";
    this.triggeredRules = triggeredRules;
    this.evaluationId = evaluationId;
  }
};
var Smart402Unavailable = class extends Error {
  constructor(cause) {
    super(`smart402 API unavailable: ${cause?.message ?? "unknown error"}`);
    this.name = "Smart402Unavailable";
    this.cause = cause;
  }
};

// src/guard.ts
var SDK_VERSION = "0.4.0";
var _USDC_DECIMALS = 6;
function _rawUsdcToDecimal(rawAmount) {
  if (!/^\d+$/.test(rawAmount) || rawAmount === "0") {
    throw new Error(
      `amount must be a positive integer string of raw USDC units (e.g. "100000" for $0.10). Got: "${rawAmount}"`
    );
  }
  const whole = BigInt(rawAmount) / 1000000n;
  const frac = BigInt(rawAmount) % 1000000n;
  if (frac === 0n) return `${whole}`;
  return `${whole}.${frac.toString().padStart(_USDC_DECIMALS, "0").replace(/0+$/, "")}`;
}
function createSmart402Guard(config) {
  const client = new Smart402Client(
    config.apiKey,
    config.baseUrl,
    config.timeoutMs
  );
  return {
    /**
     * Evaluate a payment against smart402 policies.
     * Returns the evaluation result.
     * Throws Smart402Denied on deny (if throwOnDeny is true).
     * Handles API errors according to failMode.
     */
    async evaluate(paymentReqs, options) {
      if (paymentReqs.token.toUpperCase() !== "USDC") {
        throw new Error(`smart402 supports USDC only. Got: ${paymentReqs.token}`);
      }
      const amountDecimal = _rawUsdcToDecimal(paymentReqs.amount);
      const evalRequest = {
        agent_id: config.agentId,
        agent_wallet_address: config.agentWalletAddress,
        wallet_provider: config.walletProvider,
        agent_framework: config.agentFramework,
        sdk_version: SDK_VERSION,
        request_url: options?.requestUrl,
        payment_requirements: { ...paymentReqs, amount: amountDecimal }
      };
      try {
        const result = await client.evaluate(evalRequest);
        if (result.decision === "approve") {
          console.log(
            `\u2705 APPROVED | ${amountDecimal} ${paymentReqs.token} \u2192 ${paymentReqs.pay_to.slice(0, 10)}... | ${result.latency_ms}ms`
          );
          return result;
        }
        console.warn(
          `\u{1F6AB} DENIED | ${amountDecimal} ${paymentReqs.token} | rules: ${result.triggered_rules.join(", ")}`
        );
        if (options?.throwOnDeny) {
          throw new Smart402Denied(result.triggered_rules, result.evaluation_id);
        }
        return result;
      } catch (error) {
        if (error instanceof Smart402Denied) throw error;
        const failMode = config.failMode ?? "fail_open";
        if (failMode === "fail_closed") {
          console.error(`\u{1F512} FAIL_CLOSED | smart402 unreachable: ${error}`);
          throw new Smart402Unavailable(error instanceof Error ? error : void 0);
        }
        console.warn(`\u26A0\uFE0F FAIL_OPEN | smart402 unreachable: ${error} \u2014 allowing payment`);
        return {
          decision: "approve",
          evaluation_id: "fail_open_bypass",
          evaluated_at: (/* @__PURE__ */ new Date()).toISOString(),
          remaining_daily_budget: null,
          rules_checked: 0,
          triggered_rules: [],
          counterparty_risk_score: "unknown",
          counterparty_details: null,
          latency_ms: 0
        };
      }
    },
    /** Direct access to the underlying client (useful for testing) */
    client
  };
}
export {
  Smart402Client,
  Smart402Denied,
  Smart402Unavailable,
  createSmart402Guard
};
