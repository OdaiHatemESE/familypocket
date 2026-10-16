import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { CommitmentState, DuePayment, everyLabel, kindOf, METHOD_LABEL, MonthCommitments } from '../commitments';
import { useFamily } from '../family';
import { C, TS } from '../theme';
import { FixedExpense } from '../types';
import { Bar, Card, ErrorText, Field, Icon, Money, PrimaryButton, Row, T } from '../ui';
import { num, parseAmount, todayKey } from '../utils';
import { Sheet } from './Sheet';

const dayMonth = (k: string) => `${Number(k.slice(8))}/${Number(k.slice(5, 7))}`;

/**
 * The month's money story: income, what the commitments take, and what is left for day-to-day spending.
 * Below it, each commitment with its action: pay a bill, set money aside, mark a cheque as cashed.
 */
export function CommitmentsCard({ month, mc, income, spent }: { month: string; mc: MonthCommitments; income: number; spent: number }) {
  const { markFixedPaid, setReserve, payScheduled } = useFamily();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState<FixedExpense | null>(null); // variable bill waiting for its real amount
  const isCurrent = month === todayKey().slice(0, 7);
  const left = income - mc.total;
  const leftAfter = left - spent;

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError('');
    try {
      await fn();
    } catch (e) {
      const msg = (e as Error).message;
      setError(/duplicate|23505|مكرر/i.test(msg) ? 'هالالتزام مسجّل كمدفوع هالشهر من قبل.' : msg);
    }
    setBusy(null);
  };
  // Paid today in the current month; otherwise on its due date in the month being viewed
  const payDate = (due: string) => (isCurrent ? todayKey() : due);

  const action = (c: CommitmentState) => {
    if (c.mode === 'monthly') {
      if (c.done) return <Icon name="check-circle" size={26} color={C.oasis} />;
      return (
        <Pill
          label="دفعت"
          tone={c.overdue ? 'danger' : 'ink'}
          busy={busy === c.fixed.id}
          onPress={() => (c.fixed.variable ? setPaying(c.fixed) : run(c.fixed.id, () => markFixedPaid(c.fixed, payDate(c.dueDate!))))}
        />
      );
    }
    if (c.done) {
      return (
        <Pressable onPress={() => run(c.fixed.id, () => setReserve(c.fixed.id, month, null))} hitSlop={8} accessibilityLabel="ألغِ التجنيب">
          {busy === c.fixed.id ? <ActivityIndicator color={C.oasis} /> : <Icon name="check-circle" size={26} color={C.oasis} />}
        </Pressable>
      );
    }
    return <Pill label="جنّبت" tone="oasis" busy={busy === c.fixed.id} onPress={() => run(c.fixed.id, () => setReserve(c.fixed.id, month, c.share))} />;
  };

  const subtitle = (c: CommitmentState) => {
    if (c.mode === 'monthly') {
      const est = c.fixed.variable && !c.done ? ' تقريباً' : '';
      return c.done
        ? `${num(c.amount)} درهم، مدفوع`
        : `${num(c.amount)} درهم${est}، ${c.overdue ? `فات موعده يوم ${Number(c.dueDate!.slice(8))}` : `يستحق يوم ${Number(c.dueDate!.slice(8))}`}`;
    }
    const next = c.nextPayment ? `، الدفعة الجاية ${dayMonth(c.nextPayment.dueDate)}` : '';
    return `${c.done ? 'جنّبتوا' : 'جنّبوا'} ${num(c.amount)} هالشهر · بالحصّالة ${num(c.fund)}${next}`;
  };

  return (
    <>
      {/* Income − commitments = left for spending */}
      <Card style={{ padding: 16 }}>
        {income > 0 ? (
          <>
            <Line label="الدخل" value={income} />
            <Line label="الالتزامات" value={-mc.total} note={mc.items.length ? `تم ${mc.doneCount} من ${mc.items.length}` : undefined} />
            {mc.transfers > 0 && <T size={TS.tiny} color={C.faint} style={{ marginTop: -2, marginBottom: 4 }}>منها {num(mc.transfers)} تحويلات وادخار</T>}
            <View style={{ height: 1, backgroundColor: C.line, marginVertical: 8 }} />
            <Line label="المتبقي للمصروف" value={left} strong color={left < 0 ? C.pom : C.text} />
            {left > 0 && (
              <View style={{ marginTop: 10 }}>
                <Bar pct={spent / left} color={leftAfter < 0 ? C.pom : spent / left > 0.85 ? C.saffron : C.oasis} />
                <T size={TS.tiny} color={leftAfter < 0 ? C.pom : C.sub} style={{ marginTop: 6 }}>
                  {leftAfter < 0 ? `صرفتوا ${num(spent)}، أي ${num(-leftAfter)} فوق المتبقي` : `صرفتوا منه ${num(spent)}، وباقي ${num(leftAfter)}`}
                </T>
              </View>
            )}
          </>
        ) : (
          <Pressable onPress={() => router.push('/settings/fixed')} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
            <Icon name="cash-plus" size={24} color={C.oasis} />
            <View style={{ flex: 1 }}>
              <T w="semibold">حطّوا الراتب</T>
              <T size={TS.small} color={C.sub}>
                {mc.items.length ? `الالتزامات هالشهر ${num(mc.total)} درهم. مع الراتب بنحسبلكم قديش بيضل للمصروف.` : 'بنحسب منه الالتزامات وقديش بيضل للمصروف.'}
              </T>
            </View>
            <Icon name="chevron-left" size={20} color={C.faint} />
          </Pressable>
        )}
      </Card>

      {/* Cheques and instalments falling due this month */}
      {mc.dueThisMonth.length > 0 && (
        <Card style={{ marginTop: 10 }}>
          {mc.dueThisMonth.map((d, i) => (
            <DueRow key={d.payment.id} d={d} first={i === 0} busy={busy === d.payment.id} onPay={() => run(d.payment.id, () => payScheduled(d.payment, payDate(d.payment.dueDate)))} />
          ))}
        </Card>
      )}

      <Card style={{ marginTop: 10 }}>
        {mc.items.length === 0 ? (
          <Pressable onPress={() => router.push('/settings/fixed')} style={{ padding: 18, alignItems: 'center' }}>
            <Icon name="calendar-sync-outline" size={32} color={C.faint} />
            <T color={C.sub} align="center" style={{ marginTop: 6 }}>أضيفوا الإيجار والمدارس والفواتير والتحويلات.</T>
          </Pressable>
        ) : (
          <>
            <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
              <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                <T size={TS.small} color={C.sub}>تم {mc.doneCount} من {mc.items.length}</T>
                {mc.pendingAmount > 0 ? <T size={TS.small} color={C.sub}>باقي {num(mc.pendingAmount)} درهم</T> : <T size={TS.small} w="semibold" color={C.oasis}>كلها تمام</T>}
              </Row>
              <Bar pct={mc.items.length ? mc.doneCount / mc.items.length : 0} color={C.oasis} />
            </View>
            {mc.items.map((c, i) => {
              const k = kindOf(c.fixed.kind);
              return (
                <Row key={c.fixed.id} style={{ paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: C.line, gap: 12 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: (c.done ? C.oasis : C.ink) + '14', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={k.icon} size={20} color={c.done ? C.oasis : C.ink} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Row style={{ gap: 6 }}>
                      <T w="medium" color={c.done ? C.sub : C.text} numberOfLines={1} style={{ flexShrink: 1 }}>{c.fixed.name}</T>
                      {c.mode === 'reserve' && <T size={TS.tiny} color={C.faint}>{everyLabel(c.fixed.everyMonths)}</T>}
                    </Row>
                    <T size={TS.small} color={c.overdue ? C.pom : C.sub}>{subtitle(c)}</T>
                  </View>
                  {action(c)}
                </Row>
              );
            })}
          </>
        )}
      </Card>
      <ErrorText text={error} />

      {paying && (
        <PayAmountSheet
          fixed={paying}
          onClose={() => setPaying(null)}
          onPay={async (amount) => {
            const c = mc.items.find((x) => x.fixed.id === paying.id);
            await markFixedPaid(paying, payDate(c?.dueDate ?? todayKey()), amount);
          }}
        />
      )}
    </>
  );
}

function Line({ label, value, note, strong, color = C.text }: { label: string; value: number; note?: string; strong?: boolean; color?: string }) {
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 3 }}>
      <Row style={{ gap: 8 }}>
        <T w={strong ? 'bold' : 'medium'} size={strong ? TS.h2 : TS.body}>{label}</T>
        {!!note && <T size={TS.tiny} color={C.sub}>{note}</T>}
      </Row>
      <Money value={value} size={strong ? 22 : TS.body} w={strong ? 'bold' : 'semibold'} color={color} />
    </Row>
  );
}

