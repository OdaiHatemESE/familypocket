// scan-receipt: reads a receipt (a photo, several photos of one long receipt, or a PDF) and returns a draft of item lines for the family to review.
// Provider settings: see ../_shared/ai/pick.ts. SCAN_DAILY_LIMIT: receipts per family per day (default 30).
import { pickProvider } from '../_shared/ai/pick.ts';
import { ProviderError } from '../_shared/ai/types.ts';
import { cors, fail, loadCatalog, logUsage, overDailyLimit, reply, session, todayDubai } from '../_shared/http.ts';
import { normalizeReceipt } from '../_shared/receipt/normalize.ts';
import { buildScanPrompt, RawReceipt, receiptSchema } from '../_shared/receipt/schema.ts';

// Several photos (parts of one long receipt) or a PDF, read together as one receipt
const MAX_FILES = 6;
const MAX_TOTAL_BYTES = 9 * 1024 * 1024;
const MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];

type InFile = { data?: string; mimeType?: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail(405, 'METHOD', 'POST only');

  const s = await session(req);
  if (s instanceof Response) return s;

  // { files: [{ data, mimeType }] }; older app versions send one photo as { image, mimeType }
  let body: { files?: InFile[]; image?: string; mimeType?: string };
  try {
    body = await req.json();
  } catch {
    return fail(400, 'BAD_REQUEST', 'الطلب غير صالح');
  }
  const incoming: InFile[] = Array.isArray(body.files) ? body.files : body.image ? [{ data: body.image, mimeType: body.mimeType }] : [];
  const files = incoming
    .map((f) => ({ base64: String(f?.data ?? '').replace(/^data:[^;]+;base64,/, ''), mimeType: MIME_TYPES.includes(f?.mimeType ?? '') ? f.mimeType! : 'image/jpeg' }))
    .filter((f) => f.base64);
  if (!files.length) return fail(400, 'NO_IMAGE', 'ما وصلت صورة ولا ملف');
  if (files.length > MAX_FILES) return fail(413, 'TOO_MANY_FILES', `أكثر إشي ${MAX_FILES} صور للفاتورة الوحدة`);
  if (files.reduce((a, f) => a + f.base64.length * 0.75, 0) > MAX_TOTAL_BYTES) return fail(413, 'IMAGE_TOO_LARGE', 'الملف كبير، جرّب ملف أصغر أو صور أقل');

  const limited = await overDailyLimit(s, 'photo', Number(Deno.env.get('SCAN_DAILY_LIMIT') ?? 30));
  if (limited) return limited;

  const catalog = await loadCatalog(s);
  const provider = pickProvider();
  try {
    const { data, model } = await provider.json<RawReceipt>({
      prompt: buildScanPrompt(catalog, files.length > 1 ? 'pages' : files[0].mimeType === 'application/pdf' ? 'pdf' : 'photo'),
      schema: receiptSchema(),
      name: 'record_receipt',
      files,
      maxTokens: files.length > 1 || files[0].mimeType === 'application/pdf' ? 12000 : 6000,
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
