import React, { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { analyzeMonth, Insight } from '../analysis';
import { ExpenseRow } from '../components/ExpenseRow';
import { Hero } from '../components/Hero';
import { useStore } from '../store';
import { C, TS } from '../theme';
import { Expense } from '../types';
import { Bar, CatTile, Icon, IconName, Money, PrimaryButton, Row, SectionHead, T } from '../ui';
import { shiftMonth } from '../utils';

export const toneStyle: Record<Insight['tone'], { color: string; icon: IconName }> = {
  bad: { color: C.pom, icon: 'arrow-up-bold-circle-outline' },
  warn: { color: C.saffron, icon: 'alert-circle-outline' },
  good: { color: C.oasis, icon: 'check-circle-outline' },
  info: { color: C.sub, icon: 'information-outline' },
};

export function InsightList({ items }: { items: Insight[] }) {
  return (
    <View style={{ backgroundColor: C.surface, borderRadius: 20, paddingVertical: 6 }}>
      {items.map((ins, i) => (
        <View key={i} style={{ flexDirection: 'row-reverse', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: C.line }}>
          <View style={{ marginTop: 2, marginLeft: 12 }}>
            <Icon name={toneStyle[ins.tone].icon} size={20} color={toneStyle[ins.tone].color} />
          </View>
          <T style={{ flex: 1 }}>{ins.text}</T>
        </View>
      ))}
    </View>
  );
}

export function Home({
  month,
  setMonth,
  onEdit,
  onAdd,
  goTo,
}: {
  month: string;
  setMonth: (m: string) => void;
  onEdit: (e: Expense) => void;
  onAdd: () => void;
  goTo: (tab: 'list' | 'cats' | 'stats') => void;
}) {
  const { categories, expenses, loadDemo } = useStore();
  const a = useMemo(() => analyzeMonth(month, categories, expenses), [month, categories, expenses]);
  const recent = useMemo(
    () => expenses.filter((e) => e.date.startsWith(month)).sort((x, y) => (x.date === y.date ? y.createdAt - x.createdAt : x.date < y.date ? 1 : -1)).slice(0, 5),
    [expenses, month],
  );
  const catOf = (id: string) => categories.find((c) => c.id === id);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
      <Hero a={a} onPrev={() => setMonth(shiftMonth(month, -1))} onNext={() => setMonth(shiftMonth(month, 1))} />

      <View style={{ paddingHorizontal: 16 }}>
        {expenses.length === 0 ? (
          <View style={{ backgroundColor: C.surface, borderRadius: 24, padding: 24, marginTop: 20, alignItems: 'center' }}>
            <CatTile icon="wallet-outline" color={C.oasis} size={56} />
            <T w="bold" size={TS.h2} align="center" style={{ marginTop: 14 }}>سجّل أول مصروف</T>
            <T color={C.sub} align="center" style={{ marginTop: 6, marginBottom: 18 }}>
              كل مصروف بتسجله بيدخل بالتحليل اليومي ومقارنة البادجت.
            </T>
            <View style={{ alignSelf: 'stretch', gap: 10 }}>
              <PrimaryButton label="سجّل مصروف" onPress={onAdd} />
              <Pressable onPress={loadDemo} style={{ paddingVertical: 10 }}>
                <T w="medium" color={C.oasis} align="center">جرّب ببيانات تجريبية</T>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            {a.insights.length > 0 && (
              <>
                <SectionHead title="تحليل اليوم" action="التحليل الكامل" onAction={() => goTo('stats')} />
                <InsightList items={a.insights.slice(0, 3)} />
              </>
            )}

            <SectionHead title="البادجت حسب التصنيف" action="تعديل" onAction={() => goTo('cats')} />
            <View style={{ backgroundColor: C.surface, borderRadius: 20, paddingVertical: 4 }}>
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
                        <View style={{ marginTop: 8 }}>
                          {s.budget > 0 ? <Bar pct={s.pct} color={barColor} /> : null}
                        </View>
                        <T size={TS.tiny} color={C.sub} style={{ marginTop: 6 }}>
                          {s.budget > 0
                            ? s.spent > s.budget
                              ? `فوق البادجت بـ ${Math.round(s.spent - s.budget).toLocaleString('en-US')} من أصل ${s.budget.toLocaleString('en-US')}`
                              : `باقي ${Math.round(s.budget - s.spent).toLocaleString('en-US')} من أصل ${s.budget.toLocaleString('en-US')}`
                            : 'بدون بادجت'}
                        </T>
                      </View>
                    </Row>
                  </View>
                );
              })}
            </View>

            <SectionHead title="آخر المصاريف" action="عرض الكل" onAction={() => goTo('list')} />
            <View style={{ backgroundColor: C.surface, borderRadius: 20, overflow: 'hidden' }}>
              {recent.length === 0 ? (
                <T color={C.sub} align="center" style={{ padding: 20 }}>ما في مصاريف بهذا الشهر.</T>
              ) : (
                recent.map((e, i) => <ExpenseRow key={e.id} e={e} cat={catOf(e.categoryId)} onPress={() => onEdit(e)} last={i === recent.length - 1} />)
              )}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}
