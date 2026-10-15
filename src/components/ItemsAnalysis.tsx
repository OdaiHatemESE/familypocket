import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ItemStat, itemStats, qtyLabel } from '../budgets';
import { useFamily } from '../family';
import { C, TS } from '../theme';
import { Expense } from '../types';
import { Card, Chip, HScroll, Icon, Money, Row, SectionHead, T } from '../ui';
import { monthName, num, shiftMonth } from '../utils';

/** What was bought this month, how much of it, and at what price — compared with last month */
export function ItemsAnalysis({ month, expenses }: { month: string; expenses: Expense[] }) {
  const { categories } = useFamily();
  const prev = shiftMonth(month, -1);
  const stats = useMemo(() => itemStats(month, prev, expenses), [month, prev, expenses]);
  const [cat, setCat] = useState<string | null>(null);
  const [all, setAll] = useState(false);

  const usedCats = categories.filter((c) => stats.some((s) => s.categoryId === c.id));
  const list = cat ? stats.filter((s) => s.categoryId === cat) : stats;
  const shown = all ? list : list.slice(0, 8);
  const total = list.reduce((a, s) => a + s.amount, 0);

  // Price moves worth pointing out (≥ 10% per unit vs last month)
  const moves = stats
    .filter((s) => s.prevAvgPrice && Math.abs(s.avgPrice / s.prevAvgPrice - 1) >= 0.1)
    .sort((a, b) => Math.abs(b.avgPrice / b.prevAvgPrice! - 1) - Math.abs(a.avgPrice / a.prevAvgPrice! - 1))
    .slice(0, 3);

  return (
    <>
      <SectionHead title="الأصناف" />
      {stats.length === 0 ? (
        <Card style={{ padding: 20, alignItems: 'center' }}>
          <Icon name="receipt-text-outline" size={32} color={C.faint} />
          <T color={C.sub} align="center" style={{ marginTop: 8 }}>
            سجّلوا المشتريات كـ«فاتورة بأصناف» وبيطلع هون قديش اشتريتوا من كل صنف وبأي سعر.
          </T>
        </Card>
      ) : (
        <>
          {usedCats.length > 1 && (
            <HScroll style={{ paddingBottom: 10 }}>
              <Chip label="الكل" on={!cat} onPress={() => setCat(null)} />
              {usedCats.map((c) => (
                <Chip key={c.id} label={c.name} icon={c.icon} on={cat === c.id} onPress={() => setCat(cat === c.id ? null : c.id)} />
              ))}
            </HScroll>
          )}
          <Card>
            <Row style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, justifyContent: 'space-between' }}>
              <T size={TS.tiny} color={C.sub}>الصنف والكمية</T>
              <T size={TS.tiny} color={C.sub}>المدفوع وسعر الوحدة</T>
            </Row>
            {shown.map((s, i) => (
              <ItemRow key={s.key} s={s} first={i === 0} prevName={monthName(prev)} />
            ))}
            {list.length > 8 && (
              <Pressable onPress={() => setAll((x) => !x)} style={{ paddingVertical: 12, borderTopWidth: 1, borderColor: C.line }}>
                <T size={TS.small} w="medium" color={C.oasis} align="center">{all ? 'عرض أقل' : `عرض كل الأصناف (${list.length})`}</T>
              </Pressable>
            )}
            <Row style={{ paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'space-between', borderTopWidth: 1, borderColor: C.line, backgroundColor: C.paper }}>
              <T w="semibold">المجموع</T>
              <Money value={total} w="bold" />
            </Row>
          </Card>

          {moves.length > 0 && (
            <Card style={{ padding: 14, marginTop: 12, gap: 8 }}>
              <T w="semibold" size={TS.small}>تغيّر الأسعار عن {monthName(prev)}</T>
              {moves.map((s) => {
                const ch = s.avgPrice / s.prevAvgPrice! - 1;
                return (
                  <Row key={s.key} style={{ gap: 8 }}>
                    <Icon name={ch > 0 ? 'trending-up' : 'trending-down'} size={18} color={ch > 0 ? C.pom : C.oasis} />
                    <T size={TS.small} style={{ flex: 1 }}>
                      {s.name}: {num(s.prevAvgPrice!)} ← {num(s.avgPrice)} درهم للـ{s.unit} ({ch > 0 ? '+' : ''}{Math.round(ch * 100)}%)
                    </T>
                  </Row>
                );
              })}
            </Card>
          )}
        </>
      )}
    </>
  );
}

function ItemRow({ s, first, prevName }: { s: ItemStat; first: boolean; prevName: string }) {
  const qtyDiff = s.prevQuantity ? s.quantity - s.prevQuantity : null;
  return (
    <Row style={{ paddingHorizontal: 16, paddingVertical: 11, gap: 10, borderTopWidth: first ? 0 : 1, borderColor: C.line }}>
      <View style={{ flex: 1 }}>
        <T w="medium">{s.name}</T>
        <T size={TS.tiny} color={C.sub}>
          {qtyLabel(s.quantity, s.unit)}
          {s.purchases > 1 ? `، على ${s.purchases} مرات` : ''}
          {qtyDiff !== null && Math.abs(qtyDiff) > 0.001 ? `، ${qtyDiff > 0 ? 'أكثر' : 'أقل'} بـ ${qtyLabel(Math.abs(qtyDiff), s.unit)} من ${prevName}` : ''}
        </T>
      </View>
      <View style={{ alignItems: 'flex-start' }}>
        <Money value={s.amount} />
        <T size={TS.tiny} color={C.sub}>{num(s.avgPrice)} للـ{s.unit}</T>
      </View>
    </Row>
  );
}
