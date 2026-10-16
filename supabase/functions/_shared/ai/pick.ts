// Which AI provider to use, from the function's secrets:
//   AI_PROVIDER        "gemini" (default) or "claude"   (RECEIPT_PROVIDER is still read, for older setups)
//   GEMINI_API_KEY     required for gemini
//   GEMINI_MODEL       optional, tried first (default order: gemini-3.6-flash, then the Flash-Lite models)
//   ANTHROPIC_API_KEY  required for claude
//   CLAUDE_MODEL       optional, e.g. "claude-haiku-5-5"
// When both keys are set, the other provider is used as a backup whenever the chosen one is busy or down.
import { claudeProvider } from './claude.ts';
import { geminiProvider } from './gemini.ts';
import { AiProvider, ProviderError } from './types.ts';

export function pickProvider(): AiProvider {
  const gemini = Deno.env.get('GEMINI_API_KEY') ? geminiProvider(Deno.env.get('GEMINI_API_KEY'), Deno.env.get('GEMINI_MODEL') || undefined) : null;
  const claude = Deno.env.get('ANTHROPIC_API_KEY') ? claudeProvider(Deno.env.get('ANTHROPIC_API_KEY'), Deno.env.get('CLAUDE_MODEL') || undefined) : null;
  const which = (Deno.env.get('AI_PROVIDER') ?? Deno.env.get('RECEIPT_PROVIDER') ?? 'gemini').toLowerCase();
  const chain = (which === 'claude' ? [claude, gemini] : [gemini, claude]).filter(Boolean) as AiProvider[];
  if (!chain.length) return which === 'claude' ? claudeProvider(undefined) : geminiProvider(undefined);
  if (chain.length === 1) return chain[0];

  const [primary, backup] = chain;
  return {
    name: primary.name,
    async json(req) {
      try {
        return await primary.json(req);
      } catch (e) {
        // Busy or down: try the backup. A bad answer (BAD_OUTPUT) is retried there too.
        if (!(e instanceof ProviderError) || e.code === 'NOT_CONFIGURED') throw e;
        console.warn(`[ai] ${primary.name} ${e.code}, falling back to ${backup.name}`);
        return await backup.json(req);
      }
    },
  };
}
