import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { chargeTotals, ItemStat, itemStats, qtyLabel } from '../budgets';
import { chargeOf, LineKind } from '../lineKinds';
import { useFamily } from '../family';
import { C, TS } from '../theme';
import { Expense } from '../types';
import { Card, Chip, HScroll, Icon, Money, Row, SectionHead, T } from '../ui';
import { monthName, num, shiftMonth } from '../utils';

/** What was bought this month, how much of it, and at what price — compared with last month */
export function ItemsAnalysis({ month, expenses }: { month: string; expenses: Expense[] }) {
  const { categories, items } = useFamily();
  const prev = shiftMonth(month, -1);
  const stats = useMemo(() => itemStats(month, prev, expenses), [month, prev, expenses]);
  const charges = useMemo(() => chargeTotals(month, expenses), [month, expenses]);
  const [cat, setCat] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const usedCats = categories.filter((c) => stats.some((s) => s.categoryId === c.id));
  const list = cat ? stats.filter((s) => s.categoryId === cat) : stats;
  const total = list.reduce((a, s) => a + s.amount, 0);

  // Variants of one type (خبز أبيض، خبز أسمر) are added up under the type (خبز), and open to show each
  const groups = useMemo(() => {
    const groupOf = new Map(items.map((i) => [i.id, i.group || i.name]));
    const map = new Map<string, ItemStat[]>();
    for (const s of list) {
      const g = (s.itemId && groupOf.get(s.itemId)) || s.name;
      map.set(g, [...(map.get(g) ?? []), s]);
    }
    return [...map.entries()]
      .map(([name, variants]) => ({ name, variants, amount: variants.reduce((a, v) => a + v.amount, 0) }))
      .sort((a, b) => b.amount - a.amount);
  }, [list, items]);
  const shown = all ? groups : groups.slice(0, 8);
  const toggle = (g: string) => setOpen((o) => {
    const n = new Set(o);
    if (n.has(g)) n.delete(g);
    else n.add(g);
    return n;
  });

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
            {shown.map((g, i) =>
              g.variants.length === 1 && g.variants[0].name === g.name ? (
                <ItemRow key={g.name} s={g.variants[0]} first={i === 0} prevName={monthName(prev)} />
              ) : (
                <GroupRow key={g.name} name={g.name} variants={g.variants} amount={g.amount} first={i === 0} open={open.has(g.name)} onToggle={() => toggle(g.name)} prevName={monthName(prev)} />
              ),
            )}
            {groups.length > 8 && (
              <Pressable onPress={() => setAll((x) => !x)} style={{ paddingVertical: 12, borderTopWidth: 1, borderColor: C.line }}>
                <T size={TS.small} w="medium" color={C.oasis} align="center">{all ? 'عرض أقل' : `عرض كل الأنواع (${groups.length})`}</T>
              </Pressable>
            )}
            <Row style={{ paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'space-between', borderTopWidth: 1, borderColor: C.line, backgroundColor: C.paper }}>
              <T w="semibold">المجموع</T>
              <Money value={total} w="bold" />
            </Row>
          </Card>

          {charges.length > 0 && (
            <Card style={{ padding: 14, marginTop: 12, gap: 10 }}>
              <T w="semibold" size={TS.small}>الضرائب والرسوم والخصومات</T>
              {charges.map((c) => (
                <Row key={c.kind} style={{ gap: 8 }}>
                  <Icon name={chargeOf(c.kind as LineKind)?.icon ?? 'cash'} size={18} color={c.amount < 0 ? C.oasis : C.sub} />
                  <T size={TS.small} style={{ flex: 1 }}>
                    {chargeOf(c.kind as LineKind)?.label ?? c.kind}
                    <T size={TS.tiny} color={C.sub}>{`  ${c.count === 1 ? 'فاتورة وحدة' : `${c.count} فواتير`}`}</T>
                  </T>
                  <Money value={c.amount} decimals size={TS.small} color={c.amount < 0 ? C.oasis : C.text} />
                </Row>
              ))}
            </Card>
          )}

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

/** A type with several variants: its total, and the variants underneath when opened */
function GroupRow({ name, variants, amount, first, open, onToggle, prevName }: {
  name: string; variants: ItemStat[]; amount: number; first: boolean; open: boolean; onToggle: () => void; prevName: string;
}) {
  const unit = variants.every((v) => v.unit === variants[0].unit) ? variants[0].unit : null;
  const qty = unit ? variants.reduce((a, v) => a + v.quantity, 0) : 0;
  return (
    <View style={{ borderTopWidth: first ? 0 : 1, borderColor: C.line }}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} style={({ pressed }) => ({ backgroundColor: pressed ? C.paper : 'transparent' })}>
        <Row style={{ paddingHorizontal: 16, paddingVertical: 11, gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Row style={{ gap: 6 }}>
              <T w="semibold">{name}</T>
              <View style={{ backgroundColor: C.paper, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 }}>
                <T size={TS.tiny} color={C.sub}>{variants.length} أصناف</T>
              </View>
            </Row>
            <T size={TS.tiny} color={C.sub} numberOfLines={1}>
              {unit ? `${qtyLabel(qty, unit)}، ` : ''}{variants.map((v) => v.name).join('، ')}
            </T>
          </View>
          <Money value={amount} />
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={C.faint} />
        </Row>
      </Pressable>
      {open && (
        <View style={{ backgroundColor: C.paper, marginHorizontal: 10, marginBottom: 10, borderRadius: 14 }}>
          {variants.map((v, i) => (
            <ItemRow key={v.key} s={v} first={i === 0} prevName={prevName} />
          ))}
        </View>
      )}
    </View>
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
