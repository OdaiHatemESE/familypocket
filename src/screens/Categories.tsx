import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { analyzeMonth } from '../analysis';
import { Ring } from '../components/Charts';
import { CategorySheet } from '../components/CategorySheet';
import { useStore } from '../store';
import { C, TS } from '../theme';
import { Category } from '../types';
import { Icon, IconName, Money, Row, T } from '../ui';
import { monthKey, num } from '../utils';
import { PageHeader } from './PageHeader';

export function Categories() {
  const { categories, expenses, resetAll } = useStore();
  const [editing, setEditing] = useState<Category | null>(null);
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const a = useMemo(() => analyzeMonth(monthKey(new Date()), categories, expenses), [categories, expenses]);
  const statOf = (id: string) => a.byCategory.find((s) => s.category.id === id);

  return (
    <View style={{ flex: 1 }}>
      <PageHeader title="التصنيفات">
        <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
          <T size={TS.small} color={C.sub}>مجموع البادجت الشهري</T>
          <Money value={a.totalBudget} />
        </Row>
      </PageHeader>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 }}>
          {categories.map((c) => {
            const s = statOf(c.id);
            const pct = s?.pct ?? 0;
            const ringColor = s?.status === 'over' ? C.pom : s?.status === 'warning' ? C.saffron : c.color;
            return (
              <Pressable
                key={c.id}
                onPress={() => (setEditing(c), setOpen(true))}
                style={({ pressed }) => ({
                  flexBasis: '47%', flexGrow: 1, backgroundColor: C.surface, borderRadius: 22, padding: 16,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' }}>
                  <View style={{ position: 'absolute' }}>
                    <Ring pct={c.monthlyBudget ? pct : 0} color={ringColor} size={52} />
                  </View>
                  <Icon name={c.icon as IconName} size={22} color={c.color} />
                </View>
                <T w="semibold" style={{ marginTop: 12 }} numberOfLines={1}>{c.name}</T>
                <T size={TS.tiny} color={C.sub}>
                  {c.monthlyBudget ? `${num(s?.spent ?? 0)} من ${num(c.monthlyBudget)} درهم` : `${num(s?.spent ?? 0)} درهم، بدون بادجت`}
                </T>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => (setEditing(null), setOpen(true))}
            style={{
              flexBasis: '47%', flexGrow: 1, borderRadius: 22, padding: 16, minHeight: 140,
              borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.faint, alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon name="plus" size={28} color={C.sub} />
            <T w="medium" color={C.sub} align="center" style={{ marginTop: 6 }}>تصنيف جديد</T>
          </Pressable>
        </View>

        <Pressable
          onPress={() => (confirmReset ? (resetAll(), setConfirmReset(false)) : setConfirmReset(true))}
          style={{ marginTop: 36, paddingVertical: 12 }}
        >
          <T size={TS.small} color={confirmReset ? C.pom : C.faint} align="center">
            {confirmReset ? 'اضغط مرة ثانية لمسح كل المصاريف والرجوع للتصنيفات الأساسية' : 'مسح كل البيانات'}
          </T>
        </Pressable>
      </ScrollView>

      <CategorySheet visible={open} editing={editing} onClose={() => setOpen(false)} />
    </View>
  );
}
