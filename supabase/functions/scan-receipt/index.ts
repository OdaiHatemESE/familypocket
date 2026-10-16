// scan-receipt: reads a receipt photo and returns a draft of item lines for the family to review.
// Provider settings: see ../_shared/ai/pick.ts. SCAN_DAILY_LIMIT: receipts per family per day (default 30).
import { pickProvider } from '../_shared/ai/pick.ts';
import { ProviderError } from '../_shared/ai/types.ts';
import { cors, fail, loadCatalog, logUsage, overDailyLimit, reply, session, todayDubai } from '../_shared/http.ts';
import { normalizeReceipt } from '../_shared/receipt/normalize.ts';
import { buildScanPrompt, RawReceipt, receiptSchema } from '../_shared/receipt/schema.ts';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail(405, 'METHOD', 'POST only');

  const s = await session(req);
  if (s instanceof Response) return s;

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

  const limited = await overDailyLimit(s, 'photo', Number(Deno.env.get('SCAN_DAILY_LIMIT') ?? 30));
  if (limited) return limited;

  const catalog = await loadCatalog(s);
  const provider = pickProvider();
  try {
    const { data, model } = await provider.json<RawReceipt>({
      prompt: buildScanPrompt(catalog),
      schema: receiptSchema(),
      name: 'record_receipt',
      image: { base64: image, mimeType },
    });
    await logUsage(s, 'photo', provider.name, model, true);
    const draft = normalizeReceipt(data, catalog.items, catalog.categories, catalog.units, catalog.aliases, todayDubai());
    return reply(200, { provider: provider.name, model, ...draft });
  } catch (e) {
    const err = e instanceof ProviderError ? e : new ProviderError('UPSTREAM', String(e));
    console.error(`[scan-receipt] ${provider.name} ${err.code}: ${err.message}`);
    if (err.code === 'NOT_CONFIGURED') return fail(503, 'NOT_CONFIGURED', 'قراءة الفواتير مش مفعّلة لسه.');
    await logUsage(s, 'photo', provider.name, 'unknown', false);
    if (err.code === 'RATE_LIMITED') return fail(429, 'PROVIDER_BUSY', 'الخدمة مشغولة حالياً، جرّب بعد دقيقة.');
    return fail(502, err.code, 'ما قدرنا نقرأ الفاتورة هالمرة، جرّب مرة ثانية.');
  }
});
