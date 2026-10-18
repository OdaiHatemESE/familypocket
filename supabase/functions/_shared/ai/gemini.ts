import { AiProvider, JsonRequest, ProviderError } from './types.ts';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
// Tried in order. A model that no longer exists (404), whose free quota is used up (429) or that is overloaded (500/503)
// falls through to the next, so a busy day degrades to the lighter model instead of failing.
const FALLBACK_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];

/** Models whose quota ran out recently, skipped while this server instance stays warm */
const quotaUsedUntil = new Map<string, number>();

const call = (model: string, apiKey: string, body: unknown) =>
  fetch(`${ENDPOINT}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });

export function geminiProvider(apiKey: string | undefined, preferredModel?: string): AiProvider {
  return {
    name: 'gemini',
    async json<T>(req: JsonRequest) {
      if (!apiKey) throw new ProviderError('NOT_CONFIGURED', 'GEMINI_API_KEY is not set');
      const models = [...new Set([preferredModel, ...FALLBACK_MODELS].filter(Boolean) as string[])];
      const parts: Record<string, unknown>[] = [{ text: req.prompt }];
      for (const f of req.files ?? []) parts.push({ inline_data: { mime_type: f.mimeType, data: f.base64 } });
      const body = {
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0,
          response_mime_type: 'application/json',
          response_schema: req.schema,
          ...(req.maxTokens ? { maxOutputTokens: req.maxTokens } : {}),
        },
      };

      let lastError = '';
      const last = models[models.length - 1];
      for (const model of models) {
        if ((quotaUsedUntil.get(model) ?? 0) > Date.now() && model !== last) continue;
        let res = await call(model, apiKey, body);
        // Overloaded (500/503) is usually a passing spike: two short retries on the same model first
        for (const wait of [1200, 2500]) {
          if (res.status !== 500 && res.status !== 503) break;
          console.warn(`[gemini] ${model} ${res.status}, retrying in ${wait}ms`);
          await new Promise((r) => setTimeout(r, wait));
          res = await call(model, apiKey, body);
        }
        if (res.status === 404) {
          lastError = `model ${model} not found`;
          continue;
        }
        // 429 = our free quota for this model is used up; 500/503 = still overloaded
        if (res.status === 429 || res.status === 500 || res.status === 503) {
          if (res.status === 429) quotaUsedUntil.set(model, Date.now() + 10 * 60 * 1000);
          lastError = `model ${model} busy (${res.status})`;
          console.warn(`[gemini] ${lastError}`);
          if (model !== last) continue;
          throw new ProviderError('RATE_LIMITED', `Gemini busy: ${lastError}`);
        }
        if (!res.ok) throw new ProviderError('UPSTREAM', `Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
        const json = await res.json();
        const text: string | undefined = json?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text ?? '')
          .join('');
        if (!text) throw new ProviderError('BAD_OUTPUT', `Gemini returned no text (${json?.candidates?.[0]?.finishReason ?? 'unknown'})`);
        try {
          return { data: JSON.parse(text) as T, model };
        } catch {
          throw new ProviderError('BAD_OUTPUT', 'Gemini returned invalid JSON');
        }
      }
      throw new ProviderError('UPSTREAM', lastError || 'No Gemini model available');
    },
  };
}
