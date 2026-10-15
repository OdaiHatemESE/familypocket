import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { analyzeMonth, monthHistory } from '../analysis';
import { Columns, Donut } from '../components/Charts';
import { useStore } from '../store';
import { C, TS } from '../theme';
import { Icon, Money, Row, SectionHead, T } from '../ui';
import { AR_DAYS_SHORT, monthName, num } from '../utils';
import { InsightList } from './Home';
import { PageHeader } from './PageHeader';

const card = { backgroundColor: C.surface, borderRadius: 20, padding: 16 };

export function Analysis({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  const { categories, expenses } = useStore();
  const a = useMemo(() => analyzeMonth(month, categories, expenses), [month, categories, expenses]);
  const hist = useMemo(() => monthHistory(month, 6, expenses), [month, expenses]);
  const withSpend = a.byCategory.filter((s) => s.spent > 0);

  return (
    <View style={{ flex: 1 }}>
      <PageHeader title="التحليل" month={month} setMonth={setMonth} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        {/* Key numbers */}
        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
          <Metric label="متوسط الصرف اليومي" value={a.dailyAvg} />
          <Metric label={a.isCurrent ? 'المتوقع لآخر الشهر' : 'مجموع الشهر'} value={a.projectedTotal}
            color={a.totalBudget > 0 && a.projectedTotal > a.totalBudget ? C.pom : C.text} />
          <Metric label="حصتك اليومية من البادجت" value={a.dailyAllowance} />
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
              color: h.month === month ? C.ink : a.totalBudget > 0 && h.total > a.totalBudget ? C.pomLight : '#B8C4D9',
            }))}
            reference={a.totalBudget}
            referenceLabel={`البادجت الشهري ${num(a.totalBudget)} درهم`}
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
