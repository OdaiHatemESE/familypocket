import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
  useFonts,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { ActivityIndicator, I18nManager, Platform, Pressable, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExpenseSheet } from './src/components/ExpenseSheet';
import { Analysis } from './src/screens/Analysis';
import { Categories } from './src/screens/Categories';
import { Home } from './src/screens/Home';
import { Transactions } from './src/screens/Transactions';
import { StoreProvider, useStore } from './src/store';
import { C } from './src/theme';
import { Expense } from './src/types';
import { Icon, IconName, T } from './src/ui';
import { monthKey } from './src/utils';

// Layout is mirrored by hand (row-reverse + right alignment); stop the OS from flipping it again.
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

type Tab = 'home' | 'list' | 'stats' | 'cats';

const TABS: { key: Tab; label: string; icon: IconName; iconOn: IconName }[] = [
  { key: 'home', label: 'الرئيسية', icon: 'home-variant-outline', iconOn: 'home-variant' },
  { key: 'list', label: 'المصاريف', icon: 'receipt-text-outline', iconOn: 'receipt-text' },
  { key: 'stats', label: 'التحليل', icon: 'chart-box-outline', iconOn: 'chart-box' },
  { key: 'cats', label: 'التصنيفات', icon: 'shape-outline', iconOn: 'shape' },
];

function Main() {
  const { ready } = useStore();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('home');
  const [month, setMonth] = useState(monthKey(new Date()));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  if (!ready) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.paper }}><ActivityIndicator color={C.ink} /></View>;

  const edit = (e: Expense) => (setEditing(e), setSheetOpen(true));
  const add = () => (setEditing(null), setSheetOpen(true));

  const tabButton = (t: (typeof TABS)[number]) => {
    const on = tab === t.key;
    return (
      <Pressable key={t.key} onPress={() => setTab(t.key)} style={{ flex: 1, alignItems: 'center', paddingTop: 8 }}>
        <Icon name={on ? t.iconOn : t.icon} size={24} color={on ? C.ink : C.faint} />
        <T size={11} w={on ? 'semibold' : 'regular'} color={on ? C.ink : C.faint} align="center">{t.label}</T>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <StatusBar style={tab === 'home' ? 'light' : 'dark'} />
      <View style={{ flex: 1 }}>
        {tab === 'home' && <Home month={month} setMonth={setMonth} onEdit={edit} onAdd={add} goTo={setTab} />}
        {tab === 'list' && <Transactions month={month} setMonth={setMonth} onEdit={edit} />}
        {tab === 'stats' && <Analysis month={month} setMonth={setMonth} />}
        {tab === 'cats' && <Categories />}
      </View>

      {/* Tab bar with the add button in the middle */}
      <View
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          backgroundColor: C.surface,
          paddingBottom: Math.max(insets.bottom, 10),
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          shadowColor: C.ink, shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12,
          flexDirection: 'row-reverse',
        }}
      >
        {tabButton(TABS[0])}
        {tabButton(TABS[1])}
        <View style={{ width: 76, alignItems: 'center' }}>
          <Pressable
            onPress={add}
            accessibilityLabel="سجّل مصروف"
            style={({ pressed }) => ({
              marginTop: -22, width: 62, height: 62, borderRadius: 22,
              backgroundColor: C.oasis, alignItems: 'center', justifyContent: 'center',
              transform: [{ scale: pressed ? 0.94 : 1 }],
              borderWidth: 5, borderColor: C.paper,
            })}
          >
            <MaterialCommunityIcons name="plus" size={30} color="#fff" />
          </Pressable>
        </View>
        {tabButton(TABS[2])}
        {tabButton(TABS[3])}
      </View>

      <ExpenseSheet visible={sheetOpen} editing={editing} onClose={() => setSheetOpen(false)} />
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Plex400: IBMPlexSansArabic_400Regular,
    Plex500: IBMPlexSansArabic_500Medium,
    Plex600: IBMPlexSansArabic_600SemiBold,
    Plex700: IBMPlexSansArabic_700Bold,
    ...MaterialCommunityIcons.font,
  });
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: C.paper }} />;
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <View style={Platform.OS === 'web' ? { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' } : { flex: 1 }}>
          <Main />
        </View>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
