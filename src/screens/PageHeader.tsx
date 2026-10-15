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
  children,
}: {
  title: string;
  month?: string;
  setMonth?: (m: string) => void;
  children?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const isCurrent = month === monthKey(new Date());
  return (
    <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: 8, backgroundColor: C.paper }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T w="bold" size={28} style={{ lineHeight: 40 }}>{title}</T>
        {month && setMonth && (
          <Row style={{ backgroundColor: C.surface, borderRadius: 999, paddingHorizontal: 4, paddingVertical: 2 }}>
            <Pressable onPress={() => setMonth(shiftMonth(month, -1))} hitSlop={8} style={{ padding: 6 }}>
              <Icon name="chevron-right" size={18} color={C.sub} />
            </Pressable>
            <T w="medium" size={TS.small} style={{ minWidth: 86 }} align="center">{monthLabel(month)}</T>
            <Pressable onPress={() => setMonth(shiftMonth(month, 1))} disabled={isCurrent} hitSlop={8} style={{ padding: 6, opacity: isCurrent ? 0.25 : 1 }}>
              <Icon name="chevron-left" size={18} color={C.sub} />
            </Pressable>
          </Row>
        )}
      </Row>
      {children}
    </View>
  );
}
