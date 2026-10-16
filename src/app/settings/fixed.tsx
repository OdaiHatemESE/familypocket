import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { everyLabel, KINDS, kindOf, monthCommitments } from '../../commitments';
import { FixedSheet } from '../../components/FixedSheet';
import { PageHeader } from '../../components/PageHeader';
import { useFamily } from '../../family';
import { C, F, TS } from '../../theme';
import { CommitmentKind, FixedExpense } from '../../types';
import { Avatar, Card, ErrorText, Icon, Money, Row, SectionHead, T } from '../../ui';
import { monthKey, monthLabel, num, parseAmount } from '../../utils';

export default function CommitmentsScreen() {
  const { fixed, payments, reserves, expenses, members, memberOf, incomesFor, saveIncome } = useFamily();
  const [editing, setEditing] = useState<FixedExpense | null>(null);
  const [defaultKind, setDefaultKind] = useState<CommitmentKind | undefined>();
  const [open, setOpen] = useState(false);
  const month = monthKey(new Date());
  const mc = useMemo(() => monthCommitments(month, fixed, payments, reserves, expenses), [month, fixed, payments, reserves, expenses]);
  const incomes = useMemo(() => incomesFor(month), [incomesFor, month]);
  const income = Object.values(incomes).reduce((a, b) => a + b, 0);

  // Salary inputs, saved per member from this month onwards
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const saveSalary = async (uid: string) => {
    const n = parseAmount(draft[uid] ?? '');
    if (!(n >= 0)) return setError('اكتب الراتب بالأرقام');
    setSavingId(uid);
    setError('');
    try {
      await saveIncome(uid, month, n);
      setDraft((d) => {
        const { [uid]: _, ...rest } = d;
        return rest;
      });
    } catch (e) {
      setError((e as Error).message);
    }
    setSavingId(null);
  };

  const groups = KINDS.map((k) => ({ kind: k, list: fixed.filter((f) => f.kind === k.key).sort((a, b) => Number(b.active) - Number(a.active) || a.dueDay - b.dueDay) })).filter((g) => g.list.length);
  const openNew = (k?: CommitmentKind) => (setEditing(null), setDefaultKind(k), setOpen(true));

  const detail = (f: FixedExpense) => {
    if (!f.active) return 'موقّف';
    if (f.everyMonths === 1) return `${f.variable ? 'تقريباً، ' : ''}يستحق يوم ${f.dueDay} كل شهر`;
    const next = payments.filter((p) => p.fixedId === f.id && !p.expenseId).sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))[0];
    const count = payments.filter((p) => p.fixedId === f.id).length;
    return `${everyLabel(f.everyMonths)}${count ? ` · ${count} دفعات` : ''}${next ? ` · الجاية ${Number(next.dueDate.slice(8))}/${Number(next.dueDate.slice(5, 7))}` : ''}`;
  };

  return (
    <View style={{ flex: 1 }}>
      <PageHeader title="الراتب والالتزامات" back />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Summary */}
        <Card style={{ padding: 16, marginTop: 8 }}>
          <T size={TS.small} color={C.sub}>{monthLabel(month)}</T>
          <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
            <T>الدخل</T>
            <Money value={income} />
          </Row>
          <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
            <T>الالتزامات</T>
            <Money value={-mc.total} />
          </Row>
          <View style={{ height: 1, backgroundColor: C.line, marginVertical: 8 }} />
          <Row style={{ justifyContent: 'space-between' }}>
            <T w="bold">المتبقي للمصروف</T>
            <Money value={income - mc.total} w="bold" size={20} color={income - mc.total < 0 ? C.pom : C.text} />
          </Row>
          <T size={TS.tiny} color={C.sub} style={{ marginTop: 8 }}>
            الالتزامات اللي بتندفع كل كم شهر (زي الإيجار والمدارس) بتنحسب هون بحصتها الشهرية، اللي بتجنّبوها كل شهر لحد ما يجي موعد الدفعة.
          </T>
        </Card>

        {/* Salaries */}
        <SectionHead title="الراتب" />
        <Card style={{ paddingVertical: 4 }}>
          {members.map((m, i) => {
            const value = draft[m.id] ?? (incomes[m.id] ? String(incomes[m.id]) : '');
            const dirty = draft[m.id] !== undefined;
            return (
              <Row key={m.id} style={{ paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderColor: C.line, gap: 10 }}>
                <Avatar name={m.displayName} color={m.color} size={32} />
                <T w="medium" style={{ flex: 1 }}>{m.displayName}</T>
                <TextInput
                  value={value}
                  onChangeText={(t) => setDraft((d) => ({ ...d, [m.id]: t }))}
                  placeholder="0"
                  placeholderTextColor={C.faint}
                  keyboardType="decimal-pad"
                  accessibilityLabel={`راتب ${m.displayName}`}
                  style={{ width: 110, fontFamily: F.semibold, fontSize: TS.body, color: C.text, textAlign: 'center', backgroundColor: C.paper, borderRadius: 10, paddingVertical: 8 }}
                />
                <Pressable
                  onPress={() => saveSalary(m.id)}
                  disabled={!dirty || savingId === m.id}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: dirty ? C.ink : C.track, minWidth: 54, alignItems: 'center' }}
                >
                  {savingId === m.id ? <ActivityIndicator color="#fff" size="small" /> : <T size={TS.small} w="semibold" color={dirty ? '#fff' : C.faint}>حفظ</T>}
                </Pressable>
              </Row>
            );
          })}
        </Card>
        <T size={TS.tiny} color={C.sub} style={{ marginTop: 6, paddingHorizontal: 4 }}>الراتب بيضل نفسه كل شهر لحد ما تغيّروه. التغيير بيبلّش من {monthLabel(month)}.</T>
        <ErrorText text={error} />

        {/* Commitments */}
        <SectionHead title="الالتزامات" />
        {groups.length === 0 && (
          <Card style={{ padding: 20, alignItems: 'center' }}>
            <Icon name="calendar-sync-outline" size={36} color={C.faint} />
            <T color={C.sub} align="center" style={{ marginTop: 8 }}>ابدأوا بالإيجار والمدارس والفواتير والتحويلات للأهل.</T>
          </Card>
        )}
        {groups.map((g) => (
          <View key={g.kind.key} style={{ marginBottom: 12 }}>
            <Row style={{ gap: 6, marginBottom: 6, paddingHorizontal: 4 }}>
              <Icon name={g.kind.icon} size={16} color={C.sub} />
              <T size={TS.small} w="semibold" color={C.sub}>{g.kind.label}</T>
            </Row>
            <Card>
              {g.list.map((f, i) => (
                <Pressable
                  key={f.id}
                  onPress={() => (setEditing(f), setOpen(true))}
                  style={({ pressed }) => ({
                    flexDirection: 'row-reverse', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13,
                    borderTopWidth: i ? 1 : 0, borderColor: C.line, backgroundColor: pressed ? C.paper : 'transparent', opacity: f.active ? 1 : 0.5,
                  })}
                >
                  <View style={{ flex: 1 }}>
                    <T w="semibold">{f.name}</T>
                    <T size={TS.small} color={C.sub}>
                      {detail(f)}
                      {members.length > 1 ? ` · ${memberOf(f.ownerId)?.displayName ?? 'غير محدد'}` : ''}
                    </T>
                  </View>
                  <View style={{ alignItems: 'flex-start' }}>
                    <Money value={f.amount} />
                    {f.everyMonths > 1 && <T size={TS.tiny} color={C.sub}>{num(f.amount / f.everyMonths)} بالشهر</T>}
                  </View>
                </Pressable>
              ))}
            </Card>
          </View>
        ))}

        <Pressable
          onPress={() => openNew()}
          style={({ pressed }) => ({
            flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16,
            borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.oasis, backgroundColor: pressed ? C.oasis + '10' : 'transparent',
          })}
        >
          <Icon name="plus" size={20} color={C.oasis} />
          <T w="semibold" color={C.oasis}>التزام جديد</T>
        </Pressable>
        {groups.length === 0 && (
          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {KINDS.filter((k) => k.key !== 'other').map((k) => (
              <Pressable key={k.key} onPress={() => openNew(k.key)} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: C.surface }}>
                <Icon name={kindOf(k.key).icon} size={16} color={C.ink} />
                <T size={TS.small}>{k.label}</T>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
      <FixedSheet visible={open} editing={editing} defaultKind={defaultKind} onClose={() => setOpen(false)} />
    </View>
  );
}
