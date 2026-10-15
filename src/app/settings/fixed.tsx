import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { analyzeMonth } from '../../analysis';
import { FixedSheet } from '../../components/FixedSheet';
import { PageHeader } from '../../components/PageHeader';
import { useFamily } from '../../family';
import { C, TS } from '../../theme';
import { FixedExpense } from '../../types';
import { Card, CatTile, Icon, Money, Row, T } from '../../ui';
import { monthKey, num } from '../../utils';

export default function FixedScreen() {
  const { fixed, categories, expenses, members, memberOf, budgetsFor } = useFamily();
  const [editing, setEditing] = useState<FixedExpense | null>(null);
  const [open, setOpen] = useState(false);
  const month = monthKey(new Date());
  const a = useMemo(() => analyzeMonth(month, categories, expenses, fixed, members, budgetsFor(month)), [month, categories, expenses, fixed, members, budgetsFor]);
  const paid = (id: string) => a.fixedStatus.find((s) => s.fixed.id === id)?.paid;
  const active = fixed.filter((f) => f.active);
  const total = active.reduce((s, f) => s + f.amount, 0);
  const catOf = (id: string) => categories.find((c) => c.id === id);
  const sorted = [...fixed].sort((x, y) => Number(y.active) - Number(x.active) || x.dueDay - y.dueDay);

  return (
    <View style={{ flex: 1 }}>
      <PageHeader title="المصاريف الإجبارية" back />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <Card style={{ padding: 16, marginTop: 8 }}>
          <T size={TS.small} color={C.sub}>مجموع الإجبارية الشهرية</T>
          <Money value={total} size={34} w="bold" />
          <T size={TS.small} color={C.sub} style={{ marginTop: 4 }}>
            كل شهر بتطلع بالرئيسية كمستحقة، وبتضغطوا «دفعت» لما تندفع فبتنسجّل كمصروف. واللي ما انتدفع بينحسب ضمن المتوقع لآخر الشهر.
          </T>
        </Card>

        <Card style={{ marginTop: 16 }}>
          {sorted.length === 0 && (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Icon name="calendar-sync-outline" size={36} color={C.faint} />
              <T color={C.sub} align="center" style={{ marginTop: 8 }}>ما في مصاريف إجبارية. أضيفوا الإيجار والأقساط والفواتير الثابتة.</T>
            </View>
          )}
          {sorted.map((f, i) => {
            const cat = catOf(f.categoryId);
            const isPaid = paid(f.id);
            return (
              <Pressable
                key={f.id}
                onPress={() => (setEditing(f), setOpen(true))}
                style={({ pressed }) => ({
                  flexDirection: 'row-reverse', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14,
                  borderTopWidth: i ? 1 : 0, borderColor: C.line, backgroundColor: pressed ? C.paper : 'transparent', opacity: f.active ? 1 : 0.5,
                })}
              >
                <CatTile icon={cat?.icon ?? 'calendar'} color={cat?.color ?? C.faint} size={40} />
                <View style={{ flex: 1 }}>
                  <T w="semibold">{f.name}</T>
                  <T size={TS.small} color={C.sub}>
                    {f.active ? `يستحق يوم ${f.dueDay} كل شهر` : 'موقّف'}، {cat?.name}
                    {members.length > 1 ? `، على ${memberOf(f.ownerId)?.displayName ?? 'غير محدد'}` : ''}
                  </T>
                </View>
                <View style={{ alignItems: 'flex-start' }}>
                  <Money value={f.amount} />
                  {f.active && (
                    <T size={TS.tiny} color={isPaid ? C.oasis : C.saffron}>{isPaid ? 'مدفوع هذا الشهر' : 'مستحق هذا الشهر'}</T>
                  )}
                </View>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => (setEditing(null), setOpen(true))}
            style={({ pressed }) => ({
              flexDirection: 'row-reverse', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14,
              borderTopWidth: sorted.length ? 1 : 0, borderColor: C.line, backgroundColor: pressed ? C.paper : 'transparent',
            })}
          >
            <View style={{ width: 40, height: 40, borderRadius: 13, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.oasis, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="plus" size={22} color={C.oasis} />
            </View>
            <T w="semibold" color={C.oasis}>مصروف إجباري جديد</T>
          </Pressable>
        </Card>

        {active.length > 0 && a.totalBudget > 0 && (
          <Row style={{ gap: 8, marginTop: 16, paddingHorizontal: 4 }}>
            <Icon name="information-outline" size={18} color={C.sub} />
            <T size={TS.small} color={C.sub} style={{ flex: 1 }}>
              الإجبارية بتاخد {Math.round((total / a.totalBudget) * 100)}% من بادجت العائلة لهذا الشهر ({num(a.totalBudget)} درهم).
            </T>
          </Row>
        )}
      </ScrollView>
      <FixedSheet visible={open} editing={editing} onClose={() => setOpen(false)} />
    </View>
  );
}
