# Changelog

## 0.3.0

- `SDK_VERSION` bumped; no breaking changes

## 0.2.0

- `Smart402Config.agentWalletAddress`, `walletProvider`, `agentFramework` fields for richer evaluation context
- CDP wallet support

## 0.1.0 — Initial release

- `createSmart402Guard(config)` — evaluation function factory
- `Smart402Client` — direct HTTP client for `POST /evaluate`
- `Smart402Denied`, `Smart402Unavailable` — error classes
- `fail_open` / `fail_closed` modes
- Full TypeScript types (`Smart402Config`, `EvaluateRequest`, `EvaluateResponse`, `PaymentRequirements`)
- Zero runtime dependencies — native `fetch`, Node 18+
- CJS + ESM + type declarations
