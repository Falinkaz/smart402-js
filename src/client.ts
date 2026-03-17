import type { EvaluateRequest, EvaluateResponse } from "./types";

/**
 * Low-level HTTP client for the smart402 API.
 *
 * Prefer using `createSmart402Guard()` which wraps this client with
 * policy-enforcement logic. Use `Smart402Client` directly only when you
 * need raw access to the evaluate endpoint.
 */
export class Smart402Client {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  /**
   * @param apiKey    smart402 API key (Bearer token).
   * @param baseUrl   Base URL of the smart402 API. Defaults to `"https://streetsmart-api.fly.dev"`.
   * @param timeoutMs Request timeout in milliseconds. Defaults to `5000`.
   */
  constructor(apiKey: string, baseUrl = "https://streetsmart-api.fly.dev", timeoutMs = 5000) {
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
  async evaluate(request: EvaluateRequest): Promise<EvaluateResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/evaluate`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error(
          `smart402 API error ${response.status}: ${error.detail ?? JSON.stringify(error)}`
        );
      }

      return (await response.json()) as EvaluateResponse;
    } finally {
      clearTimeout(timeout);
    }
  }

  private _warnIfInsecure(): void {
    try {
      const url = new URL(this.baseUrl);
      if (
        url.protocol === "http:" &&
        !["localhost", "127.0.0.1", "::1"].includes(url.hostname)
      ) {
        console.warn(
          `⚠️  smart402 SDK is connecting over HTTP to ${url.hostname}. ` +
            `API keys sent over HTTP are vulnerable to interception. ` +
            `Use https:// for non-localhost connections.`
        );
      }
    } catch {
      // Invalid URL — will fail on first request anyway
    }
  }
}
