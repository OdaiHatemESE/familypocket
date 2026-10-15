import { useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { itemStats, qtyLabel } from '../../../budgets';
import { CategorySheet } from '../../../components/CategorySheet';
import { ItemSheet } from '../../../components/ItemSheet';
import { PageHeader } from '../../../components/PageHeader';
import { useFamily } from '../../../family';
import { C, TS } from '../../../theme';
import { Item } from '../../../types';
import { Card, CatTile, Icon, Row, T } from '../../../ui';
import { monthKey, monthName, num, shiftMonth } from '../../../utils';

export default function CategoryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { categories, items, expenses } = useFamily();
  const category = categories.find((c) => c.id === id);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemOpen, setItemOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);

  const mine = items.filter((i) => i.categoryId === id);
  const month = monthKey(new Date());
  const stats = useMemo(() => {
    const all = itemStats(month, shiftMonth(month, -1), expenses);
    return Object.fromEntries(all.filter((s) => s.itemId).map((s) => [s.itemId!, s]));
  }, [expenses, month]);

  if (!category) {
    return (
      <View style={{ flex: 1 }}>
        <PageHeader title="التصنيف" back="التصنيفات" />
        <T color={C.sub} align="center" style={{ marginTop: 40 }}>هذا التصنيف انحذف.</T>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <PageHeader title={category.name} back="التصنيفات" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => setCatOpen(true)} style={{ marginTop: 4 }}>
          <Card style={{ padding: 14 }}>
            <Row style={{ gap: 12 }}>
              <CatTile icon={category.icon} color={category.color} size={44} />
              <View style={{ flex: 1 }}>
                <T w="semibold">{category.name}</T>
                <T size={TS.small} color={C.sub}>{mine.length} صنف</T>
              </View>
              <T size={TS.small} w="medium" color={C.oasis}>تعديل التصنيف</T>
            </Row>
          </Card>
        </Pressable>

        <Row style={{ justifyContent: 'space-between', marginTop: 24, marginBottom: 10 }}>
          <T w="bold" size={TS.h2}>الأصناف</T>
          <T size={TS.small} color={C.sub}>مشتريات {monthName(month)}</T>
        </Row>
        <Card>
          {mine.length === 0 && (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Icon name="format-list-bulleted" size={32} color={C.faint} />
              <T color={C.sub} align="center" style={{ marginTop: 8 }}>
                أضف الأصناف اللي بتشتروها من هذا التصنيف، وبعدها بتختاروها لما تسجلوا فاتورة.
              </T>
            </View>
          )}
          {mine.map((it, i) => {
            const s = stats[it.id];
            return (
              <Pressable
                key={it.id}
                onPress={() => (setEditingItem(it), setItemOpen(true))}
                style={({ pressed }) => ({
                  flexDirection: 'row-reverse', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13,
                  borderTopWidth: i ? 1 : 0, borderColor: C.line, backgroundColor: pressed ? C.paper : 'transparent',
                })}
              >
                <View style={{ flex: 1 }}>
                  <T w="semibold">{it.name}</T>
                  <T size={TS.small} color={C.sub}>بالـ{it.unit}</T>
                </View>
                {s ? (
                  <View style={{ alignItems: 'flex-start' }}>
                    <T size={TS.small} w="semibold">{qtyLabel(s.quantity, s.unit)}</T>
                    <T size={TS.tiny} color={C.sub}>{num(s.amount)} درهم</T>
                  </View>
                ) : (
                  <T size={TS.tiny} color={C.faint}>ما انشرى هالشهر</T>
                )}
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => (setEditingItem(null), setItemOpen(true))}
            style={({ pressed }) => ({
              flexDirection: 'row-reverse', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14,
              borderTopWidth: mine.length ? 1 : 0, borderColor: C.line, backgroundColor: pressed ? C.paper : 'transparent',
            })}
          >
            <View style={{ width: 36, height: 36, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.oasis, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="plus" size={20} color={C.oasis} />
            </View>
            <T w="semibold" color={C.oasis}>صنف جديد</T>
          </Pressable>
        </Card>
      </ScrollView>
      <ItemSheet visible={itemOpen} editing={editingItem} categoryId={category.id} onClose={() => setItemOpen(false)} />
      <CategorySheet visible={catOpen} editing={category} onClose={() => setCatOpen(false)} />
    </View>
  );
}
