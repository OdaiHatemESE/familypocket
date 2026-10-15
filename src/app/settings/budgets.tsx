import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { analyzeMonth } from '../../analysis';
import { expenseOwner, resolveBudget } from '../../budgets';
import { PageHeader } from '../../components/PageHeader';
import { useFamily } from '../../family';
import { C, F, TS } from '../../theme';
import { Member } from '../../types';
import { Avatar, Card, CatTile, ErrorText, HScroll, Icon, Money, PrimaryButton, Row, T } from '../../ui';
import { monthKey, monthLabel, monthName, num, parseAmount, shiftMonth } from '../../utils';

const amountText = (n: number | undefined) => (n ? String(Math.round(n * 100) / 100) : '');

export default function BudgetsScreen() {
  const { me, members, budgetRows, categoryBudgetRows } = useFamily();
  const thisMonth = monthKey(new Date());
  const [month, setMonth] = useState(thisMonth);
  const [memberId, setMemberId] = useState<string>(me?.id ?? members[0]?.id ?? '');
  const member = members.find((m) => m.id === memberId) ?? members[0];
  const resolved = member ? resolveBudget(member.id, month, budgetRows, categoryBudgetRows) : null;
  const familyTotal = members.reduce((a, m) => a + resolveBudget(m.id, month, budgetRows, categoryBudgetRows).total, 0);

  return (
    <View style={{ flex: 1 }}>
      <PageHeader title="البادجت الشهري" back>
        {/* Month: budgets can be planned up to 2 months ahead */}
        <Row style={{ justifyContent: 'space-between', marginTop: 10 }}>
          <Row style={{ backgroundColor: C.surface, borderRadius: 999, paddingHorizontal: 4, paddingVertical: 2 }}>
            <Pressable onPress={() => setMonth(shiftMonth(month, -1))} hitSlop={8} style={{ padding: 6 }} accessibilityLabel="الشهر السابق">
              <Icon name="chevron-right" size={18} color={C.sub} />
            </Pressable>
            <T w="medium" size={TS.small} style={{ minWidth: 96 }} align="center">{monthLabel(month)}</T>
            <Pressable
              onPress={() => setMonth(shiftMonth(month, 1))}
              disabled={month >= shiftMonth(thisMonth, 2)}
              hitSlop={8}
              style={{ padding: 6, opacity: month >= shiftMonth(thisMonth, 2) ? 0.25 : 1 }}
              accessibilityLabel="الشهر التالي"
            >
              <Icon name="chevron-left" size={18} color={C.sub} />
            </Pressable>
          </Row>
          {members.length > 1 && (
            <View style={{ alignItems: 'flex-start' }}>
              <T size={TS.tiny} color={C.sub}>بادجت العائلة</T>
              <Money value={familyTotal} w="bold" />
            </View>
          )}
        </Row>
        {members.length > 1 && (
          <HScroll style={{ paddingTop: 12, paddingBottom: 4 }}>
            {members.map((m) => {
              const on = m.id === member?.id;
              const t = resolveBudget(m.id, month, budgetRows, categoryBudgetRows).total;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => setMemberId(m.id)}
                  style={{
                    flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingRight: 4, paddingLeft: 14, paddingVertical: 4,
                    borderRadius: 999, backgroundColor: on ? C.ink : C.surface, borderWidth: 1, borderColor: on ? C.ink : C.line,
                  }}
                >
                  <Avatar name={m.displayName} color={m.color} size={28} />
                  <View>
                    <T size={TS.small} w={on ? 'semibold' : 'regular'} color={on ? '#fff' : C.text}>{m.displayName}</T>
                    <T size={TS.tiny} color={on ? C.inkMuted : C.sub}>{t ? `${num(t)} درهم` : 'بدون بادجت'}</T>
                  </View>
                </Pressable>
              );
            })}
          </HScroll>
        )}
      </PageHeader>

      {member && resolved && (
        <BudgetForm
          key={`${member.id}-${month}-${resolved.sourceMonth ?? 'none'}`}
          member={member}
          month={month}
          initialTotal={resolved.total}
          initialCats={resolved.cats}
          sourceMonth={resolved.sourceMonth}
        />
      )}
    </View>
  );
}

