// assistant: the in-app chat. A message is either a question about the family's spending (answered from their data)
// or a purchase described in words ("اشتريت 4 كيلو بندورة بـ 12…"), returned as a receipt draft to review and save.
// Provider settings: see ../_shared/ai/pick.ts. ASSISTANT_DAILY_LIMIT: messages per family per day (default 60).
import { buildFacts } from '../_shared/assistant/facts.ts';
import { pickProvider } from '../_shared/ai/pick.ts';
import { ProviderError } from '../_shared/ai/types.ts';
import { cors, fail, loadCatalog, logUsage, overDailyLimit, reply, session, todayDubai } from '../_shared/http.ts';
import { normalizeReceipt } from '../_shared/receipt/normalize.ts';
import { catalogText, lineRules, RawReceipt, receiptSchema } from '../_shared/receipt/schema.ts';

type Turn = { role: 'user' | 'assistant'; text: string };
type Result = { kind: 'answer' | 'receipt' | 'other'; answer: string; receipt: RawReceipt };

const SCHEMA = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['answer', 'receipt', 'other'] },
    answer: { type: 'string' },
    receipt: receiptSchema(true),
  },
  required: ['kind', 'answer', 'receipt'],
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail(405, 'METHOD', 'POST only');

  const s = await session(req);
  if (s instanceof Response) return s;

  let body: { message?: string; history?: Turn[] };
  try {
    body = await req.json();
  } catch {
    return fail(400, 'BAD_REQUEST', 'الطلب غير صالح');
  }
  const message = String(body.message ?? '').trim().slice(0, 1500);
  if (!message) return fail(400, 'EMPTY', 'اكتب رسالتك أولاً');
  const history = (Array.isArray(body.history) ? body.history : [])
    .filter((t) => (t?.role === 'user' || t?.role === 'assistant') && typeof t.text === 'string')
    .slice(-6)
    .map((t) => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.text.slice(0, 600)}`)
    .join('\n');

  const limited = await overDailyLimit(s, 'assistant', Number(Deno.env.get('ASSISTANT_DAILY_LIMIT') ?? 60));
  if (limited) return limited;

  const today = todayDubai();
  const catalog = await loadCatalog(s);
  const [facts, me] = await Promise.all([
    buildFacts(s.supabase, catalog.categories, today),
    s.supabase.from('profiles').select('display_name').eq('id', s.userId).single(),
  ]);
  const weekday = new Date(`${today}T12:00:00Z`).toLocaleDateString('ar', { weekday: 'long', timeZone: 'UTC' });

  const prompt = `You are the assistant inside "مصاريفي", a family budgeting app in the UAE. Amounts are in AED (درهم).
Today is ${weekday} ${today}. The person writing is ${me.data?.display_name ?? 'a family member'}.

Decide what their message is and set "kind":
- "receipt": they are telling you about things they bought or paid for and want them recorded (e.g. "اشتريت…", "سجّل…", "دفعت…").
  Put one line per product in "receipt.lines":
  - raw_text: the words they used for that product.
${lineRules(catalog.units)}
  - line_total: the total paid for that product. If they gave a unit price ("الكيلو بـ 5"), multiply it by the quantity. null when they gave no price for it.
  - uncertain: true if you had to guess the product, quantity or price.
  receipt.total: the overall amount if they said one ("ودفعت 60 على الكل"), else null. receipt.store: the shop if they named it, else null.
  receipt.date: YYYY-MM-DD. Work out words like "مبارح" or "يوم الخميس" from today's date; null when they did not say (means today).
  "answer": one short sentence telling them the receipt is ready to review and save. Do not repeat the lines.
- "answer": a question or request about their spending, budgets, items, prices, obligations or saving advice.
  Answer from the FAMILY DATA below only. Never invent numbers; if the data does not hold the answer, say so plainly.
  Use the pre-computed totals; when you add several numbers, add them carefully. Name months in Arabic.
  receipt.lines must be empty.
- "other": greetings or anything else. Reply briefly and say what you can do: answer questions about their spending,
  or record a purchase they describe, e.g. "اشتريت 2 كيلو بندورة بـ 8 دراهم وكيس خبز بـ 3". receipt.lines must be empty.

How to write "answer": the same Arabic dialect as the user, warm and to the point, at most 7 short lines.
Plain text only: no markdown, no asterisks, no #, no tables. Use "• " at the start of a line for lists.
Write amounts like "1,250 درهم" with at most 2 decimals.

${history ? `Earlier in this chat:\n${history}\n` : ''}
Their message:
${message}

${catalogText(catalog)}

FAMILY DATA:
${facts}`;

  const provider = pickProvider();
  try {
    const { data, model } = await provider.json<Result>({ prompt, schema: SCHEMA, name: 'reply_to_user', maxTokens: 4096 });
    await logUsage(s, 'assistant', provider.name, model, true);
    const lines = data?.receipt?.lines ?? [];
    const answer = String(data?.answer ?? '').replace(/\*\*/g, '').trim();
    if (data?.kind === 'receipt' && lines.length) {
      const draft = normalizeReceipt(data.receipt, catalog.items, catalog.categories, catalog.units, catalog.aliases, today, { priceOptional: true });
      return reply(200, { kind: 'receipt', answer: answer || 'جهّزتلك الفاتورة، راجعها واحفظها.', draft, provider: provider.name, model });
    }
    return reply(200, { kind: 'answer', answer: answer || 'ما فهمت عليك، ممكن توضّح أكثر؟', provider: provider.name, model });
  } catch (e) {
    const err = e instanceof ProviderError ? e : new ProviderError('UPSTREAM', String(e));
    console.error(`[assistant] ${provider.name} ${err.code}: ${err.message}`);
    if (err.code === 'NOT_CONFIGURED') return fail(503, 'NOT_CONFIGURED', 'المساعد مش مفعّل لسه.');
    await logUsage(s, 'assistant', provider.name, 'unknown', false);
    if (err.code === 'RATE_LIMITED') return fail(429, 'PROVIDER_BUSY', 'المساعد مشغول حالياً، جرّب بعد دقيقة.');
    return fail(502, err.code, 'ما قدرت أرد هالمرة، جرّب مرة ثانية.');
  }
});
