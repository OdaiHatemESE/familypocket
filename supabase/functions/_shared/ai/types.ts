// An AI provider turns a prompt (and optionally photos or PDFs) into JSON that matches a schema.
// Every provider has the same shape, so they can be swapped with one setting (AI_PROVIDER).

export type JsonRequest = {
  prompt: string;
  /** OpenAPI-style schema (nullable: true for optional values), shared by all providers */
  schema: Record<string, unknown>;
  /** Short snake_case name for what is being produced, e.g. "record_receipt" */
  name: string;
  /** Photos (image/*) or PDF files (application/pdf), read together as one document, in order */
  files?: { base64: string; mimeType: string }[];
  maxTokens?: number;
};

export interface AiProvider {
  name: string;
  json<T>(req: JsonRequest): Promise<{ data: T; model: string }>;
}

export class ProviderError extends Error {
  constructor(public code: 'NOT_CONFIGURED' | 'RATE_LIMITED' | 'UPSTREAM' | 'BAD_OUTPUT', message: string) {
    super(message);
  }
}