function Pill({ label, onPress, busy, tone }: { label: string; onPress: () => void; busy: boolean; tone: 'ink' | 'oasis' | 'danger' }) {
  const bg = tone === 'danger' ? C.pom : tone === 'oasis' ? C.oasis : C.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: bg, opacity: pressed ? 0.8 : 1, minWidth: 64, alignItems: 'center' })}
    >
      {busy ? <ActivityIndicator color="#fff" size="small" /> : <T w="semibold" size={TS.small} color="#fff" align="center">{label}</T>}
    </Pressable>
  );
}

function DueRow({ d, first, busy, onPay }: { d: DuePayment; first: boolean; busy: boolean; onPay: () => void }) {
  const { fixed } = useFamily();
  const f = fixed.find((x) => x.id === d.payment.fixedId);
  const cheque = d.payment.method === 'cheque';
  return (
    <Row style={{ paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: first ? 0 : 1, borderColor: C.line, gap: 12 }}>
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: (d.paid ? C.oasis : d.overdue ? C.pom : C.saffron) + '18', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={cheque ? 'checkbook' : 'calendar-clock-outline'} size={20} color={d.paid ? C.oasis : d.overdue ? C.pom : C.saffron} />
      </View>
      <View style={{ flex: 1 }}>
        <T w="medium">{f?.name ?? 'التزام'} · {cheque ? 'شيك' : METHOD_LABEL[d.payment.method]} {d.index} من {d.count}</T>
        <T size={TS.small} color={d.overdue ? C.pom : C.sub}>
          {num(d.payment.amount)} درهم · {d.paid ? (cheque ? 'انصرف' : 'مدفوع') : `${d.overdue ? 'كان مستحق' : 'يستحق'} ${dayMonth(d.payment.dueDate)}`}
          {d.payment.reference ? ` · ${d.payment.reference}` : ''}
        </T>
      </View>
      {d.paid ? <Icon name="check-circle" size={26} color={C.oasis} /> : <Pill label={cheque ? 'انصرف' : 'دفعت'} tone={d.overdue ? 'danger' : 'ink'} busy={busy} onPress={onPay} />}
    </Row>
  );
}

