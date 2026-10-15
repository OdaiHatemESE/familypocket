import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { analyzeMonth, monthHistory } from '../analysis';
import { Columns, Donut } from '../components/Charts';
import { useFamily } from '../family';
import { useTabs } from '../tabsContext';
import { C, TS } from '../theme';
import { Avatar, Chip, HScroll, Icon, Money, Row, SectionHead, T } from '../ui';
import { AR_DAYS_SHORT, monthName, num } from '../utils';
import { InsightList } from './Home';
import { PageHeader } from '../components/PageHeader';

const card = { backgroundColor: C.surface, borderRadius: 20, padding: 16 };

export function Analysis() {
  const { categories, expenses, fixed, members } = useFamily();
  const { month, setMonth } = useTabs();
  const [who, setWho] = useState<string | null>(null);
  const family = members.length > 1;
  const scoped = useMemo(() => (who ? expenses.filter((e) => e.userId === who) : expenses), [expenses, who]);
  const a = useMemo(
    () => analyzeMonth(month, categories, scoped, who ? [] : fixed, members, { budgetAware: !who }),
    [month, categories, scoped, fixed, members, who],
  );
  const hist = useMemo(() => monthHistory(month, 6, scoped), [month, scoped]);
  const withSpend = a.byCategory.filter((s) => s.spent > 0);

  return (
    <View style={{ flex: 1 }}>
      <PageHeader title="التحليل" month={month} setMonth={setMonth}>
        {family && (
          <HScroll style={{ paddingTop: 10, paddingBottom: 4 }}>
            <Chip label="كل العائلة" icon="account-group-outline" on={!who} onPress={() => setWho(null)} />
            {members.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => setWho(who === m.id ? null : m.id)}
                style={{
                  flexDirection: 'row-reverse', alignItems: 'center', gap: 6, paddingRight: 4, paddingLeft: 12, paddingVertical: 4,
                  borderRadius: 999, backgroundColor: who === m.id ? C.ink : C.surface, borderWidth: 1, borderColor: who === m.id ? C.ink : C.line,
                }}
              >
                <Avatar name={m.displayName} color={m.color} size={24} />
                <T size={TS.small} w={who === m.id ? 'semibold' : 'regular'} color={who === m.id ? '#fff' : C.text}>{m.displayName}</T>
              </Pressable>
            ))}
          </HScroll>
        )}
      </PageHeader>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        {/* Key numbers */}
        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
          <Metric label="متوسط الصرف اليومي" value={a.dailyAvg} />
          <Metric label={a.isCurrent ? 'المتوقع لآخر الشهر' : 'مجموع الشهر'} value={a.projectedTotal}
            color={a.totalBudget > 0 && a.projectedTotal > a.totalBudget ? C.pom : C.text} />
          {!who ? <Metric label="المحجوز للإجبارية" value={a.pendingFixed} /> : <Metric label="مصاريف إجبارية دفعها" raw={String(scoped.filter((e) => e.fixedId && e.date.startsWith(month)).length)} />}
          <Metric label="عدد المصاريف" raw={String(a.count)} />
        </View>

        {a.insights.length > 0 && (
          <>
            <SectionHead title="ملاحظات" />
            <InsightList items={a.insights} />
          </>
        )}

        <SectionHead title="وين راحت المصاري" />
        <View style={card}>
          {withSpend.length === 0 ? (
            <T color={C.sub} align="center">ما في صرف بهذا الشهر.</T>
          ) : (
            <>
              <View style={{ alignItems: 'center', marginBottom: 14 }}>
                <Donut data={withSpend.map((s) => ({ value: s.spent, color: s.category.color }))} label="المجموع" value={a.totalSpent} />
              </View>
              {withSpend.map((s, i) => {
                const share = a.totalSpent ? s.spent / a.totalSpent : 0;
                const change = s.prevSpent > 0 ? (s.spent - s.prevSpent) / s.prevSpent : null;
                return (
                  <Row key={s.category.id} style={{ paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderColor: C.line }}>
                    <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: s.category.color, marginLeft: 10 }} />
                    <View style={{ flex: 1 }}>
                      <T w="medium">{s.category.name}</T>
                      {change !== null && (
                        <T size={TS.tiny} color={change > 0.05 ? C.pom : change < -0.05 ? C.oasis : C.sub}>
                          {Math.abs(change) < 0.05
                            ? `نفس مستوى ${monthName(hist[4].month)}`
                            : change > 0
                              ? `أعلى بـ ${Math.round(change * 100)}% من ${monthName(hist[4].month)}`
                              : `أقل بـ ${Math.round(-change * 100)}% من ${monthName(hist[4].month)}`}
                        </T>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-start' }}>
                      <Money value={s.spent} />
                      <T size={TS.tiny} color={C.sub}>{Math.round(share * 100)}%</T>
                    </View>
                  </Row>
                );
              })}
            </>
          )}
        </View>

        <SectionHead title="آخر ٦ شهور" />
        <View style={card}>
          <Columns
            items={hist.map((h) => ({
              label: monthName(h.month),
              value: h.total,
              caption: h.total ? `${(h.total / 1000).toFixed(1)} ألف` : '',
              color: h.month === month ? C.ink : !who && a.totalBudget > 0 && h.total > a.totalBudget ? C.pomLight : '#B8C4D9',
            }))}
            reference={who ? undefined : a.totalBudget}
            referenceLabel={who ? undefined : `البادجت الشهري ${num(a.totalBudget)} درهم`}
          />
        </View>

        <SectionHead title="الصرف حسب أيام الأسبوع" />
        <View style={card}>
          {(() => {
            const max = Math.max(...a.weekday);
            return (
              <Columns
                height={120}
                items={a.weekday.map((v, i) => ({
                  label: AR_DAYS_SHORT[i],
                  value: v,
                  color: v === max && v > 0 ? C.saffron : '#D7DEE9',
                }))}
              />
            );
          })()}
          <Row style={{ marginTop: 12, gap: 6 }}>
            <Icon name="information-outline" size={16} color={C.sub} />
            <T size={TS.tiny} color={C.sub} style={{ flex: 1 }}>العمود الملوّن هو اليوم اللي بتصرف فيه أكثر من غيره.</T>
          </Row>
        </View>
      </ScrollView>
    </View>
  );
}

function Metric({ label, value, raw, color = C.text }: { label: string; value?: number; raw?: string; color?: string }) {
  return (
    <View style={{ ...card, flexBasis: '47%', flexGrow: 1, paddingVertical: 14 }}>
      <T size={TS.tiny} color={C.sub}>{label}</T>
      {raw !== undefined ? <T w="bold" size={22}>{raw}</T> : <Money value={value ?? 0} size={22} w="bold" color={color} />}
    </View>
  );
}
