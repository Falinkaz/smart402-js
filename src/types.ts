/**
 * Types mirroring the smart402 API schemas.
 */

/**
 * Payment details extracted from an x402 `402 Payment Required` response.
 * Passed to `evaluate()` so smart402 can apply your agent's policies.
 */
export interface PaymentRequirements {
  /** Raw USDC token units as an integer string (e.g. "100000" for $0.10). The SDK converts this to a decimal dollar string before sending to the API; your policies are evaluated in dollars. */
  amount: string;
  /** Token symbol. smart402 v0.1 supports USDC only — pass "USDC". */
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
export interface EvaluateRequest {
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
export interface CounterpartyDetails {
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
export interface EvaluateResponse {
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
export interface Smart402Config {
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
