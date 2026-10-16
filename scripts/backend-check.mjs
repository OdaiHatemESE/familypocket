// End-to-end check of accounts, family sharing and row-level security against the live Supabase project.
// Creates throwaway "qa_" accounts in two separate QA families.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const URL = process.env.SUPABASE_URL ?? 'https://eypcyrthilqohmawirly.supabase.co';
const KEY = process.env.SUPABASE_KEY ?? 'sb_publishable_fa_TJ1Ym4n5ZxEeVIR5aiA_b9V-ID6T';
const email = (u) => `${u}@familypocket.local`;
const client = () => createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const tag = Date.now().toString(36);
const A = `qa_a_${tag}`, B = `qa_b_${tag}`, Cc = `qa_c_${tag}`;
let failed = 0;
const CI = !!process.env.GITHUB_ACTIONS;
for (const ev of ['uncaughtException', 'unhandledRejection']) {
  process.on(ev, (e) => {
    const msg = `${ev}: ${e?.stack ?? e}`.replace(/\n/g, ' | ');
    console.log(CI ? `::error::${msg}` : msg);
    process.exit(1);
  });
}
// In CI, failures and notes become annotations, which are readable from the API without log access
const note = (msg) => console.log(CI ? `::notice::${msg}` : msg);
const ok = (cond, name, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`);
  if (!cond) {
    failed++;
    if (CI) console.log(`::error::${name}${extra ? ` (${extra})` : ''}`);
  }
};
const signIn = async (u, p) => {
  const c = client();
  const { error } = await c.auth.signInWithPassword({ email: email(u), password: p });
  return { c, error };
};

// 1. Register family A
const anon = client();
let r = await anon.rpc('register_family', { p_username: A, p_password: 'secret123', p_display_name: 'QA Owner', p_family_name: 'QA check' });
ok(!r.error, 'register family', r.error?.message);
r = await anon.rpc('register_family', { p_username: A, p_password: 'secret123', p_display_name: 'Dup', p_family_name: 'QA check' });
ok(r.error?.message === 'USERNAME_TAKEN', 'duplicate username rejected', r.error?.message);
r = await anon.rpc('register_family', { p_username: 'Bad Name!', p_password: 'secret123', p_display_name: 'x', p_family_name: 'QA check' });
ok(r.error?.message === 'USERNAME_INVALID', 'invalid username rejected', r.error?.message);

const { c: a, error: aErr } = await signIn(A, 'secret123');
ok(!aErr, 'owner signs in with username + password', aErr?.message);
const wrong = await signIn(A, 'nope-nope');
ok(wrong.error?.message === 'Invalid login credentials', 'wrong password rejected', wrong.error?.message);

const cats = await a.from('categories').select('*');
ok(cats.data?.length === 5, 'starter categories created', `${cats.data?.length}`);

// 2. Add member B
r = await a.rpc('add_family_member', { p_username: B, p_password: 'member123', p_display_name: 'QA Member', p_color: '#B23A58' });
ok(!r.error && r.data, 'owner adds a family member', r.error?.message);
const { c: b, error: bErr } = await signIn(B, 'member123');
ok(!bErr, 'member signs in', bErr?.message);
const bCats = await b.from('categories').select('id');
ok(bCats.data?.length === 5, 'member sees family categories', `${bCats.data?.length}`);
const bMembers = await b.from('profiles').select('username');
ok(bMembers.data?.length === 2, 'member sees both family members', `${bMembers.data?.length}`);

// 3. Expenses are shared, edits are per-owner
const catId = cats.data[0].id;
const today = new Date().toISOString().slice(0, 10);
const bExp = await b.from('expenses').insert({ amount: 42.5, note: 'qa', category_id: catId, spent_on: today }).select().single();
ok(!bExp.error && bExp.data.user_id, 'member records an expense under their name', bExp.error?.message);
const aSees = await a.from('expenses').select('id').eq('id', bExp.data?.id);
ok(aSees.data?.length === 1, "owner sees member's expense");
const aEdit = await a.from('expenses').update({ amount: 1 }).eq('id', bExp.data?.id).select();
ok((aEdit.data?.length ?? 0) === 0, "owner cannot edit member's expense");
const bEdit = await b.from('expenses').update({ amount: 50 }).eq('id', bExp.data?.id).select();
ok(bEdit.data?.length === 1, 'member edits own expense');
const spoof = await b.from('expenses').insert({ amount: 5, category_id: catId, spent_on: today, user_id: (await a.auth.getUser()).data.user.id });
ok(!!spoof.error, 'member cannot record an expense as someone else');

// 4. Budgets and fixed obligations (any member)
const budget = await b.from('categories').update({ monthly_budget: 3500 }).eq('id', catId).select();
ok(budget.data?.length === 1, 'member updates a category budget');
const fx = await b.from('fixed_expenses').insert({ name: 'QA rent', amount: 100, due_day: 1, category_id: catId }).select().single();
ok(!fx.error, 'member adds a fixed monthly expense', fx.error?.message);
const pay1 = await a.from('expenses').insert({ amount: 100, note: 'QA rent', category_id: catId, spent_on: today, fixed_id: fx.data?.id });
ok(!pay1.error, 'fixed expense marked paid', pay1.error?.message);
const pay2 = await b.from('expenses').insert({ amount: 100, note: 'QA rent', category_id: catId, spent_on: today, fixed_id: fx.data?.id });
ok(pay2.error?.code === '23505', 'fixed expense cannot be paid twice in a month', pay2.error?.code);

// 5. Another family is fully isolated
r = await anon.rpc('register_family', { p_username: Cc, p_password: 'secret123', p_display_name: 'QA Other', p_family_name: 'QA check' });
const { c: other } = await signIn(Cc, 'secret123');
const leak = await other.from('expenses').select('id').eq('id', bExp.data?.id);
ok((leak.data?.length ?? 0) === 0, "another family cannot read this family's expenses");
const leakCat = await other.from('categories').update({ monthly_budget: 1 }).eq('id', catId).select();
ok((leakCat.data?.length ?? 0) === 0, "another family cannot change this family's budget");
const hh = (await a.from('households').select('id').single()).data?.id;
const inject = await other.from('expenses').insert({ amount: 9, category_id: catId, spent_on: today, household_id: hh });
ok(!!inject.error, "another family cannot write into this family's data");
const otherAdd = await other.rpc('set_member_password', { p_user: (await b.auth.getUser()).data.user.id, p_password: 'hacked123' });
ok(!!otherAdd.error, "another family's owner cannot reset this member's password", otherAdd.error?.message);

// 5b. Monthly member budgets
const month = today.slice(0, 7);
const bId = (await b.auth.getUser()).data.user.id;
let q = await a.from('member_budgets').upsert({ user_id: bId, month, total: 4000 });
ok(!q.error, "owner sets member's monthly budget", q.error?.message);
q = await a.from('member_category_budgets').upsert(cats.data.map((c, i) => ({ user_id: bId, month, category_id: c.id, amount: i === 0 ? 1500 : 0 })));
ok(!q.error, "owner splits member's budget across categories", q.error?.message);
q = await b.from('member_budgets').select('total').eq('user_id', bId).eq('month', month).single();
ok(Number(q.data?.total) === 4000, 'member sees their budget', JSON.stringify(q.data));
q = await b.from('member_budgets').upsert({ user_id: bId, month, total: 4500 }).select();
ok(q.data?.length === 1, 'member updates their own budget');
q = await other.from('member_budgets').select('total').eq('user_id', bId);
ok((q.data?.length ?? 0) === 0, "another family cannot read this family's budgets");
q = await other.from('member_budgets').insert({ user_id: bId, month: '2030-01', total: 1 });
ok(!!q.error, "another family cannot set this family's budgets");
q = await other.from('member_category_budgets').insert({ user_id: (await other.auth.getUser()).data.user.id, month, category_id: catId, amount: 1 });
ok(!!q.error, "another family cannot use this family's categories in a budget");
const fxOwner = await a.from('fixed_expenses').insert({ name: 'QA school bus', amount: 300, due_day: 5, category_id: catId, owner_id: bId }).select().single();
ok(!fxOwner.error && fxOwner.data.owner_id === bId, 'fixed expense assigned to a responsible member', fxOwner.error?.message);

// 5c. Items and receipt lines
const item = await b.from('items').insert({ category_id: catId, name: 'QA dish soap', unit: 'علبة' }).select().single();
ok(!item.error, 'member adds an item with a unit', item.error?.message);
const dupItem = await a.from('items').insert({ category_id: catId, name: 'QA dish soap', unit: 'علبة' });
ok(dupItem.error?.code === '23505', 'same item name cannot repeat in a category', dupItem.error?.code);
const receipt = await b.from('expenses').insert({ amount: 45, note: 'QA market', category_id: catId, spent_on: today }).select().single();
const lines = await b.from('expense_items').insert([
  { expense_id: receipt.data.id, item_id: item.data.id, category_id: catId, name: 'QA dish soap', unit: 'علبة', quantity: 2, amount: 30 },
  { expense_id: receipt.data.id, item_id: null, category_id: catId, name: 'QA bread', unit: 'ربطة', quantity: 1.5, amount: 15 },
]).select();
ok(lines.data?.length === 2, 'member records a receipt with quantities', lines.error?.message);
const withLines = await a.from('expenses').select('id, expense_items(quantity, amount)').eq('id', receipt.data.id).single();
ok(withLines.data?.expense_items?.length === 2, 'family sees receipt lines', JSON.stringify(withLines.error));
const foreignLine = await a.from('expense_items').insert({ expense_id: receipt.data.id, category_id: catId, name: 'x', unit: 'حبة', quantity: 1, amount: 1 });
ok(!!foreignLine.error, "owner cannot add lines to member's receipt");
const editLine = await a.from('expense_items').update({ amount: 1 }).eq('expense_id', receipt.data.id).select();
ok((editLine.data?.length ?? 0) === 0, "owner cannot change member's receipt lines");
const otherLines = await other.from('expense_items').select('id').eq('expense_id', receipt.data.id);
ok((otherLines.data?.length ?? 0) === 0, "another family cannot read this family's receipt lines");
const otherItems = await other.from('items').select('id').eq('category_id', catId);
ok((otherItems.data?.length ?? 0) === 0, "another family cannot read this family's items");
const replace = await b.from('expense_items').delete().eq('expense_id', receipt.data.id).select();
ok(replace.data?.length === 2, 'member replaces their receipt lines when editing');

// 5d. Learned receipt names and the receipt reader
const al = await b.from('item_aliases').upsert({ alias: 'qa fairy lemon 750ml', item_id: item.data.id }, { onConflict: 'household_id,alias' }).select();
ok(al.data?.length === 1, 'member saves a learned receipt name', al.error?.message);
const otherAlias = await other.from('item_aliases').select('alias').eq('alias', 'qa fairy lemon 750ml');
ok((otherAlias.data?.length ?? 0) === 0, "another family cannot read this family's learned names");
const otherAliasWrite = await other.from('item_aliases').insert({ alias: 'qa hijack', item_id: item.data.id });
ok(!!otherAliasWrite.error, "another family cannot point a name at this family's item");
const fakeScanLog = await b.from('receipt_scans').delete().eq('household_id', hh).select();
ok((fakeScanLog.data?.length ?? 0) === 0, 'scan history cannot be deleted to dodge the daily limit');

const noAuth = await fetch(`${URL}/functions/v1/scan-receipt`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: '{}' });
ok(noAuth.status === 401, 'receipt reader refuses requests without sign-in', String(noAuth.status));

const photo = readFileSync(new globalThis.URL('./fixtures/receipt-carrefour.jpg', import.meta.url)).toString('base64');
const t0 = Date.now();
const scan = await b.functions.invoke('scan-receipt', { body: { image: photo, mimeType: 'image/jpeg' } });
const ms = Date.now() - t0;
let scanBody = scan.data;
if (scan.error) {
  try { scanBody = await scan.error.context.json(); } catch { scanBody = { error: String(scan.error) }; }
}
if (scanBody?.error === 'NOT_CONFIGURED') {
  note('SKIP receipt reading: GEMINI_API_KEY not set yet');
} else {
  ok(!scan.error && Array.isArray(scanBody?.lines), 'receipt photo is read', `${scanBody?.error ?? ''} ${scanBody?.message ?? ''}`.trim());
  if (Array.isArray(scanBody?.lines)) {
    note(`provider=${scanBody.provider} model=${scanBody.model} time=${ms}ms store=${scanBody.store} date=${scanBody.date} total=${scanBody.total} linesTotal=${scanBody.linesTotal}`);
    for (const l of scanBody.lines) note(`line: ${l.raw} → ${l.name} | ${l.quantity} ${l.unit} | ${l.amount} | item=${l.itemId ? 'existing' : 'new'}${l.learned ? ' (learned)' : ''}${l.uncertain ? ' (check)' : ''}`);
    for (const w of scanBody.warnings ?? []) note(`warning: ${w}`);
    ok(scanBody.lines.length === 5, 'all 5 products found, discount and VAT not listed as items', String(scanBody.lines.length));
    ok(Math.abs((scanBody.linesTotal ?? 0) - 91.39) < 0.02, 'lines add up to the amount paid (VAT spread)', String(scanBody.linesTotal));
    ok(scanBody.date === '2026-10-14', 'receipt date read', String(scanBody.date));
    const soap = scanBody.lines.find((l) => /fairy/i.test(l.raw));
    ok(soap?.itemId === item.data.id && soap?.quantity === 2, "known item matched to the family's item with quantity 2", JSON.stringify(soap));
    const chicken = scanBody.lines.find((l) => /chicken/i.test(l.raw));
    ok(chicken && Math.abs(chicken.quantity - 1.25) < 0.01 && chicken.unit === 'كيلو', 'weighed item read as 1.25 كيلو', JSON.stringify(chicken));
    const milk = scanBody.lines.find((l) => /milk/i.test(l.raw));
    ok(milk && milk.quantity === 1 && milk.amount < 10.5, 'packaged item counted as 1 pack with its discount applied', JSON.stringify(milk));
    ok(scanBody.lines.every((l) => l.categoryId), 'every line given a family category', JSON.stringify(scanBody.lines.filter((l) => !l.categoryId).map((l) => l.raw)));
  }
}

// 6. Owner-only actions
const bTry = await b.rpc('set_member_password', { p_user: (await a.auth.getUser()).data.user.id, p_password: 'hacked123' });
ok(bTry.error?.message === 'OWNER_ONLY', 'member cannot reset passwords', bTry.error?.message);
r = await a.rpc('set_member_password', { p_user: (await b.auth.getUser()).data.user.id, p_password: 'newpass123' });
ok(!r.error, 'owner resets member password', r.error?.message);
ok(!(await signIn(B, 'newpass123')).error, 'member signs in with the new password');

// 7. Removing a member blocks sign-in but keeps their expenses
r = await a.rpc('remove_family_member', { p_user: (await b.auth.getUser()).data.user.id });
ok(!r.error, 'owner removes member', r.error?.message);
const after = await signIn(B, 'newpass123');
ok(!!after.error, 'removed member cannot sign in', after.error?.message);
const kept = await a.from('expenses').select('id').eq('id', bExp.data?.id);
ok(kept.data?.length === 1, "removed member's expenses stay in the family");

console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
