// Request plumbing shared by the AI functions: CORS, Arabic error replies, the signed-in family, daily limits.
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { Catalog } from './receipt/schema.ts';

export const UNITS = ['حبة', 'علبة', 'كيلو', 'غرام', 'لتر', 'ربطة', 'كيس', 'كرتونة', 'عبوة', 'رغيف'];

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

export const fail = (status: number, code: string, message: string) => reply(status, { error: code, message });

/** Today's date in the UAE */
export const todayDubai = () => new Date(Date.now() + 4 * 3600 * 1000).toISOString().slice(0, 10);

export type Session = { supabase: SupabaseClient; userId: string; householdId: string };

/**
 * The signed-in member, with a client that acts as them, so every read and write goes through the family's
 * row-level security. Returns a ready error response instead when the caller is not an active member.
 */
export async function session(req: Request): Promise<Session | Response> {
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
  return { supabase, userId: user.id, householdId: profile.household_id };
}

export type UsageKind = 'photo' | 'assistant';

/** null when under the family's daily limit for this kind of call, otherwise the error response */
export async function overDailyLimit(s: Session, kind: UsageKind, limit: number): Promise<Response | null> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await s.supabase
    .from('receipt_scans')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', s.householdId)
    .eq('kind', kind)
    .gte('created_at', since);
  if ((count ?? 0) < limit) return null;
  return kind === 'photo'
    ? fail(429, 'DAILY_LIMIT', `وصلتوا الحد اليومي (${limit} فاتورة). جرّبوا بكرة.`)
    : fail(429, 'DAILY_LIMIT', `وصلتوا الحد اليومي للمساعد (${limit} رسالة). جرّبوا بكرة.`);
}

export async function logUsage(s: Session, kind: UsageKind, provider: string, model: string, ok: boolean) {
  await s.supabase.from('receipt_scans').insert({ kind, provider, model, ok });
}

/** The family's categories, items and learned receipt aliases */
export async function loadCatalog(s: Session): Promise<Catalog & { aliases: Record<string, string> }> {
  const [itemsRes, catsRes, aliasRes] = await Promise.all([
    s.supabase.from('items').select('id, name, unit, category_id').eq('archived', false).limit(1500),
    s.supabase.from('categories').select('id, name').order('sort'),
    s.supabase.from('item_aliases').select('alias, item_id').limit(5000),
  ]);
  return {
    items: itemsRes.data ?? [],
    categories: catsRes.data ?? [],
    units: UNITS,
    aliases: Object.fromEntries((aliasRes.data ?? []).map((a) => [a.alias, a.item_id])),
  };
}
