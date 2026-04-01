# smart402 — TypeScript SDK

Deterministic policy engine for AI agent payments via [x402](https://x402.org).

No LLM in the decision path. Every approve/deny traces to a rule your team configured — not a model's judgment call. A compromised agent cannot reason or prompt-inject its way past smart402.

> **v0.4.0:** Confirmed on-chain spend tracking. Budgets now reflect payments that actually landed on-chain.

## Install

```bash
npm install smart402
```

Node 18+ required. Zero runtime dependencies — uses native `fetch`.

## Before you start

1. Sign up at https://smart402-dashboard.vercel.app
2. Create an agent in the dashboard
3. Configure at least one policy (e.g., daily budget of $10)
4. Create an evaluate-scoped API key in Settings → API Keys
5. Follow the Quick Start below.

## Quick Start

```typescript
import { createSmart402Guard } from "smart402";

const guard = createSmart402Guard({
  apiKey: process.env.SMART402_AGENT_KEY!,
  agentId: "my-agent-001",
});

const result = await guard.evaluate({
  amount: "100000",        // Raw x402 token units as an integer string. The SDK converts to decimal automatically. "100000" = $0.10 USDC (6 decimals). Pass the amount directly from the x402 PaymentRequirements object.
  token: "USDC",
  network: "eip155:8453",  // Base mainnet (CAIP-2)
  pay_to: "0x9dBA414637c611a16BEa6f0796BFcbcBdc410df8",
});

if (result.decision === "approve") {
  // proceed with payment signing
} else {
  console.log("Blocked by:", result.triggered_rules);
}
```

[Get an API key →](https://smart402-dashboard.vercel.app)

## x402 Integration

Call `guard.evaluate()` before signing any x402 payment:

```typescript
import { createSmart402Guard } from "smart402";

const guard = createSmart402Guard({
  apiKey: process.env.SMART402_AGENT_KEY!,
  agentId: "my-agent-001",
  agentWalletAddress: "0x...",
});

// In your x402 payment flow, before signing:
async function beforePayment(paymentRequirements) {
  const result = await guard.evaluate(
    {
      amount: paymentRequirements.amount,   // raw USDC units from x402 — SDK converts automatically
      token: "USDC",
      network: paymentRequirements.network,
      pay_to: paymentRequirements.payTo,
    },
    { throwOnDeny: true },  // throws Smart402Denied if blocked
  );
  return result;
}
```

## Configuration

```typescript
import type { Smart402Config } from "smart402";

const config: Smart402Config = {
  apiKey: "ag_live_...",                     // Required
  agentId: "my-agent-001",                  // Required
  baseUrl: "https://streetsmart-api.fly.dev", // Default
  agentWalletAddress: "0x...",              // Optional: for audit trail
  walletProvider: "coinbase",               // Optional
  agentFramework: "langchain",              // Optional
  failMode: "fail_open",                    // Default: allow when API is down
  timeoutMs: 5000,                          // Default: 5s
};
```

| Option | Default | Description |
|--------|---------|-------------|
| `apiKey` | required | smart402 API key |
| `agentId` | required | Agent identifier (from dashboard) |
| `baseUrl` | `https://streetsmart-api.fly.dev` | API base URL |
| `failMode` | `"fail_open"` | Behavior when API is unreachable |
| `agentWalletAddress` | — | Agent's public EVM address |
| `walletProvider` | — | e.g. `"coinbase"`, `"privy"` |
| `agentFramework` | — | e.g. `"langchain"`, `"vercel-ai"` |
| `timeoutMs` | `5000` | Request timeout in ms |

**Amount format:** Pass `amount` as raw x402 token units — an integer string such as `"100000"` for $0.10 USDC (6 decimals). The SDK converts to decimal automatically before sending to the API. Pass the value directly from the x402 `PaymentRequirements` object without conversion.

## Fail-Open vs Fail-Closed

| Mode | When API is unreachable |
|------|------------------------|
| `fail_open` (default) | Warning logged, returns synthetic `approve` — payment proceeds |
| `fail_closed` | Throws `Smart402Unavailable` — payment blocked |

```typescript
// Production: block payments if risk engine is down
const guard = createSmart402Guard({
  apiKey: process.env.SMART402_AGENT_KEY!,
  agentId: "high-value-agent",
  failMode: "fail_closed",
});
```

## Error Handling

```typescript
import { Smart402Denied, Smart402Unavailable } from "smart402";

try {
  await guard.evaluate(paymentReqs, { throwOnDeny: true });
} catch (error) {
  if (error instanceof Smart402Denied) {
    console.log("Blocked by rules:", error.triggeredRules);
    console.log("Evaluation ID:", error.evaluationId);
  } else if (error instanceof Smart402Unavailable) {
    console.error("Risk engine unreachable:", error.message);
  }
}
```

## What data leaves your machine

The SDK sends to the smart402 API:
- amount, token, network, recipient address
- agent ID and wallet address (public, not private key)

The SDK never sends:
- Private keys, seed phrases, or wallet passwords
- Signed transactions or raw transaction data
- Wallet balances

One HTTPS call to `POST /evaluate`. No telemetry, no analytics, no side-channel requests.
Verify: the SDK is ~200 lines of code. Read it.

Read the full trust model: [SECURITY.md](https://github.com/Falinkaz/smart402-js/blob/main/SECURITY.md)

## Limits

- Rate limit: 600 requests per minute per account
- Typical latency: 10–50ms (p50), under 200ms (p99)
- If the API is unreachable, `fail_open` (default) lets the payment proceed. `fail_closed` blocks it.
- The SDK does not retry on failure — it returns the error immediately, keeping latency predictable and letting you own retry logic.

## Troubleshooting

- **401 Unauthorized:** Your API key is invalid, expired, or revoked. Check Settings → API Keys in the dashboard.
- **403 Forbidden:** Your key's scope doesn't allow this operation. Use an `evaluate`-scoped key for agents.
- **404 Not Found:** The `agent_id` doesn't exist. Create it in the dashboard first.
- **429 Too Many Requests:** Rate limit exceeded (600/min per account). Back off and retry.

## API Reference

Full endpoint documentation: [API.md](https://github.com/Falinkaz/smart402-js/blob/main/API.md)

## License

Apache 2.0 — see [LICENSE](https://github.com/Falinkaz/smart402-js/blob/main/LICENSE)
