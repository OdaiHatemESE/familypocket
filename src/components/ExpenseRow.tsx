import React from 'react';
import { Pressable, View } from 'react-native';
import { C, TS } from '../theme';
import { Category, Expense } from '../types';
import { CatTile, Money, T } from '../ui';

export function ExpenseRow({ e, cat, onPress, last }: { e: Expense; cat?: Category; onPress: () => void; last?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row-reverse',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: pressed ? C.paper : 'transparent',
      })}
    >
      <CatTile icon={cat?.icon ?? 'help'} color={cat?.color ?? C.faint} size={40} />
      <View style={{ flex: 1, marginRight: 12 }}>
        <T w="medium" numberOfLines={1}>{e.note || cat?.name || 'بدون تصنيف'}</T>
        {!!e.note && <T size={TS.small} color={C.sub} numberOfLines={1}>{cat?.name}</T>}
      </View>
      <Money value={e.amount} decimals />
      {!last && (
        <View style={{ position: 'absolute', bottom: 0, left: 16, right: 68, height: 1, backgroundColor: C.line }} />
      )}
    </Pressable>
  );
}
