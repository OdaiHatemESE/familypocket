// scan-receipt: reads a receipt photo and returns a draft of item lines for the family to review.
//
// Settings (Supabase → Edge Functions → Secrets):
//   RECEIPT_PROVIDER   "gemini" (default) or "claude"
//   GEMINI_API_KEY     required for gemini
//   GEMINI_MODEL       optional, tried first (default order: gemini-3.6-flash, then the Flash-Lite models)
//   ANTHROPIC_API_KEY  required for claude
//   CLAUDE_MODEL       optional, e.g. "claude-haiku-5-5"
//   SCAN_DAILY_LIMIT   optional, receipts per family per day (default 30)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { normalizeReceipt } from './normalize.ts';
import { claudeProvider } from './providers/claude.ts';
import { geminiProvider } from './providers/gemini.ts';
import { ProviderError, ReceiptProvider } from './providers/types.ts';

const UNITS = ['حبة', 'علبة', 'كيلو', 'غرام', 'لتر', 'ربطة', 'كيس', 'كرتونة', 'عبوة', 'رغيف'];
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const fail = (status: number, code: string, message: string) => reply(status, { error: code, message });

function pickProvider(): ReceiptProvider {
  const which = (Deno.env.get('RECEIPT_PROVIDER') ?? 'gemini').toLowerCase();
  if (which === 'claude') return claudeProvider(Deno.env.get('ANTHROPIC_API_KEY'), Deno.env.get('CLAUDE_MODEL') || undefined);
  return geminiProvider(Deno.env.get('GEMINI_API_KEY'), Deno.env.get('GEMINI_MODEL') || undefined);
}

/** Today's date in the UAE, for sanity-checking receipt dates */
const todayDubai = () => new Date(Date.now() + 4 * 3600 * 1000).toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail(405, 'METHOD', 'POST only');

  // Act as the signed-in user, so every read and write below goes through the family's row-level security
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
  const { data: userData } = await supabase.auth.getUser(authHeader.replace(/^Bearer\s+/i, ''));
  const user = userData?.user;
  if (!user) return fail(401, 'NOT_SIGNED_IN', 'سجّل دخول أولاً');

  const { data: profile } = await supabase.from('profiles').select('household_id, active').eq('id', user.id).maybeSingle();
  if (!profile?.active) return fail(403, 'NO_FAMILY', 'الحساب مش مرتبط بعائلة');

  let body: { image?: string; mimeType?: string };
  try {
    body = await req.json();
  } catch {
    return fail(400, 'BAD_REQUEST', 'الطلب غير صالح');
  }
  const image = (body.image ?? '').replace(/^data:[^;]+;base64,/, '');
  const mimeType = MIME_TYPES.includes(body.mimeType ?? '') ? body.mimeType! : 'image/jpeg';
  if (!image) return fail(400, 'NO_IMAGE', 'ما وصلت صورة');
  if (image.length * 0.75 > MAX_IMAGE_BYTES) return fail(413, 'IMAGE_TOO_LARGE', 'الصورة كبيرة، جرّب صورة أصغر');

  // Daily limit per family, so one account cannot exhaust the shared quota
  const limit = Number(Deno.env.get('SCAN_DAILY_LIMIT') ?? 30);
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await supabase
    .from('receipt_scans')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', profile.household_id)
    .gte('created_at', since);
  if ((count ?? 0) >= limit) return fail(429, 'DAILY_LIMIT', `وصلتوا الحد اليومي (${limit} فاتورة). جرّبوا بكرة.`);

  const [itemsRes, catsRes, aliasRes] = await Promise.all([
    supabase.from('items').select('id, name, unit, category_id').eq('archived', false).limit(1500),
    supabase.from('categories').select('id, name').order('sort'),
    supabase.from('item_aliases').select('alias, item_id').limit(5000),
  ]);
  const items = itemsRes.data ?? [];
  const categories = catsRes.data ?? [];
  const aliases = Object.fromEntries((aliasRes.data ?? []).map((a) => [a.alias, a.item_id]));

  const provider = pickProvider();
  try {
    const { receipt, model } = await provider.scan({ imageBase64: image, mimeType, items, categories, units: UNITS });
    await supabase.from('receipt_scans').insert({ provider: provider.name, model, ok: true });
    const draft = normalizeReceipt(receipt, items, categories, UNITS, aliases, todayDubai());
    return reply(200, { provider: provider.name, model, ...draft });
  } catch (e) {
    const err = e instanceof ProviderError ? e : new ProviderError('UPSTREAM', String(e));
    console.error(`[scan-receipt] ${provider.name} ${err.code}: ${err.message}`);
    if (err.code === 'NOT_CONFIGURED') return fail(503, 'NOT_CONFIGURED', 'قراءة الفواتير مش مفعّلة لسه.');
    await supabase.from('receipt_scans').insert({ provider: provider.name, model: 'unknown', ok: false });
    if (err.code === 'RATE_LIMITED') return fail(429, 'PROVIDER_BUSY', 'الخدمة مشغولة حالياً، جرّب بعد دقيقة.');
    return fail(502, err.code, 'ما قدرنا نقرأ الفاتورة هالمرة، جرّب مرة ثانية.');
  }
});
