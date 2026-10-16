import { buildPrompt, ProviderError, RawReceipt, RECEIPT_SCHEMA, ReceiptProvider, ScanInput } from './types.ts';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
// Tried in order. A model that no longer exists (404), whose free quota is used up (429) or that is overloaded (500/503)
// falls through to the next, so a busy day degrades to the lighter model instead of failing.
const FALLBACK_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];

export function geminiProvider(apiKey: string | undefined, preferredModel?: string): ReceiptProvider {
  return {
    name: 'gemini',
    async scan(input: ScanInput) {
      if (!apiKey) throw new ProviderError('NOT_CONFIGURED', 'GEMINI_API_KEY is not set');
      const models = [...new Set([preferredModel, ...FALLBACK_MODELS].filter(Boolean) as string[])];
      const body = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: buildPrompt(input) },
              { inline_data: { mime_type: input.mimeType, data: input.imageBase64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          response_mime_type: 'application/json',
          response_schema: RECEIPT_SCHEMA,
        },
      };

      let lastError = '';
      for (const model of models) {
        const res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(body),
        });
        if (res.status === 404) {
          lastError = `model ${model} not found`;
          continue;
        }
        // 429 = our free quota for this model is used up; 500/503 = the model is overloaded right now
        if (res.status === 429 || res.status === 500 || res.status === 503) {
          lastError = `model ${model} busy (${res.status})`;
          if (model !== models[models.length - 1]) continue;
          throw new ProviderError('RATE_LIMITED', `Gemini busy: ${lastError}`);
        }
        if (!res.ok) throw new ProviderError('UPSTREAM', `Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
        const json = await res.json();
        const text: string | undefined = json?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text ?? '')
          .join('');
        if (!text) throw new ProviderError('BAD_OUTPUT', `Gemini returned no text (${json?.candidates?.[0]?.finishReason ?? 'unknown'})`);
        try {
          return { receipt: JSON.parse(text) as RawReceipt, model };
        } catch {
          throw new ProviderError('BAD_OUTPUT', 'Gemini returned invalid JSON');
        }
      }
      throw new ProviderError('UPSTREAM', lastError || 'No Gemini model available');
    },
  };
}
