import React from 'react';
import { Pressable, View } from 'react-native';
import { C, TS } from '../theme';
import { Category, Expense, Member } from '../types';
import { CatTile, Icon, Money, T } from '../ui';

export function ExpenseRow({
  e,
  cat,
  member,
  showMember,
  onPress,
  last,
}: {
  e: Expense;
  cat?: Category;
  member?: Member;
  showMember?: boolean;
  onPress: () => void;
  last?: boolean;
}) {
  const items = e.lines.length ? (e.lines.length === 1 ? 'صنف واحد' : `${e.lines.length} أصناف`) : null;
  const sub = [items, e.note && !items ? cat?.name : null, showMember ? member?.displayName ?? 'عضو سابق' : null].filter(Boolean).join('، ');
  const title = e.note || (e.lines.length ? e.lines.map((l) => l.name).slice(0, 2).join('، ') : cat?.name) || 'بدون تصنيف';
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
      <View>
        <CatTile icon={cat?.icon ?? 'help'} color={cat?.color ?? C.faint} size={40} />
        {showMember && (
          <View
            style={{
              position: 'absolute', bottom: -2, left: -2, width: 14, height: 14, borderRadius: 7,
              backgroundColor: member?.color ?? C.faint, borderWidth: 2, borderColor: C.surface,
            }}
          />
        )}
      </View>
      <View style={{ flex: 1, marginRight: 12 }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
          <T w="medium" numberOfLines={1} style={{ flexShrink: 1 }}>{title}</T>
          {e.fixedId && <Icon name="calendar-check-outline" size={15} color={C.oasis} />}
          {e.lines.length > 0 && <Icon name="receipt-text-outline" size={15} color={C.sub} />}
        </View>
        {!!sub && <T size={TS.small} color={C.sub} numberOfLines={1}>{sub}</T>}
      </View>
      <Money value={e.amount} decimals />
      {!last && <View style={{ position: 'absolute', bottom: 0, left: 16, right: 68, height: 1, backgroundColor: C.line }} />}
    </Pressable>
  );
}
