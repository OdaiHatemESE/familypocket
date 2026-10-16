import { AiProvider, JsonRequest, ProviderError } from './types.ts';

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

export function claudeProvider(apiKey: string | undefined, model = DEFAULT_MODEL): AiProvider {
  return {
    name: 'claude',
    async json<T>(req: JsonRequest) {
      if (!apiKey) throw new ProviderError('NOT_CONFIGURED', 'ANTHROPIC_API_KEY is not set');
      const content: Record<string, unknown>[] = [];
      if (req.image) content.push({ type: 'image', source: { type: 'base64', media_type: req.image.mimeType, data: req.image.base64 } });
      content.push({ type: 'text', text: req.prompt });
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model,
          max_tokens: req.maxTokens ?? 4096,
          temperature: 0,
          tools: [{ name: req.name, description: `Return the ${req.name.replace(/_/g, ' ')}`, input_schema: toJsonSchema(req.schema) }],
          tool_choice: { type: 'tool', name: req.name },
          messages: [{ role: 'user', content }],
        }),
      });
      if (res.status === 429 || res.status === 529) throw new ProviderError('RATE_LIMITED', `Claude busy (${res.status})`);
      if (!res.ok) throw new ProviderError('UPSTREAM', `Claude ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const json = await res.json();
      const block = json?.content?.find((b: { type: string }) => b.type === 'tool_use');
      if (!block?.input) throw new ProviderError('BAD_OUTPUT', 'Claude returned no result');
      return { data: block.input as T, model };
    },
  };
}
