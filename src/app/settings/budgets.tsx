import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { analyzeMonth } from '../../analysis';
import { Ring } from '../../components/Charts';
import { CategorySheet } from '../../components/CategorySheet';
import { PageHeader } from '../../components/PageHeader';
import { useFamily } from '../../family';
import { C, TS } from '../../theme';
import { Category } from '../../types';
import { Card, Icon, IconName, Money, Row, T } from '../../ui';
import { monthKey, num } from '../../utils';

export default function BudgetsScreen() {
  const { categories, expenses, fixed, members } = useFamily();
  const [editing, setEditing] = useState<Category | null>(null);
  const [open, setOpen] = useState(false);
  const a = useMemo(() => analyzeMonth(monthKey(new Date()), categories, expenses, fixed, members), [categories, expenses, fixed, members]);
  const statOf = (id: string) => a.byCategory.find((s) => s.category.id === id);
  const fixedTotal = fixed.filter((f) => f.active).reduce((s, f) => s + f.amount, 0);
  const flexible = Math.max(a.totalBudget - fixedTotal, 0);

  return (
    <View style={{ flex: 1 }}>
      <PageHeader title="البادجت والتصنيفات" back />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Budget summary */}
        <Card style={{ padding: 16, marginTop: 8 }}>
          <T size={TS.small} color={C.sub}>البادجت الشهري للعائلة</T>
          <Money value={a.totalBudget} size={34} w="bold" />
          <T size={TS.tiny} color={C.faint}>مجموع بادجت التصنيفات. عدّل أي تصنيف ليتغيّر المجموع.</T>
          {a.totalBudget > 0 && (
            <>
              <View style={{ flexDirection: 'row-reverse', height: 10, borderRadius: 5, overflow: 'hidden', marginTop: 14, backgroundColor: C.track }}>
                <View style={{ width: `${Math.min(fixedTotal / a.totalBudget, 1) * 100}%`, backgroundColor: C.saffron }} />
              </View>
              <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
                <Row style={{ gap: 6 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: C.saffron }} />
                  <T size={TS.small} color={C.sub}>إجباري {num(fixedTotal)}</T>
                </Row>
                <Row style={{ gap: 6 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: C.track }} />
                  <T size={TS.small} color={C.sub}>للصرف اليومي {num(flexible)}</T>
                </Row>
              </Row>
              {fixedTotal > a.totalBudget && (
                <T size={TS.small} color={C.pom} style={{ marginTop: 8 }}>المصاريف الإجبارية أكبر من البادجت. ارفعوا بادجت التصنيفات أو راجعوا الإجبارية.</T>
              )}
            </>
          )}
        </Card>

        <T w="bold" size={TS.h2} style={{ marginTop: 28, marginBottom: 12 }}>التصنيفات</T>
        <Card>
          {categories.map((c, i) => {
            const s = statOf(c.id);
            const ringColor = s?.status === 'over' ? C.pom : s?.status === 'warning' ? C.saffron : c.color;
            const reserved = fixed.filter((f) => f.active && f.categoryId === c.id).reduce((x, f) => x + f.amount, 0);
            return (
              <Pressable
                key={c.id}
                onPress={() => (setEditing(c), setOpen(true))}
                style={({ pressed }) => ({
                  flexDirection: 'row-reverse', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14,
                  borderTopWidth: i ? 1 : 0, borderColor: C.line, backgroundColor: pressed ? C.paper : 'transparent',
                })}
              >
                <View style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ position: 'absolute' }}>
                    <Ring pct={c.monthlyBudget ? s?.pct ?? 0 : 0} color={ringColor} size={48} />
                  </View>
                  <Icon name={c.icon as IconName} size={20} color={c.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <T w="semibold">{c.name}</T>
                  <T size={TS.small} color={C.sub}>
                    {c.monthlyBudget ? `صرفتوا ${num(s?.spent ?? 0)} هذا الشهر` : 'بدون بادجت'}
                    {reserved ? `، منها إجباري ${num(reserved)}` : ''}
                  </T>
                </View>
                <View style={{ alignItems: 'flex-start' }}>
                  {c.monthlyBudget ? <Money value={c.monthlyBudget} /> : <T color={C.faint}>—</T>}
                  <T size={TS.tiny} color={C.faint}>شهرياً</T>
                </View>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => (setEditing(null), setOpen(true))}
            style={({ pressed }) => ({
              flexDirection: 'row-reverse', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14,
              borderTopWidth: categories.length ? 1 : 0, borderColor: C.line, backgroundColor: pressed ? C.paper : 'transparent',
            })}
          >
            <View style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.oasis, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="plus" size={22} color={C.oasis} />
            </View>
            <T w="semibold" color={C.oasis}>تصنيف جديد</T>
          </Pressable>
        </Card>
        {categories.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <T size={TS.small} color={C.sub}>اضغط على أي تصنيف لتعديل اسمه أو البادجت تبعه.</T>
          </View>
        )}
      </ScrollView>
      <CategorySheet visible={open} editing={editing} onClose={() => setOpen(false)} />
    </View>
  );
}
