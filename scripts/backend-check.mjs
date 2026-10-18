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
const item = await b.from('items').insert({ category_id: catId, name: 'دواء جلي', unit: 'علبة' }).select().single();
ok(!item.error, 'member adds an item with a unit', item.error?.message);
const dupItem = await a.from('items').insert({ category_id: catId, name: 'دواء جلي', unit: 'علبة' });
ok(dupItem.error?.code === '23505', 'same item name cannot repeat in a category', dupItem.error?.code);
const receipt = await b.from('expenses').insert({ amount: 45, note: 'QA market', category_id: catId, spent_on: today }).select().single();
const lines = await b.from('expense_items').insert([
  { expense_id: receipt.data.id, item_id: item.data.id, category_id: catId, name: 'دواء جلي', unit: 'علبة', quantity: 2, amount: 30 },
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
    for (const l of scanBody.lines) note(`line: ${l.raw.replace(/\s+/g, " ")} → ${l.name} | ${l.quantity} ${l.unit} | ${l.amount} | item=${l.itemId ? 'existing' : 'new'}${l.learned ? ' (learned)' : ''}${l.uncertain ? ' (check)' : ''}`);
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

// 5e. The assistant: questions answered from the family's data, purchases described in words
const noAuthChat = await fetch(`${URL}/functions/v1/assistant`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: '{}' });
ok(noAuthChat.status === 401, 'assistant refuses requests without sign-in', String(noAuthChat.status));
const tomato = await b.from('items').insert({ category_id: catId, name: 'طماطم', unit: 'كيلو' }).select().single();
const ask = async (message, history = []) => {
  const t = Date.now();
  const res = await b.functions.invoke('assistant', { body: { message, history } });
  let body = res.data;
  if (res.error) {
    try { body = await res.error.context.json(); } catch { body = { error: String(res.error) }; }
  }
  note(`assistant (${Date.now() - t}ms, ${body?.model ?? body?.error}): ${message} → ${(body?.answer ?? body?.message ?? '').replace(/\s+/g, ' ')}`);
  return body;
};
// This month the family has: QA Member 50 + rent 100 (charged to QA Member as the responsible member) + receipt 45 = 195
const q1 = await ask('قديش صرفنا هالشهر كعائلة؟');
if (q1?.error !== 'NOT_CONFIGURED') {
  // 195 in all: 95 day-to-day + 100 rent (a commitment); either reading is a correct answer
  ok(q1?.kind === 'answer' && /95/.test(q1?.answer ?? ''), "question answered from the family's real numbers (195 / 95)", JSON.stringify(q1));
  const q2 = await ask('مين صرف أكثر هالشهر؟');
  ok(q2?.kind === 'answer' && /QA Member/.test(q2?.answer ?? ''), 'question about members answered by name', JSON.stringify(q2));
  const yesterday = new Date(Date.now() + 4 * 3600 * 1000 - 86400000).toISOString().slice(0, 10);
  const buy = await ask('اشتريت مبارح 4 كيلو بندورة بـ 12 درهم و2 علبة فيري بـ 30 وكيس خبز');
  ok(buy?.kind === 'receipt' && buy?.draft?.lines?.length === 3, 'purchase in words becomes a 3-line receipt', JSON.stringify(buy?.draft?.lines ?? buy));
  for (const l of buy?.draft?.lines ?? []) note(`spoken line: ${l.raw} → ${l.name} | ${l.quantity} ${l.unit} | ${l.amount} | item=${l.itemId ? 'existing' : 'new'}${l.needsPrice ? ' (needs price)' : ''}`);
  const tom = buy?.draft?.lines?.find((l) => l.itemId === tomato.data?.id);
  ok(tom && tom.quantity === 4 && tom.amount === 12 && tom.unit === 'كيلو', "بندورة matched to the family's طماطم, 4 كيلو for 12", JSON.stringify(buy?.draft?.lines?.[0]));
  const soap2 = buy?.draft?.lines?.find((l) => l.itemId === item.data.id);
  ok(soap2 && soap2.quantity === 2 && soap2.amount === 30, "فيري matched to the family's دواء جلي, 2 for 30", JSON.stringify(soap2));
  const bread = buy?.draft?.lines?.find((l) => l.needsPrice);
  ok(bread && bread.amount === 0, 'item said without a price is flagged for a price', JSON.stringify(buy?.draft?.lines));
  ok(buy?.draft?.date === yesterday, '"مبارح" becomes yesterday\'s date', `${buy?.draft?.date} vs ${yesterday}`);
  // A short follow-up with Arabic-Indic digits, after asking to record purchases
  const short = await ask('دجاج ٣ ٦٠ درهم', [
    { role: 'user', text: 'سجل مشترياتي' },
    { role: 'assistant', text: 'اكتبلي شو اشتريت مع الكميات والأسعار.' },
  ]);
  const chick = short?.draft?.lines?.[0];
  ok(short?.kind === 'receipt' && chick?.quantity === 3 && chick?.amount === 60, 'short follow-up "دجاج ٣ ٦٠ درهم" becomes 3 for 60', JSON.stringify(short?.draft?.lines ?? short));
}

// 5d2. Commitments: salary, rent cheques every two months, monthly set-asides
const rentC = await b.from('fixed_expenses').insert({ name: 'QA rent cheques', amount: 12000, due_day: 1, category_id: catId, kind: 'rent', every_months: 2 }).select().single();
ok(!rentC.error && rentC.data.kind === 'rent' && rentC.data.every_months === 2, 'member adds a rent paid every two months', rentC.error?.message);
const badEvery = await b.from('fixed_expenses').insert({ name: 'QA bad', amount: 1, due_day: 1, category_id: catId, every_months: 5 });
ok(!!badEvery.error, 'commitment frequency limited to 1, 2, 3, 4, 6 or 12 months');
const cheques = await b.from('commitment_payments').insert([
  { fixed_id: rentC.data.id, due_date: `${month}-01`, amount: 12000, method: 'cheque', reference: '000123' },
  { fixed_id: rentC.data.id, due_date: '2030-01-01', amount: 12000, method: 'cheque', reference: '000124' },
]).select();
ok(cheques.data?.length === 2, 'member records the rent cheques', cheques.error?.message);
const aSeesCheques = await a.from('commitment_payments').select('id').eq('fixed_id', rentC.data.id);
ok(aSeesCheques.data?.length === 2, 'family sees the cheques');
const reserve = await a.from('commitment_reserves').upsert({ fixed_id: rentC.data.id, month, amount: 6000 }).select();
ok(reserve.data?.length === 1, 'owner sets this month’s set-aside', reserve.error?.message);
const cashed = await b.from('expenses').insert({ amount: 12000, note: 'QA rent', category_id: catId, spent_on: today, fixed_id: rentC.data.id }).select().single();
const link = await b.from('commitment_payments').update({ expense_id: cashed.data?.id }).eq('id', cheques.data[0].id).select();
ok(link.data?.[0]?.expense_id === cashed.data?.id, 'cashed cheque linked to its payment', link.error?.message ?? cashed.error?.message);
const salary = await a.from('member_incomes').upsert({ user_id: bId, month, amount: 20000 }).select();
ok(salary.data?.length === 1, "owner records a member's salary", salary.error?.message);
let o = await other.from('commitment_payments').select('id').eq('fixed_id', rentC.data.id);
ok((o.data?.length ?? 0) === 0, "another family cannot read this family's cheques");
o = await other.from('commitment_payments').insert({ fixed_id: rentC.data.id, due_date: '2030-02-01', amount: 1 });
ok(!!o.error, "another family cannot add cheques to this family's rent");
o = await other.from('commitment_reserves').select('month').eq('fixed_id', rentC.data.id);
ok((o.data?.length ?? 0) === 0, "another family cannot read this family's set-asides");
o = await other.from('member_incomes').select('amount').eq('user_id', bId);
ok((o.data?.length ?? 0) === 0, "another family cannot read this family's salaries");
o = await other.from('member_incomes').insert({ user_id: bId, month, amount: 1 });
ok(!!o.error, "another family cannot set this family's salaries");
const otherFixed = await other.from('fixed_expenses').insert({ name: 'QA other', amount: 5, due_day: 1, category_id: (await other.from('categories').select('id').limit(1).single()).data.id }).select().single();
o = await other.from('commitment_payments').insert({ fixed_id: otherFixed.data?.id, due_date: '2030-02-01', amount: 1, expense_id: cashed.data?.id });
ok(!!o.error, "another family cannot link its payment to this family's expense");

// 6. Owner-only actions
const bTry = await b.rpc('set_member_password', { p_user: (await a.auth.getUser()).data.user.id, p_password: 'hacked123' });
ok(bTry.error?.message === 'OWNER_ONLY', 'member cannot reset passwords', bTry.error?.message);
const bWipe = await b.rpc('reset_family_data', { p_scope: 'all' });
if (bWipe.error?.code !== 'PGRST202') ok(bWipe.error?.message === 'OWNER_ONLY', "member cannot clear the family's data", bWipe.error?.message);
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

// 8. Starting over: the owner clears one month, or everything except the members
const probe = await a.rpc('reset_family_data', { p_scope: 'nothing' });
if (probe.error?.code === 'PGRST202') {
  note('reset_family_data is not installed yet (migration 0007), reset checks skipped');
} else {
  ok(probe.error?.message === 'BAD_SCOPE', 'reset rejects an unknown scope', probe.error?.message);
  const lastMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 2, 15)).toISOString().slice(0, 10);
  const old = await a.from('expenses').insert({ amount: 7, note: 'qa last month', category_id: catId, spent_on: lastMonth }).select().single();
  const otherExp = await other.from('expenses').insert({ amount: 9, note: 'qa other', category_id: (await other.from('categories').select('id').limit(1).single()).data.id, spent_on: today }).select().single();
  r = await other.rpc('reset_family_data', { p_scope: 'month', p_month: month });
  ok(!r.error, "another family's owner resets their own month", r.error?.message);
  ok((await a.from('expenses').select('id').eq('id', bExp.data?.id)).data?.length === 1, "another family's reset leaves this family's expenses alone");
  ok((await other.from('expenses').select('id').eq('id', otherExp.data?.id)).data?.length === 0, "the other family's own expense is gone");
  r = await a.rpc('reset_family_data', { p_scope: 'month', p_month: '2026-13' });
  ok(r.error?.message === 'BAD_MONTH', 'reset rejects a bad month', r.error?.message);
  r = await a.rpc('reset_family_data', { p_scope: 'month', p_month: month });
  ok(!r.error, 'owner clears this month', r.error?.message);
  const left = await a.from('expenses').select('spent_on');
  ok(left.data?.length === 1 && left.data[0].spent_on === lastMonth, "this month's expenses gone, last month's kept", JSON.stringify(left.data));
  ok((await a.from('commitment_reserves').select('month').eq('month', month)).data?.length === 0, "this month's set-asides gone");
  const unpaid = await a.from('commitment_payments').select('expense_id').eq('id', cheques.data[0].id).single();
  ok(unpaid.data && unpaid.data.expense_id === null, 'the cheque cashed this month is waiting again', JSON.stringify(unpaid.data));
  ok((await a.from('fixed_expenses').select('id')).data?.length >= 1, 'commitments stay after a month reset');
  r = await a.rpc('reset_family_data', { p_scope: 'all' });
  ok(!r.error, 'owner starts over', r.error?.message);
  const fresh = await Promise.all(['expenses', 'fixed_expenses', 'commitment_payments', 'member_incomes', 'member_budgets', 'items'].map((t) => a.from(t).select('*', { count: 'exact', head: true })));
  ok(fresh.every((x) => x.count === 0), 'starting over clears expenses, commitments, salaries, budgets and items', fresh.map((x) => x.count).join(','));
  ok((await a.from('categories').select('id')).data?.length === 5, 'categories back to the 5 defaults');
  ok((await a.from('profiles').select('id')).data?.length === 2, 'members stay after starting over');
  ok(!(await signIn(A, 'secret123')).error, 'owner still signs in after starting over');
  ok((await other.from('categories').select('id')).data?.length >= 5, "another family's categories untouched");
}

console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
