import { describe, it, expect, vi, afterEach } from "vitest";
import { Smart402Client } from "../src/client";
import type { EvaluateRequest } from "../src/types";

const baseRequest: EvaluateRequest = {
  agent_id: "test-agent",
  payment_requirements: {
    amount: "100000",
    token: "USDC",
    network: "eip155:84532",
    pay_to: "0x1234567890123456789012345678901234567890",
  },
};

const approveResponse = {
  decision: "approve" as const,
  evaluation_id: "eval-123",
  evaluated_at: "2024-01-01T00:00:00Z",
  remaining_daily_budget: "90.00",
  rules_checked: 3,
  triggered_rules: [],
  counterparty_risk_score: "low",
  counterparty_details: null,
  latency_ms: 12,
};

const denyResponse = {
  decision: "deny" as const,
  evaluation_id: "eval-456",
  evaluated_at: "2024-01-01T00:00:00Z",
  remaining_daily_budget: null,
  rules_checked: 2,
  triggered_rules: ["max_transaction_amount"],
  counterparty_risk_score: "medium",
  counterparty_details: null,
  latency_ms: 8,
};

describe("Smart402Client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("test_evaluate_approve", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => approveResponse }),
    );
    const client = new Smart402Client("test-key", "https://api.example.com");
    const result = await client.evaluate(baseRequest);
    expect(result.decision).toBe("approve");
    expect(result.evaluation_id).toBe("eval-123");
    expect(result.rules_checked).toBe(3);
  });

  it("test_evaluate_deny", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => denyResponse }),
    );
    const client = new Smart402Client("test-key", "https://api.example.com");
    const result = await client.evaluate(baseRequest);
    expect(result.decision).toBe("deny");
    expect(result.triggered_rules).toEqual(["max_transaction_amount"]);
  });

  it("test_evaluate_timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, options: RequestInit) => {
        return new Promise((_resolve, reject) => {
          options.signal!.addEventListener("abort", () => {
            reject(new DOMException("The user aborted a request.", "AbortError"));
          });
        });
      }),
    );
    const client = new Smart402Client("test-key", "https://api.example.com", 100);
    const promise = client.evaluate(baseRequest);
    vi.advanceTimersByTime(200);
    await expect(promise).rejects.toThrow();
  });

  it("test_evaluate_401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ detail: "Invalid API key" }),
      }),
    );
    const client = new Smart402Client("bad-key", "https://api.example.com");
    await expect(client.evaluate(baseRequest)).rejects.toThrow("401");
  });

  it("test_sends_correct_headers", async () => {
    let capturedHeaders: Record<string, string> = {};
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, options: RequestInit) => {
        capturedHeaders = options.headers as Record<string, string>;
        return Promise.resolve({ ok: true, json: async () => approveResponse });
      }),
    );
    const client = new Smart402Client("my-api-key", "https://api.example.com");
    await client.evaluate(baseRequest);
    expect(capturedHeaders["Authorization"]).toBe("Bearer my-api-key");
    expect(capturedHeaders["Content-Type"]).toBe("application/json");
  });

  it("test_https_warning", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    new Smart402Client("test-key", "http://api.example.com");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("smart402 SDK is connecting over HTTP"),
    );
  });

  it("test_no_warning_for_localhost", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    new Smart402Client("test-key", "http://localhost:8000");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("test_no_warning_for_https", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    new Smart402Client("test-key", "https://api.example.com");
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
