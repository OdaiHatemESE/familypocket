import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { analyzeMonth, Insight } from '../analysis';
import { ExpenseRow } from '../components/ExpenseRow';
import { Hero } from '../components/Hero';
import { useFamily } from '../family';
import { useTabs } from '../tabsContext';
import { C, TS } from '../theme';
import { Avatar, Bar, Card, CatTile, Icon, IconName, Money, PrimaryButton, Row, SectionHead, T } from '../ui';
import { num, shiftMonth, todayKey } from '../utils';
import { expenseOwner } from '../budgets';

export const toneStyle: Record<Insight['tone'], { color: string; icon: IconName }> = {
  bad: { color: C.pom, icon: 'arrow-up-bold-circle-outline' },
  warn: { color: C.saffron, icon: 'alert-circle-outline' },
  good: { color: C.oasis, icon: 'check-circle-outline' },
  info: { color: C.sub, icon: 'information-outline' },
};

export function InsightList({ items }: { items: Insight[] }) {
  return (
    <Card style={{ paddingVertical: 6 }}>
      {items.map((ins, i) => (
        <View key={i} style={{ flexDirection: 'row-reverse', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: C.line }}>
          <View style={{ marginTop: 2, marginLeft: 12 }}>
            <Icon name={toneStyle[ins.tone].icon} size={20} color={toneStyle[ins.tone].color} />
          </View>
          <T style={{ flex: 1 }}>{ins.text}</T>
        </View>
      ))}
    </Card>
  );
}

