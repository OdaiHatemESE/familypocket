import { router } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, TS } from '../theme';
import { Icon, Row, T } from '../ui';
import { monthKey, monthLabel, shiftMonth } from '../utils';

export function PageHeader({
  title,
  month,
  setMonth,
  back,
  children,
}: {
  title: string;
  month?: string;
  setMonth?: (m: string) => void;
  back?: boolean | string;
  children?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const isCurrent = month === monthKey(new Date());
  return (
    <View style={{ paddingTop: insets.top + (back ? 8 : 16), paddingHorizontal: 16, paddingBottom: 8, backgroundColor: C.paper }}>
      {back && (
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
          hitSlop={12}
          accessibilityLabel="رجوع"
          style={{ flexDirection: 'row-reverse', alignItems: 'center', alignSelf: 'flex-end', paddingVertical: 6, marginBottom: 2 }}
        >
          <Icon name="chevron-right" size={22} color={C.oasis} />
          <T w="medium" size={TS.body} color={C.oasis}>{typeof back === 'string' ? back : 'الإعدادات'}</T>
        </Pressable>
      )}
      <Row style={{ justifyContent: 'space-between' }}>
        <T w="bold" size={back ? 24 : 28} style={{ lineHeight: back ? 36 : 40, flexShrink: 1 }}>{title}</T>
        {month && setMonth && (
          <Row style={{ backgroundColor: C.surface, borderRadius: 999, paddingHorizontal: 4, paddingVertical: 2 }}>
            <Pressable onPress={() => setMonth(shiftMonth(month, -1))} hitSlop={8} style={{ padding: 6 }} accessibilityLabel="الشهر السابق">
              <Icon name="chevron-right" size={18} color={C.sub} />
            </Pressable>
            <T w="medium" size={TS.small} style={{ minWidth: 86 }} align="center">{monthLabel(month)}</T>
            <Pressable onPress={() => setMonth(shiftMonth(month, 1))} disabled={isCurrent} hitSlop={8} style={{ padding: 6, opacity: isCurrent ? 0.25 : 1 }} accessibilityLabel="الشهر التالي">
              <Icon name="chevron-left" size={18} color={C.sub} />
            </Pressable>
          </Row>
        )}
      </Row>
      {children}
    </View>
  );
}