function BudgetForm({
  member,
  month,
  initialTotal,
  initialCats,
  sourceMonth,
}: {
  member: Member;
  month: string;
  initialTotal: number;
  initialCats: Record<string, number>;
  sourceMonth: string | null;
}) {
  const { me, categories, expenses, fixed, members, saveBudget, budgetsFor } = useFamily();
  const insets = useSafeAreaInsets();
  const [total, setTotal] = useState(amountText(initialTotal));
  const [cats, setCats] = useState<Record<string, string>>(() =>
    Object.fromEntries(categories.map((c) => [c.id, amountText(initialCats[c.id])])),
  );
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const totalN = parseAmount(total) || 0;
  const catN = (id: string) => parseAmount(cats[id] ?? '') || 0;
  const allocated = categories.reduce((a, c) => a + catN(c.id), 0);
  const left = totalN - allocated;
  const reserved = fixed.filter((f) => f.active && f.ownerId === member.id).reduce((a, f) => a + f.amount, 0);
  const isMe = member.id === me?.id;

  // What this member has spent this month, per category, for context while planning
  const spentBy = useMemo(() => {
    const a = analyzeMonth(month, categories, expenses, fixed, members, budgetsFor(month), member.id);
    return Object.fromEntries(a.byCategory.map((s) => [s.category.id, s.spent]));
  }, [month, categories, expenses, fixed, members, budgetsFor, member.id]);
  const spentTotal = expenses.filter((e) => e.date.startsWith(month) && expenseOwner(e, fixed) === member.id).reduce((a, e) => a + e.amount, 0);

  const edit = (fn: () => void) => {
    fn();
    setDirty(true);
    setSaved(false);
    setError('');
  };

  const save = async () => {
    if (!(totalN > 0)) return setError('اكتب البادجت الكلي للشهر');
    setBusy(true);
    try {
      await saveBudget(member.id, month, totalN, Object.fromEntries(categories.map((c) => [c.id, catN(c.id)])));
      setDirty(false);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  const inherited = sourceMonth && sourceMonth !== month;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Total */}
        <Card style={{ padding: 16, marginTop: 8 }}>
          <T size={TS.small} color={C.sub}>
            {isMe ? 'بادجتك الكلي' : `بادجت ${member.displayName} الكلي`} لشهر {monthName(month)}
          </T>
          <Row style={{ alignItems: 'baseline', marginTop: 2 }}>
            <TextInput
              value={total}
              onChangeText={(t) => edit(() => setTotal(t))}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={C.faint}
              accessibilityLabel="البادجت الكلي"
              style={{
                flex: 1, minWidth: 0, fontFamily: F.bold, fontSize: 40, letterSpacing: -1, color: C.text, textAlign: 'right',
                paddingVertical: 4, borderBottomWidth: 2, borderColor: C.line,
              }}
            />
            <T w="medium" size={18} color={C.sub} style={{ marginRight: 8 }}>درهم</T>
          </Row>
          <T size={TS.tiny} color={C.faint} style={{ marginTop: 6 }}>
            {inherited
              ? `منقول من ${monthLabel(sourceMonth!)}. الحفظ بيثبّت الأرقام لـ ${monthName(month)} والأشهر اللي بعده.`
              : sourceMonth
                ? `محفوظ لـ ${monthName(month)}، والأشهر الجاية بتورثه لحد ما تغيّره.`
                : 'ما في بادجت محفوظ لهذا الشهر لسه.'}
          </T>

          {totalN > 0 && (
            <>
              <View style={{ flexDirection: 'row-reverse', height: 10, borderRadius: 5, overflow: 'hidden', marginTop: 16, backgroundColor: C.track }}>
                <View style={{ width: `${Math.min(allocated / totalN, 1) * 100}%`, backgroundColor: left < 0 ? C.pom : C.oasis }} />
              </View>
              <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
                <T size={TS.small} color={C.sub}>موزّع {num(allocated)}</T>
                <T size={TS.small} w="semibold" color={left < 0 ? C.pom : left > 0 ? C.saffron : C.oasis}>
                  {left < 0 ? `زيادة ${num(-left)} عن الكلي` : left > 0 ? `غير موزّع ${num(left)}` : 'موزّع بالكامل'}
                </T>
              </Row>
              {reserved > 0 && (
                <T size={TS.tiny} color={C.sub} style={{ marginTop: 6 }}>
                  منه {num(reserved)} مصاريف إجبارية على {isMe ? 'حسابك' : member.displayName}.
                </T>
              )}
              {spentTotal > 0 && (
                <T size={TS.tiny} color={C.sub} style={{ marginTop: 2 }}>
                  {isMe ? 'صرفت' : 'صرف'} لحد هلق {num(spentTotal)} درهم بهذا الشهر.
                </T>
              )}
            </>
          )}
        </Card>

        {/* Categories */}
        <Row style={{ justifyContent: 'space-between', marginTop: 24, marginBottom: 10 }}>
          <T w="bold" size={TS.h2}>التوزيع على التصنيفات</T>
          {totalN > 0 && left > 0 && (
            <Pressable
              onPress={() => {
                // Put the unallocated remainder into categories that have no amount yet, split evenly
                const empty = categories.filter((c) => !catN(c.id));
                if (!empty.length) return;
                const share = Math.floor(left / empty.length);
                edit(() => setCats((p) => ({ ...p, ...Object.fromEntries(empty.map((c) => [c.id, String(share)])) })));
              }}
              hitSlop={8}
            >
              <T size={TS.small} w="medium" color={C.oasis}>وزّع الباقي</T>
            </Pressable>
          )}
        </Row>
        <Card>
          {categories.map((c, i) => {
            const spent = spentBy[c.id] ?? 0;
            const amt = catN(c.id);
            const over = amt > 0 && spent > amt;
            return (
              <Row key={c.id} style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 12, borderTopWidth: i ? 1 : 0, borderColor: C.line }}>
                <CatTile icon={c.icon} color={c.color} size={38} />
                <View style={{ flex: 1 }}>
                  <T w="medium">{c.name}</T>
                  <T size={TS.tiny} color={over ? C.pom : C.sub}>
                    {spent ? `مصروف ${num(spent)}` : 'ما في صرف لسه'}
                    {totalN > 0 && amt > 0 ? `، ${Math.round((amt / totalN) * 100)}% من الكلي` : ''}
                  </T>
                </View>
                <TextInput
                  value={cats[c.id] ?? ''}
                  onChangeText={(t) => edit(() => setCats((p) => ({ ...p, [c.id]: t })))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={C.faint}
                  accessibilityLabel={`حصة ${c.name}`}
                  style={{
                    width: 96, fontFamily: F.semibold, fontSize: TS.body, color: C.text, textAlign: 'center',
                    backgroundColor: C.paper, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 8,
                  }}
                />
              </Row>
            );
          })}
        </Card>
        <T size={TS.tiny} color={C.faint} style={{ marginTop: 8 }}>
          التصنيف اللي بدون حصة بيضل يتصرف منه من الجزء غير الموزّع. لإضافة أو تعديل التصنيفات نفسها: الإعدادات ← التصنيفات.
        </T>
      </ScrollView>

      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: C.paper, borderTopWidth: 1, borderColor: C.line }}>
        <ErrorText text={error} />
        {saved && !dirty && (
          <Row style={{ gap: 6, justifyContent: 'center', marginBottom: 8 }}>
            <Icon name="check-circle" size={16} color={C.oasis} />
            <T size={TS.small} color={C.oasis}>انحفظ بادجت {monthName(month)}</T>
          </Row>
        )}
        <View style={{ marginTop: error ? 10 : 0 }}>
          <PrimaryButton
            label={`احفظ بادجت ${monthName(month)}${isMe ? '' : ` لـ ${member.displayName}`}`}
            onPress={save}
            busy={busy}
            disabled={!dirty && !inherited && !!sourceMonth}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