/** For bills whose amount changes: ask for the real amount before recording the payment */
function PayAmountSheet({ fixed, onClose, onPay }: { fixed: FixedExpense; onClose: () => void; onPay: (amount: number) => Promise<void> }) {
  const [amount, setAmount] = useState(String(fixed.amount));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    const n = parseAmount(amount);
    if (!(n > 0)) return setError('اكتب المبلغ اللي دفعته');
    setBusy(true);
    try {
      await onPay(n);
      onClose();
    } catch (e) {
      const msg = (e as Error).message;
      setError(/duplicate|23505|مكرر/i.test(msg) ? 'هالالتزام مسجّل كمدفوع هالشهر من قبل.' : msg);
      setBusy(false);
    }
  };
  return (
    <Sheet
      visible
      onClose={onClose}
      title={`دفع ${fixed.name}`}
      footer={
        <View>
          <ErrorText text={error} />
          <View style={{ height: 10 }} />
          <PrimaryButton label="سجّل الدفع" onPress={save} busy={busy} />
        </View>
      }
    >
      <Field label="المبلغ اللي دفعته هالشهر (درهم)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" autoFocus hint={`التقدير الشهري ${num(fixed.amount)} درهم`} />
      <View style={{ height: 8 }} />
    </Sheet>
  );
}
