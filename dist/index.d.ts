/**
 * Types mirroring the smart402 API schemas.
 */
/**
 * Payment details extracted from an x402 `402 Payment Required` response.
 * Passed to `evaluate()` so smart402 can apply your agent's policies.
 */
interface PaymentRequirements {
    /** Raw USDC token units as an integer string (e.g. "100000" for $0.10). The SDK converts this to a decimal dollar string before sending to the API; your policies are evaluated in dollars. */
    amount: string;
    /** Token symbol. smart402 supports USDC only — pass "USDC". */
    token: string;
    /** Payment scheme identifier (e.g. "exact"). */
    scheme?: string;
    /** CAIP-2 network identifier (e.g. "eip155:84532" for Base Sepolia). */
    network: string;
    /** Recipient wallet address or contract. */
    pay_to: string;
    /** Human-readable description of what is being purchased. */
    description?: string;
    /** Facilitator URL that processes the payment. */
    facilitator?: string;
    /** Seller-assigned identifier for the resource being purchased. */
    external_id?: string;
}
/**
 * Request body sent to `POST /evaluate`.
 * Identifies the agent and the payment it wants to make.
 */
interface EvaluateRequest {
    /** smart402 agent ID (UUID). */
    agent_id: string;
    /** Agent's on-chain wallet address. */
    agent_wallet_address?: string;
    /** Wallet provider name (e.g. "coinbase"). */
    wallet_provider?: string;
    /** SDK version string for observability. */
    sdk_version?: string;
    /** Agent framework name (e.g. "langchain"). */
    agent_framework?: string;
    /** Cloud region the agent is running in. */
    runtime_region?: string;
    /** Whether this is a retry of a previously denied evaluation. */
    is_retry?: boolean;
    /** Evaluation ID being retried, if applicable. */
    previous_evaluation_id?: string;
    /** URL of the resource the agent is trying to pay for. */
    request_url?: string;
    /** Payment details from the 402 response. */
    payment_requirements: PaymentRequirements;
}
/**
 * Counterparty intelligence snapshot returned by `POST /evaluate`.
 * Present when the backend enriched the recipient address (EVM networks only).
 */
interface CounterpartyDetails {
    /** Whether the recipient is a smart contract (null if lookup failed). */
    is_contract: boolean | null;
    /** Whether the contract is verified on Basescan (null if not a contract or lookup failed). */
    is_verified_contract: boolean | null;
    /** Age of the wallet in days since first on-chain activity (null if lookup failed). */
    wallet_age_days: number | null;
    /** Number of times this agent has paid this counterparty previously. */
    times_seen_by_agent: number;
    /** True if this is the first time the agent is paying this counterparty. */
    first_time: boolean;
}
/**
 * Response from `POST /evaluate`.
 * The `decision` field is the authoritative approve/deny result.
 */
interface EvaluateResponse {
    /** Whether the payment should proceed (`"approve"`) or be blocked (`"deny"`). */
    decision: "approve" | "deny";
    /** Unique ID for this evaluation, useful for audit trails. */
    evaluation_id: string;
    /** ISO 8601 timestamp when the evaluation was recorded. */
    evaluated_at: string;
    /** Remaining daily budget in USD after this evaluation, or null if no budget policy. */
    remaining_daily_budget: string | null;
    /** Total number of policies checked. */
    rules_checked: number;
    /** Policy names that caused a denial, empty on approve. */
    triggered_rules: string[];
    /** Counterparty risk assessment: `"low"`, `"medium"`, `"high"`, or `"unknown"`. */
    counterparty_risk_score: string;
    /** Counterparty intelligence data, or null if enrichment was skipped or failed. */
    counterparty_details: CounterpartyDetails | null;
    /** Time taken to evaluate in milliseconds. */
    latency_ms: number;
}
/**
 * Configuration for `createSmart402Guard()`.
 * Identifies the agent and controls SDK behaviour.
 */
