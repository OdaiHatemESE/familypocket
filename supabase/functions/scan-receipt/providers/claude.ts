import { buildPrompt, ProviderError, RawReceipt, RECEIPT_SCHEMA, ReceiptProvider, ScanInput } from './types.ts';

const DEFAULT_MODEL = 'claude-haiku-5-5';

/** JSON Schema without the OpenAPI-only `nullable` flag, for Claude tool input */
function toJsonSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toJsonSchema);
  if (!node || typeof node !== 'object') return node;
  const { nullable, ...rest } = node as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) out[k] = toJsonSchema(v);
  if (nullable && typeof out.type === 'string') out.type = [out.type, 'null'];
  return out;
}

export function claudeProvider(apiKey: string | undefined, model = DEFAULT_MODEL): ReceiptProvider {
  return {
    name: 'claude',
    async scan(input: ScanInput) {
      if (!apiKey) throw new ProviderError('NOT_CONFIGURED', 'ANTHROPIC_API_KEY is not set');
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          temperature: 0,
          tools: [{ name: 'record_receipt', description: 'Record the extracted receipt', input_schema: toJsonSchema(RECEIPT_SCHEMA) }],
          tool_choice: { type: 'tool', name: 'record_receipt' },
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: input.mimeType, data: input.imageBase64 } },
                { type: 'text', text: buildPrompt(input) },
              ],
            },
          ],
        }),
      });
      if (res.status === 429) throw new ProviderError('RATE_LIMITED', 'Claude rate limit reached');
      if (!res.ok) throw new ProviderError('UPSTREAM', `Claude ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const json = await res.json();
      const block = json?.content?.find((b: { type: string }) => b.type === 'tool_use');
      if (!block?.input) throw new ProviderError('BAD_OUTPUT', 'Claude returned no receipt');
      return { receipt: block.input as RawReceipt, model };
    },
  };
}
