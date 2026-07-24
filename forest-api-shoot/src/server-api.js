export class ServerApi {
  constructor({ apiBaseUrl, dryRun = false, timeoutMs = 5_000 }) {
    this.apiBaseUrl = apiBaseUrl;
    this.dryRun = dryRun;
    this.timeoutMs = timeoutMs;
  }

  async testIntegration(capabilityId, mode, envelope) {
    if (!["result", "invoke"].includes(mode)) {
      throw Object.assign(new Error("mode는 result 또는 invoke여야 합니다."), { statusCode: 400 });
    }
    if (this.dryRun) return { capabilityId, mode, dryRun: true, request: envelope };

    const startedAt = Date.now();
    const response = await fetch(
      `${this.apiBaseUrl}/api/v1/integrations/${encodeURIComponent(capabilityId)}/${mode === "result" ? "results" : "invoke"}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Origin": `forest-api-shoot:${capabilityId}` },
        body: JSON.stringify(envelope),
        signal: AbortSignal.timeout(this.timeoutMs),
      },
    );
    const payload = await response.json().catch(() => ({ error: { message: response.statusText } }));
    if (!response.ok) {
      throw Object.assign(
        new Error(payload.error?.message ?? `연동 테스트 실패(${response.status})`),
        { statusCode: response.status },
      );
    }
    if (response.status !== 200) {
      throw Object.assign(
        new Error(`정상 처리 상태가 아닙니다. HTTP ${response.status} (기대값 200)`),
        { statusCode: response.status },
      );
    }
    return {
      capabilityId,
      mode,
      status: response.status,
      durationMs: Date.now() - startedAt,
      request: envelope,
      response: payload,
    };
  }
}
