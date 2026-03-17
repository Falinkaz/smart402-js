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
export class Smart402Denied extends Error {
  /** Policy names that caused the denial (e.g. `["max_transaction_amount"]`). */
  public readonly triggeredRules: string[];
  /** Evaluation ID for audit trail lookup. */
  public readonly evaluationId: string;

  constructor(triggeredRules: string[], evaluationId: string) {
    super(`Transaction denied: ${triggeredRules.join(", ")}`);
    this.name = "Smart402Denied";
    this.triggeredRules = triggeredRules;
    this.evaluationId = evaluationId;
  }
}

/**
 * Thrown by `createSmart402Guard().evaluate()` when the smart402 API
 * cannot be reached and `failMode` is set to `"fail_closed"`.
 *
 * In `"fail_open"` mode (the default) this error is never thrown — the payment
 * is allowed and a warning is logged instead.
 */
export class Smart402Unavailable extends Error {
  constructor(cause?: Error) {
    super(`smart402 API unavailable: ${cause?.message ?? "unknown error"}`);
    this.name = "Smart402Unavailable";
    this.cause = cause;
  }
}
