import type { IntegrationCapability, IntegrationEnvelope, InvocationResult } from "./contracts.js";

export async function invokeJsonService<TInput, TOutput>(
  capability: IntegrationCapability,
  envelope: IntegrationEnvelope<TInput>,
): Promise<InvocationResult<TOutput>> {
  if (!capability.endpointEnv) throw new Error(`${capability.id}는 외부 호출 기능이 아닙니다.`);
  const endpoint = process.env[capability.endpointEnv]?.trim();
  if (!endpoint) throw new Error(`${capability.endpointEnv} 환경변수가 설정되지 않았습니다.`);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Request-Id": envelope.context.requestId,
      "X-Origin": "forest-back-demo",
    },
    body: JSON.stringify(envelope),
    signal: AbortSignal.timeout(5_000),
  });
  const responseBody = await response.json().catch(() => ({ message: response.statusText })) as TOutput;
  if (!response.ok) throw new Error(`${capability.id} 호출 실패(${response.status})`);
  return { capabilityId: capability.id, endpoint, status: response.status, response: responseBody };
}