interface Smart402Config {
    /** smart402 API key (Bearer token). Use an `evaluate`-scoped key in agents. */
    apiKey: string;
    /** smart402 agent ID (UUID) that owns the policies to evaluate against. */
    agentId: string;
    /** Base URL of the smart402 API. Default: `"https://streetsmart-api.fly.dev"`. */
    baseUrl?: string;
    /** Agent's on-chain wallet address, forwarded to the API for policy evaluation. */
    agentWalletAddress?: string;
    /** Wallet provider name forwarded to the API (e.g. `"coinbase"`). */
    walletProvider?: string;
    /** Agent framework name forwarded to the API (e.g. `"langchain"`). */
    agentFramework?: string;
    /**
     * What to do when the smart402 API is unreachable.
     * - `"fail_open"` (default): allow the payment and log a warning.
     * - `"fail_closed"`: throw `Smart402Unavailable` and block the payment.
     */
    failMode?: "fail_open" | "fail_closed";
    /** Request timeout in milliseconds. Default: `5000`. */
    timeoutMs?: number;
}

/**
 * Low-level HTTP client for the smart402 API.
 *
 * Prefer using `createSmart402Guard()` which wraps this client with
 * policy-enforcement logic. Use `Smart402Client` directly only when you
 * need raw access to the evaluate endpoint.
 */
declare class Smart402Client {
    private readonly apiKey;
    private readonly baseUrl;
    private readonly timeoutMs;
    /**
     * @param apiKey    smart402 API key (Bearer token).
     * @param baseUrl   Base URL of the smart402 API. Defaults to `"https://streetsmart-api.fly.dev"`.
     * @param timeoutMs Request timeout in milliseconds. Defaults to `5000`.
     */
    constructor(apiKey: string, baseUrl?: string, timeoutMs?: number);
    /**
     * Send a payment evaluation request to the smart402 API.
     *
     * @param request  The evaluation request including agent ID and payment details.
     * @returns        The evaluation result with `decision`, triggered rules, and budget info.
     * @throws         `Error` if the API returns a non-2xx status.
     */
    evaluate(request: EvaluateRequest): Promise<EvaluateResponse>;
    private _warnIfInsecure;
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
declare function createSmart402Guard(config: Smart402Config): {
    /**
     * Evaluate a payment against smart402 policies.
     * Returns the evaluation result.
     * Throws Smart402Denied on deny (if throwOnDeny is true).
     * Handles API errors according to failMode.
     */
    evaluate(paymentReqs: PaymentRequirements, options?: {
        requestUrl?: string;
        throwOnDeny?: boolean;
    }): Promise<EvaluateResponse>;
    /** Direct access to the underlying client (useful for testing) */
    client: Smart402Client;
};

/**
 * Thrown by `createSmart402Guard().evaluate()` when the smart402 API
 * returns a `"deny"` decision for a payment.
 *
 * @example
 * ```ts
 * try {
 *   await guard.evaluate(paymentRequirements);
 * } catch (err) {
 *   if (err instanceof Smart402Denied) {
 *     console.log("Blocked by:", err.triggeredRules);
 *   }
 * }
 * ```
 */
declare class Smart402Denied extends Error {
    /** Policy names that caused the denial (e.g. `["max_transaction_amount"]`). */
    readonly triggeredRules: string[];
    /** Evaluation ID for audit trail lookup. */
    readonly evaluationId: string;
    constructor(triggeredRules: string[], evaluationId: string);
}
/**
 * Thrown by `createSmart402Guard().evaluate()` when the smart402 API
 * cannot be reached and `failMode` is set to `"fail_closed"`.
 *
 * In `"fail_open"` mode (the default) this error is never thrown — the payment
 * is allowed and a warning is logged instead.
 */
declare class Smart402Unavailable extends Error {
    constructor(cause?: Error);
}

export { type EvaluateRequest, type EvaluateResponse, type PaymentRequirements, Smart402Client, type Smart402Config, Smart402Denied, Smart402Unavailable, createSmart402Guard };
