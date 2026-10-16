import React, { useState } from 'react';
import { Pressable, Switch, TextInput, View } from 'react-native';
import { buildSchedule, EVERY, KINDS, METHOD_LABEL } from '../commitments';
import { useFamily } from '../family';
import { C, F, TS } from '../theme';
import { CommitmentKind, CommitmentPayment, FixedExpense } from '../types';
import { Avatar, CatTile, ErrorText, Field, Icon, PrimaryButton, Row, T } from '../ui';
import { num, parseAmount, toKey } from '../utils';
import { Sheet } from './Sheet';

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const METHODS: CommitmentPayment['method'][] = ['cheque', 'transfer', 'card', 'cash'];

const PLACEHOLDER: Record<CommitmentKind, string> = {
  rent: 'مثلاً: إيجار الشقة',
  school: 'مثلاً: أقساط المدرسة',
  bill: 'مثلاً: كهرباء وماء، نت، تلفون',
  transfer: 'مثلاً: تحويل للأهل بالأردن',
  saving: 'مثلاً: ادخار بالأردن',
  installment: 'مثلاً: قسط السيارة',
  other: 'اسم الالتزام',
};

/** Accepts 2026-12-01, 1/12/2026 or 1-12-2026; returns YYYY-MM-DD or null */
export function parseDate(t: string): string | null {
  const s = t.trim().replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  let y: number, m: number, d: number;
  let r = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (r) [y, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else if ((r = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) [d, m, y] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else return null;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getMonth() !== m - 1) return null;
  return toKey(dt);
}
const showDate = (k: string) => `${Number(k.slice(8))}/${Number(k.slice(5, 7))}/${k.slice(0, 4)}`;

type Row_ = { key: string; dueDate: string; amount: string; method: CommitmentPayment['method']; reference: string; paid: boolean };

type Props = { visible: boolean; onClose: () => void; editing: FixedExpense | null; defaultKind?: CommitmentKind };

export function FixedSheet(props: Props) {
  if (!props.visible) return null;
  return <FixedForm key={props.editing?.id ?? 'new'} {...props} />;
}

function FixedForm({ visible, onClose, editing, defaultKind }: Props) {
  const { categories, members, me, payments, saveFixed, deleteFixed, saveSchedule } = useFamily();
  const [kind, setKind] = useState<CommitmentKind>(editing?.kind ?? defaultKind ?? 'bill');
  const [name, setName] = useState(editing?.name ?? '');
  const [every, setEvery] = useState(editing?.everyMonths ?? (defaultKind === 'rent' ? 2 : defaultKind === 'school' ? 3 : 1));
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '');
  const [variable, setVariable] = useState(editing?.variable ?? false);
  const [catId, setCatId] = useState(editing?.categoryId ?? '');
  const [day, setDay] = useState(editing?.dueDay ?? 1);
  const [active, setActive] = useState(editing?.active ?? true);
  const [ownerId, setOwnerId] = useState<string | null>(editing?.ownerId ?? me?.id ?? null);
  const [rows, setRows] = useState<Row_[]>(() =>
    payments
      .filter((p) => editing && p.fixedId === editing.id)
      .map((p) => ({ key: p.id, dueDate: p.dueDate, amount: String(p.amount), method: p.method, reference: p.reference, paid: !!p.expenseId })),
  );
  // schedule generator
  const [first, setFirst] = useState('');
  const [count, setCount] = useState(String(Math.round(12 / (editing?.everyMonths ?? 2)) || 1));
  const [method, setMethod] = useState<CommitmentPayment['method']>(kind === 'rent' ? 'cheque' : 'transfer');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const monthly = every === 1;
  const perPayment = parseAmount(amount) || 0;
  const unpaid = rows.filter((r) => !r.paid);

  const generate = () => {
    const start = parseDate(first);
    const n = Math.round(parseAmount(count) || 0);
    if (!start) return setError('اكتب تاريخ أول دفعة، مثلاً 1/12/2026');
    if (!(n >= 1 && n <= 24)) return setError('عدد الدفعات من 1 لـ 24');
    if (!(perPayment > 0)) return setError('اكتب مبلغ كل دفعة أولاً');
    setError('');
    const made = buildSchedule(start, every, n, perPayment).map((p, i) => ({
      key: `new-${Date.now()}-${i}`, dueDate: p.dueDate, amount: String(p.amount), method, reference: '', paid: false,
    }));
    setRows((rs) => [...rs.filter((r) => r.paid), ...made]);
  };

  const save = async () => {
    const n = parseAmount(amount);
    if (!name.trim()) return setError('اكتب اسم الالتزام');
    if (!(n > 0)) return setError(monthly ? 'اكتب المبلغ الشهري' : 'اكتب مبلغ كل دفعة');
    if (!catId) return setError('اختر التصنيف اللي بينحسب عليه');
    const schedule: { dueDate: string; amount: number; method: CommitmentPayment['method']; reference: string }[] = [];
    if (!monthly) {
      for (const r of unpaid) {
        const a = parseAmount(r.amount);
        if (!(a > 0)) return setError(`اكتب مبلغ دفعة ${showDate(r.dueDate)}`);
        schedule.push({ dueDate: r.dueDate, amount: a, method: r.method, reference: r.reference.trim() });
      }
    }
    setBusy(true);
    try {
      const id = await saveFixed({
        id: editing?.id, name: name.trim(), amount: n, categoryId: catId, dueDay: day, active, ownerId,
        kind, everyMonths: every, variable: monthly && variable,
      });
      // Switching a commitment to monthly drops its unpaid schedule
      if (!monthly || (editing && editing.everyMonths > 1)) await saveSchedule(id, monthly ? [] : schedule);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    if (!confirmDelete) return setConfirmDelete(true);
    setBusy(true);
    try {
      await deleteFixed(editing.id);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const label = (t: string, mt = 16) => <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: mt, marginBottom: 8 }}>{t}</T>;
  const chip = (on: boolean, text: string, onPress: () => void, color = C.ink) => (
    <Pressable
      key={text}
      onPress={onPress}
      style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: on ? color : C.paper, borderWidth: 1, borderColor: on ? color : C.line }}
    >
      <T size={TS.small} w={on ? 'semibold' : 'regular'} color={on ? '#fff' : C.text}>{text}</T>
    </Pressable>
  );

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={editing ? 'تعديل التزام' : 'التزام جديد'}
      footer={
        <View>
          <ErrorText text={error} />
          <View style={{ height: 10 }} />
          <PrimaryButton label={editing ? 'حفظ التعديل' : 'أضف الالتزام'} onPress={save} busy={busy} />
          {editing && (
            <Pressable onPress={remove} disabled={busy} style={{ paddingVertical: 12 }}>
              <T size={TS.small} w="medium" color={C.pom} align="center">
                {confirmDelete ? 'اضغط مرة ثانية لتأكيد الحذف. المدفوعات السابقة بتضل بالسجل' : 'حذف الالتزام'}
              </T>
            </Pressable>
          )}
        </View>
      }
    >
      {label('النوع', 4)}
      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }}>
        {KINDS.map((k) => {
          const on = k.key === kind;
          return (
            <Pressable
              key={k.key}
              onPress={() => {
                setKind(k.key);
                if (!editing) {
                  setEvery(k.key === 'rent' ? 2 : k.key === 'school' ? 3 : 1);
                  setMethod(k.key === 'rent' ? 'cheque' : 'transfer');
                }
              }}
              style={{
                flexDirection: 'row-reverse', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999,
                backgroundColor: on ? C.ink : C.paper, borderWidth: 1, borderColor: on ? C.ink : C.line,
              }}
            >
              <Icon name={k.icon} size={16} color={on ? '#fff' : C.sub} />
              <T size={TS.small} w={on ? 'semibold' : 'regular'} color={on ? '#fff' : C.text}>{k.label}</T>
            </Pressable>
          );
        })}
      </View>

      <Field label="الاسم" value={name} onChangeText={setName} placeholder={PLACEHOLDER[kind]} />

      {label('بيندفع')}
      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }}>
        {EVERY.map((e) => chip(e.months === every, e.label, () => setEvery(e.months)))}
      </View>

      <Field
        label={monthly ? (variable ? 'المبلغ التقديري بالشهر (درهم)' : 'المبلغ الشهري (درهم)') : 'مبلغ كل دفعة (درهم)'}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0"
        hint={!monthly && perPayment > 0 ? `بتجنّبوا كل شهر ${num(perPayment / every)} درهم، وبتدفعوا ${num(perPayment)} ${every === 12 ? 'كل سنة' : `كل ${every === 2 ? 'شهرين' : `${every} أشهر`}`}.` : undefined}
      />

      {monthly ? (
        <>
          <Row style={{ justifyContent: 'space-between', marginTop: 14, backgroundColor: C.paper, borderRadius: 14, padding: 12 }}>
            <View style={{ flex: 1 }}>
              <T w="medium">المبلغ بيتغير كل شهر</T>
              <T size={TS.tiny} color={C.sub}>زي الكهرباء والمي. بتكتب المبلغ الحقيقي لما تدفع.</T>
            </View>
            <Switch value={variable} onValueChange={setVariable} trackColor={{ true: C.oasis, false: C.line }} thumbColor="#fff" />
          </Row>
          {label('يستحق كل شهر يوم')}
          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', marginHorizontal: -3 }}>
            {DAYS.map((d) => {
              const on = d === day;
              return (
                <View key={d} style={{ width: `${100 / 7}%`, padding: 3 }}>
                  <Pressable onPress={() => setDay(d)} style={{ height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.ink : C.paper }}>
                    <T w={on ? 'bold' : 'regular'} color={on ? '#fff' : C.text} align="center">{String(d)}</T>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </>
      ) : (
        <View style={{ marginTop: 16, backgroundColor: C.paper, borderRadius: 16, padding: 14 }}>
          <T w="semibold">{kind === 'rent' ? 'الشيكات' : 'الدفعات'}</T>
          <T size={TS.tiny} color={C.sub} style={{ marginTop: 2 }}>
            اكتب تاريخ أول دفعة وعددها، وبنرتّب الباقي {every === 12 ? 'كل سنة' : `كل ${every === 2 ? 'شهرين' : `${every} أشهر`}`}. بعدها بتقدر تعدّل مبلغ أي دفعة وتكتب رقم الشيك.
          </T>
          <Row style={{ gap: 8, marginTop: 10 }}>
            <View style={{ flex: 2 }}>
              <T size={TS.tiny} color={C.sub} style={{ marginBottom: 4 }}>تاريخ أول دفعة</T>
              <TextInput value={first} onChangeText={setFirst} placeholder="1/12/2026" placeholderTextColor={C.faint} style={inputStyle} />
            </View>
            <View style={{ flex: 1 }}>
              <T size={TS.tiny} color={C.sub} style={{ marginBottom: 4 }}>العدد</T>
              <TextInput value={count} onChangeText={setCount} keyboardType="number-pad" style={inputStyle} />
            </View>
          </Row>
          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {METHODS.map((m) => chip(m === method, METHOD_LABEL[m], () => setMethod(m), C.oasis))}
          </View>
          <Pressable onPress={generate} style={({ pressed }) => ({ marginTop: 10, paddingVertical: 11, borderRadius: 12, backgroundColor: pressed ? C.inkSoft : C.ink })}>
            <T w="semibold" color="#fff" align="center">{rows.length ? 'رتّب الدفعات من جديد' : 'رتّب الدفعات'}</T>
          </Pressable>

          {rows.map((r, i) => (
            <View key={r.key} style={{ marginTop: i ? 8 : 12, backgroundColor: C.surface, borderRadius: 12, padding: 10, opacity: r.paid ? 0.6 : 1 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T w="semibold" size={TS.small}>
                  {kind === 'rent' && r.method === 'cheque' ? `شيك ${i + 1}` : `دفعة ${i + 1}`} · {showDate(r.dueDate)}
                </T>
                {r.paid ? (
                  <Row style={{ gap: 4 }}>
                    <Icon name="check-circle" size={16} color={C.oasis} />
                    <T size={TS.tiny} color={C.oasis}>{r.method === 'cheque' ? 'انصرف' : 'مدفوع'}</T>
                  </Row>
                ) : (
                  <Pressable onPress={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} hitSlop={8} accessibilityLabel="احذف الدفعة">
                    <Icon name="close" size={18} color={C.faint} />
                  </Pressable>
                )}
              </Row>
              {!r.paid && (
                <Row style={{ gap: 8, marginTop: 6 }}>
                  <TextInput
                    value={r.amount}
                    onChangeText={(t) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, amount: t } : x)))}
                    keyboardType="decimal-pad"
                    accessibilityLabel="المبلغ"
                    style={[inputStyle, { flex: 1 }]}
                  />
                  <TextInput
                    value={r.reference}
                    onChangeText={(t) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, reference: t } : x)))}
                    placeholder={r.method === 'cheque' ? 'رقم الشيك' : 'ملاحظة'}
                    placeholderTextColor={C.faint}
                    style={[inputStyle, { flex: 1.3 }]}
                  />
                </Row>
              )}
            </View>
          ))}
        </View>
      )}

      {members.length > 1 && (
        <>
          {label('المسؤول عنه')}
          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }}>
            {members.map((m) => {
              const on = m.id === ownerId;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => setOwnerId(m.id)}
                  style={{
                    flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingVertical: 5, paddingLeft: 14, paddingRight: 5,
                    borderRadius: 999, borderWidth: 1.5, borderColor: on ? m.color : C.line, backgroundColor: on ? m.color + '12' : C.surface,
                  }}
                >
                  <Avatar name={m.displayName} color={m.color} size={26} />
                  <T size={TS.small} w={on ? 'semibold' : 'regular'}>{m.displayName}</T>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {label('بينحسب على تصنيف')}
      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }}>
        {categories.map((c) => {
          const on = c.id === catId;
          return (
            <Pressable
              key={c.id}
              onPress={() => setCatId(c.id)}
              style={{
                flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingVertical: 6, paddingLeft: 12, paddingRight: 6,
                borderRadius: 999, borderWidth: 1.5, borderColor: on ? c.color : C.line, backgroundColor: on ? c.color + '12' : C.surface,
              }}
            >
              <CatTile icon={c.icon} color={c.color} size={26} />
              <T size={TS.small} w={on ? 'semibold' : 'regular'}>{c.name}</T>
            </Pressable>
          );
        })}
      </View>

      <Row style={{ justifyContent: 'space-between', marginTop: 18, marginBottom: 8, backgroundColor: C.paper, borderRadius: 14, padding: 12 }}>
        <View style={{ flex: 1 }}>
          <T w="medium">فعّال</T>
          <T size={TS.tiny} color={C.sub}>وقّفه إذا ما عليكم هالالتزام هالفترة.</T>
        </View>
        <Switch value={active} onValueChange={setActive} trackColor={{ true: C.oasis, false: C.line }} thumbColor="#fff" />
      </Row>
    </Sheet>
  );
}

const inputStyle = {
  fontFamily: F.regular,
  fontSize: TS.body,
  color: C.text,
  textAlign: 'right' as const,
  backgroundColor: C.surface,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: C.line,
  paddingHorizontal: 10,
  paddingVertical: 9,
  minWidth: 0,
};
