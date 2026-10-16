// Which AI provider to use, from the function's secrets:
//   AI_PROVIDER        "gemini" (default) or "claude"   (RECEIPT_PROVIDER is still read, for older setups)
//   GEMINI_API_KEY     required for gemini
//   GEMINI_MODEL       optional, tried first (default order: gemini-3.6-flash, then the Flash-Lite models)
//   ANTHROPIC_API_KEY  required for claude
//   CLAUDE_MODEL       optional, e.g. "claude-haiku-5-5"
import { claudeProvider } from './claude.ts';
import { geminiProvider } from './gemini.ts';
import type { AiProvider } from './types.ts';

export function pickProvider(): AiProvider {
  const which = (Deno.env.get('AI_PROVIDER') ?? Deno.env.get('RECEIPT_PROVIDER') ?? 'gemini').toLowerCase();
  if (which === 'claude') return claudeProvider(Deno.env.get('ANTHROPIC_API_KEY'), Deno.env.get('CLAUDE_MODEL') || undefined);
  return geminiProvider(Deno.env.get('GEMINI_API_KEY'), Deno.env.get('GEMINI_MODEL') || undefined);
}
