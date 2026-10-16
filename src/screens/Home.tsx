import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { analyzeMonth, Insight } from '../analysis';
import { ExpenseRow } from '../components/ExpenseRow';
import { CommitmentsCard } from '../components/CommitmentsCard';
import { Hero } from '../components/Hero';
import { monthCommitments } from '../commitments';
import { useFamily } from '../family';
import { useTabs } from '../tabsContext';
import { C, TS } from '../theme';
import { Avatar, Bar, Card, CatTile, Icon, IconName, Money, PrimaryButton, Row, SectionHead, T } from '../ui';
import { num, shiftMonth } from '../utils';
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
  const { categories, expenses, fixed, members, memberOf, refresh, budgetsFor, payments, reserves, incomesFor } = useFamily();
  const { month, setMonth, openAdd, openExpense, scope } = useTabs();
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
  const mc = useMemo(() => monthCommitments(month, fixed, payments, reserves, expenses, scope), [month, fixed, payments, reserves, expenses, scope]);
  const incomes = useMemo(() => incomesFor(month), [incomesFor, month]);
  const income = scope ? incomes[scope] ?? 0 : Object.values(incomes).reduce((x, y) => x + y, 0);

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
      <Hero a={a} pendingCommitments={mc.pendingAmount} onPrev={() => setMonth(shiftMonth(month, -1))} onNext={() => setMonth(shiftMonth(month, 1))} />

      <View style={{ paddingHorizontal: 16 }}>
        <Pressable
          onPress={() => router.push('/assistant')}
          accessibilityRole="button"
          accessibilityLabel="افتح المساعد"
          style={({ pressed }) => ({
            flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginTop: 16, padding: 14, borderRadius: 20,
            backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.oasis + '30', opacity: pressed ? 0.85 : 1,
          })}
        >
          <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="creation" size={22} color={C.oasisLight} />
          </View>
          <View style={{ flex: 1 }}>
            <T w="semibold">اسأل المساعد</T>
            <T size={TS.small} color={C.sub}>«قديش صرفنا على الأكل؟» أو «اشتريت 2 كيلو بندورة بـ 8»</T>
          </View>
          <Icon name="chevron-left" size={22} color={C.faint} />
        </Pressable>

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

            <SectionHead title="الراتب والالتزامات" action="إدارة" onAction={() => router.push('/settings/fixed')} />
            <CommitmentsCard month={month} mc={mc} income={income} spent={a.totalSpent} />

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
