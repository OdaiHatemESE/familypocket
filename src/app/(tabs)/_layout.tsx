import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExpenseSheet } from '../../components/ExpenseSheet';
import { TabsContext } from '../../tabsContext';
import { C } from '../../theme';
import { Expense } from '../../types';
import { Icon, IconName, T } from '../../ui';
import { monthKey } from '../../utils';

const TABS: Record<string, { label: string; icon: IconName; iconOn: IconName }> = {
  index: { label: 'الرئيسية', icon: 'home-variant-outline', iconOn: 'home-variant' },
  expenses: { label: 'المصاريف', icon: 'receipt-text-outline', iconOn: 'receipt-text' },
  analysis: { label: 'التحليل', icon: 'chart-box-outline', iconOn: 'chart-box' },
  settings: { label: 'الإعدادات', icon: 'cog-outline', iconOn: 'cog' },
};

type BarProps = { state: { index: number; routes: { key: string; name: string }[] }; navigation: { navigate: (name: string) => void } };

function TabBar({ state, navigation, onAdd }: BarProps & { onAdd: () => void }) {
  const insets = useSafeAreaInsets();
  const button = (route: { key: string; name: string }, i: number) => {
    const t = TABS[route.name];
    if (!t) return null;
    const on = state.index === i;
    return (
      <Pressable
        key={route.key}
        onPress={() => navigation.navigate(route.name)}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        style={{ flex: 1, alignItems: 'center', paddingTop: 8 }}
      >
        <Icon name={on ? t.iconOn : t.icon} size={24} color={on ? C.ink : C.faint} />
        <T size={11} w={on ? 'semibold' : 'regular'} color={on ? C.ink : C.faint} align="center">{t.label}</T>
      </Pressable>
    );
  };
  const routes = state.routes;
  return (
    <View
      style={{
        backgroundColor: C.surface,
        paddingBottom: Math.max(insets.bottom, 10),
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        shadowColor: C.ink, shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12,
        flexDirection: 'row-reverse',
      }}
    >
      {routes.slice(0, 2).map((r, i) => button(r, i))}
      <View style={{ width: 76, alignItems: 'center' }}>
        <Pressable
          onPress={onAdd}
          accessibilityLabel="سجّل مصروف"
          style={({ pressed }) => ({
            marginTop: -22, width: 62, height: 62, borderRadius: 22,
            backgroundColor: C.oasis, alignItems: 'center', justifyContent: 'center',
            transform: [{ scale: pressed ? 0.94 : 1 }], borderWidth: 5, borderColor: C.paper,
          })}
        >
          <MaterialCommunityIcons name="plus" size={30} color="#fff" />
        </Pressable>
      </View>
      {routes.slice(2).map((r, i) => button(r, i + 2))}
    </View>
  );
}

export default function TabsLayout() {
  const [month, setMonth] = useState(monthKey(new Date()));
  const [scope, setScope] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const ctx = useMemo(
    () => ({
      month,
      setMonth,
      scope,
      setScope,
      openAdd: () => (setEditing(null), setSheetOpen(true)),
      openExpense: (e: Expense) => (setEditing(e), setSheetOpen(true)),
    }),
    [month, scope],
  );

  return (
    <TabsContext.Provider value={ctx}>
      <Tabs
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: C.paper } }}
        tabBar={(props) => <TabBar {...(props as unknown as BarProps)} onAdd={ctx.openAdd} />}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="expenses" />
        <Tabs.Screen name="analysis" />
        <Tabs.Screen name="settings" />
      </Tabs>
      <ExpenseSheet visible={sheetOpen} editing={editing} onClose={() => setSheetOpen(false)} />
    </TabsContext.Provider>
  );
}
