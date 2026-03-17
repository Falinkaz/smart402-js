import { describe, it, expect, vi, afterEach } from "vitest";
import { createSmart402Guard } from "../src/guard";
import { Smart402Denied, Smart402Unavailable } from "../src/errors";
import type { PaymentRequirements } from "../src/types";

const testPayment: PaymentRequirements = {
  amount: "100000",
  token: "USDC",
  network: "eip155:84532",
  pay_to: "0x1234567890123456789012345678901234567890",
};

const testConfig = {
  apiKey: "test-key",
  agentId: "test-agent",
  baseUrl: "https://api.example.com",
};

const approveResult = {
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

const denyResult = {
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

describe("createSmart402Guard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("test_guard_approve", async () => {
    const guard = createSmart402Guard(testConfig);
    vi.spyOn(guard.client, "evaluate").mockResolvedValue(approveResult);
    vi.spyOn(console, "log").mockImplementation(() => {});

    const result = await guard.evaluate(testPayment);
    expect(result.decision).toBe("approve");
    expect(result.evaluation_id).toBe("eval-123");
  });

  it("test_guard_deny", async () => {
    const guard = createSmart402Guard(testConfig);
    vi.spyOn(guard.client, "evaluate").mockResolvedValue(denyResult);
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await guard.evaluate(testPayment);
    expect(result.decision).toBe("deny");
    expect(result.triggered_rules).toEqual(["max_transaction_amount"]);
  });

  it("test_guard_deny_throws", async () => {
    const guard = createSmart402Guard(testConfig);
    vi.spyOn(guard.client, "evaluate").mockResolvedValue(denyResult);
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(guard.evaluate(testPayment, { throwOnDeny: true })).rejects.toThrow(
      Smart402Denied,
    );
  });

  it("test_guard_fail_open", async () => {
    const guard = createSmart402Guard({ ...testConfig, failMode: "fail_open" });
    vi.spyOn(guard.client, "evaluate").mockRejectedValue(new Error("Network error"));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await guard.evaluate(testPayment);
    expect(result.decision).toBe("approve");
    expect(result.evaluation_id).toBe("fail_open_bypass");
  });

  it("test_guard_fail_closed", async () => {
    const guard = createSmart402Guard({ ...testConfig, failMode: "fail_closed" });
    vi.spyOn(guard.client, "evaluate").mockRejectedValue(new Error("Network error"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(guard.evaluate(testPayment)).rejects.toThrow(Smart402Unavailable);
  });

  it("test_guard_builds_request_correctly", async () => {
    const config = {
      apiKey: "my-key",
      agentId: "agent-abc",
      baseUrl: "https://api.example.com",
      agentWalletAddress: "0xwallet",
      walletProvider: "coinbase",
      agentFramework: "langchain",
    };
    const guard = createSmart402Guard(config);
    const spy = vi
      .spyOn(guard.client, "evaluate")
      .mockResolvedValue(approveResult);
    vi.spyOn(console, "log").mockImplementation(() => {});

    await guard.evaluate(testPayment, { requestUrl: "https://example.com/resource" });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        agent_id: "agent-abc",
        agent_wallet_address: "0xwallet",
        wallet_provider: "coinbase",
        agent_framework: "langchain",
        request_url: "https://example.com/resource",
        sdk_version: expect.any(String),
        // amount "100000" raw units → "0.1" decimal dollars after conversion
        payment_requirements: { ...testPayment, amount: "0.1" },
      }),
    );
  });

  it("test_guard_converts_raw_usdc_to_decimal", async () => {
    const guard = createSmart402Guard(testConfig);
    const spy = vi.spyOn(guard.client, "evaluate").mockResolvedValue(approveResult);
    vi.spyOn(console, "log").mockImplementation(() => {});

    await guard.evaluate({ ...testPayment, amount: "1500000" }); // $1.50
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_requirements: expect.objectContaining({ amount: "1.5" }),
      }),
    );
  });

  it("test_guard_rejects_non_usdc_token", async () => {
    const guard = createSmart402Guard(testConfig);
    await expect(guard.evaluate({ ...testPayment, token: "ETH" })).rejects.toThrow(
      "smart402 v0.1 supports USDC only. Got: ETH",
    );
  });

  it("test_guard_rejects_invalid_amount", async () => {
    const guard = createSmart402Guard(testConfig);
    await expect(guard.evaluate({ ...testPayment, amount: "0.10" })).rejects.toThrow(
      /amount must be a positive integer string/,
    );
    await expect(guard.evaluate({ ...testPayment, amount: "0" })).rejects.toThrow(
      /amount must be a positive integer string/,
    );
    await expect(guard.evaluate({ ...testPayment, amount: "-5" })).rejects.toThrow(
      /amount must be a positive integer string/,
    );
  });
});