export function Home() {
  const { categories, expenses, fixed, members, memberOf, markFixedPaid, refresh, budgetsFor } = useFamily();
  const { month, setMonth, openAdd, openExpense, scope } = useTabs();
  const [paying, setPaying] = useState<string | null>(null);
  const [payError, setPayError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const budgets = useMemo(() => budgetsFor(month), [budgetsFor, month]);
  const a = useMemo(
    () => analyzeMonth(month, categories, expenses, fixed, members, budgets, scope),
    [month, categories, expenses, fixed, members, budgets, scope],
  );
  const recent = useMemo(
    () => expenses.filter((e) => e.date.startsWith(month) && (!scope || expenseOwner(e, fixed) === scope)).sort((x, y) => (x.date === y.date ? y.createdAt - x.createdAt : x.date < y.date ? 1 : -1)).slice(0, 5),
    [expenses, month, scope, fixed],
  );
  const catOf = (id: string) => categories.find((c) => c.id === id);
  const family = members.length > 1;
  const paidCount = a.fixedStatus.filter((s) => s.paid).length;

  const pay = async (fixedId: string) => {
    const f = fixed.find((x) => x.id === fixedId);
    if (!f) return;
    setPaying(fixedId);
    setPayError('');
    try {
      // Paid today if this is the current month, otherwise on its due date in the viewed month
      const s = a.fixedStatus.find((x) => x.fixed.id === fixedId)!;
      await markFixedPaid(f, a.isCurrent ? todayKey() : s.dueDate);
    } catch (e) {
      setPayError((e as Error).message);
    }
    setPaying(null);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh().catch(() => {});
    setRefreshing(false);
  };

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 140 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.inkMuted} />}
    >
      <Hero a={a} onPrev={() => setMonth(shiftMonth(month, -1))} onNext={() => setMonth(shiftMonth(month, 1))} />

      <View style={{ paddingHorizontal: 16 }}>
        {expenses.length === 0 && fixed.length === 0 ? (
          <Card style={{ padding: 24, marginTop: 20, alignItems: 'center' }}>
            <CatTile icon="wallet-outline" color={C.oasis} size={56} />
            <T w="bold" size={TS.h2} align="center" style={{ marginTop: 14 }}>أهلاً فيكم</T>
            <T color={C.sub} align="center" style={{ marginTop: 6, marginBottom: 18 }}>
              ابدأوا بتحديد البادجت والمصاريف الإجبارية، أو سجّلوا أول مصروف مباشرة.
            </T>
            <View style={{ alignSelf: 'stretch', gap: 10 }}>
              <PrimaryButton label="سجّل مصروف" onPress={openAdd} />
              <Pressable onPress={() => router.push('/settings/budgets')} style={{ paddingVertical: 10 }}>
                <T w="medium" color={C.oasis} align="center">حدّد البادجت</T>
              </Pressable>
            </View>
          </Card>
        ) : (
          <>
            {a.insights.length > 0 && (
              <>
                <SectionHead title="تحليل اليوم" action="التحليل الكامل" onAction={() => router.push('/analysis')} />
                <InsightList items={a.insights.slice(0, 3)} />
              </>
            )}

            {a.fixedStatus.length > 0 && (
              <>
                <SectionHead title="المصاريف الإجبارية" action="إدارة" onAction={() => router.push('/settings/fixed')} />
                <Card>
                  <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
                    <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                      <T size={TS.small} color={C.sub}>انتدفع {paidCount} من {a.fixedStatus.length}</T>
                      {a.pendingFixed > 0 ? (
                        <T size={TS.small} color={C.sub}>باقي {num(a.pendingFixed)} درهم</T>
                      ) : (
                        <T size={TS.small} w="semibold" color={C.oasis}>كلها مدفوعة</T>
                      )}
                    </Row>
                    <Bar pct={a.fixedStatus.length ? paidCount / a.fixedStatus.length : 0} color={C.oasis} />
                  </View>
                  {a.fixedStatus.map((s, i) => {
                    const cat = catOf(s.fixed.categoryId);
                    const busy = paying === s.fixed.id;
                    return (
                      <Row key={s.fixed.id} style={{ paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: C.line }}>
                        <CatTile icon={cat?.icon ?? 'calendar'} color={cat?.color ?? C.faint} size={38} />
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <T w="medium" color={s.paid ? C.sub : C.text}>{s.fixed.name}</T>
                          <T size={TS.small} color={s.overdue ? C.pom : C.sub}>
                            {num(s.fixed.amount)} درهم، {s.paid ? 'مدفوع' : s.overdue ? `فات موعده يوم ${Number(s.dueDate.slice(8))}` : `يستحق يوم ${Number(s.dueDate.slice(8))}`}
                          </T>
                        </View>
                        {s.paid ? (
                          <Icon name="check-circle" size={26} color={C.oasis} />
                        ) : (
                          <Pressable
                            onPress={() => pay(s.fixed.id)}
                            disabled={!!paying}
                            accessibilityLabel={`سجّل ${s.fixed.name} كمدفوع`}
                            style={({ pressed }) => ({
                              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
                              backgroundColor: s.overdue ? C.pom : C.ink, opacity: pressed ? 0.8 : 1, minWidth: 64, alignItems: 'center',
                            })}
                          >
                            {busy ? <ActivityIndicator color="#fff" size="small" /> : <T w="semibold" size={TS.small} color="#fff" align="center">دفعت</T>}
                          </Pressable>
                        )}
                      </Row>
                    );
                  })}
                </Card>
                {!!payError && <T size={TS.small} color={C.pom} style={{ marginTop: 8 }}>{payError}</T>}
              </>
            )}

            {family && !scope && (a.totalSpent > 0 || a.hasBudget) && (
              <>
                <SectionHead title="بادجت كل فرد" action="تعديل" onAction={() => router.push('/settings/budgets')} />
                <Card style={{ padding: 16, gap: 16 }}>
                  {a.byMember.map((s) => {
                    const pct = s.budget > 0 ? s.spent / s.budget : 0;
                    const over = s.budget > 0 && s.spent > s.budget;
                    return (
                      <Row key={s.userId ?? 'former'} style={{ gap: 12 }}>
                        <Avatar name={s.member?.displayName ?? '؟'} color={s.member?.color ?? C.faint} size={34} />
                        <View style={{ flex: 1 }}>
                          <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                            <T w="medium">{s.member?.displayName ?? 'عضو سابق'}</T>
                            <Money value={s.spent} color={over ? C.pom : C.text} />
                          </Row>
                          {s.budget > 0 ? (
                            <>
                              <Bar pct={pct} color={over ? C.pom : pct > 0.8 ? C.saffron : s.member?.color ?? C.faint} />
                              <T size={TS.tiny} color={over ? C.pom : C.sub} style={{ marginTop: 4 }}>
                                {over ? `فوق بادجته بـ ${num(s.spent - s.budget)} من أصل ${num(s.budget)}` : `باقي ${num(s.budget - s.spent)} من أصل ${num(s.budget)}`}
                              </T>
                            </>
                          ) : (
                            <T size={TS.tiny} color={C.faint}>{s.member ? 'ما إله بادجت لهذا الشهر' : 'مصاريف عضو سابق'}</T>
                          )}
                        </View>
                      </Row>
                    );
                  })}
                </Card>
              </>
            )}

            <SectionHead title="البادجت حسب التصنيف" action="تعديل" onAction={() => router.push('/settings/budgets')} />
            {a.hasBudget && (
              <T size={TS.small} color={C.sub} style={{ marginTop: -6, marginBottom: 10 }}>
                موزّع {num(a.allocated)} من {num(a.totalBudget)}{a.unallocated > 0 ? `، وغير موزّع ${num(a.unallocated)}` : ''}
              </T>
            )}
            <Card style={{ paddingVertical: 4 }}>
              {a.byCategory.map((s, i) => {
                const barColor = s.status === 'over' ? C.pom : s.status === 'warning' ? C.saffron : s.category.color;
                return (
                  <View key={s.category.id} style={{ paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderColor: C.line }}>
                    <Row>
                      <CatTile icon={s.category.icon} color={s.category.color} size={38} />
                      <View style={{ flex: 1, marginRight: 12 }}>
                        <Row style={{ justifyContent: 'space-between' }}>
                          <T w="medium">{s.category.name}</T>
                          <Money value={s.spent} size={TS.body} color={s.status === 'over' ? C.pom : C.text} />
                        </Row>
                        {s.budget > 0 && <View style={{ marginTop: 8 }}><Bar pct={s.pct} color={barColor} /></View>}
                        <T size={TS.tiny} color={C.sub} style={{ marginTop: 6 }}>
                          {s.budget > 0
                            ? s.spent > s.budget
                              ? `فوق البادجت بـ ${num(s.spent - s.budget)} من أصل ${num(s.budget)}`
                              : `باقي ${num(s.budget - s.spent)} من أصل ${num(s.budget)}`
                            : 'بدون حصة لهذا الشهر'}
                        </T>
                      </View>
                    </Row>
                  </View>
                );
              })}
            </Card>

            <SectionHead title="آخر المصاريف" action="عرض الكل" onAction={() => router.push('/expenses')} />
            <Card>
              {recent.length === 0 ? (
                <T color={C.sub} align="center" style={{ padding: 20 }}>ما في مصاريف بهذا الشهر.</T>
              ) : (
                recent.map((e, i) => (
                  <ExpenseRow key={e.id} e={e} cat={catOf(e.categoryId)} member={memberOf(e.userId)} showMember={family} onPress={() => openExpense(e)} last={i === recent.length - 1} />
                ))
              )}
            </Card>
          </>
        )}
      </View>
    </ScrollView>
  );
}
