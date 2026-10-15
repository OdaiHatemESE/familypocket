import React from 'react';
import { Pressable } from 'react-native';
import { useFamily } from '../family';
import { useTabs } from '../tabsContext';
import { C, TS } from '../theme';
import { Avatar, HScroll, Icon, T } from '../ui';

/** Switch between the whole family and one member. Hidden when the family has one member. */
export function ScopeSwitch({ dark, style }: { dark?: boolean; style?: object }) {
  const { members } = useFamily();
  const { scope, setScope } = useTabs();
  if (members.length < 2) return null;

  const chip = (key: string | null, label: string, avatar?: { name: string; color: string }) => {
    const on = scope === key;
    const bg = on ? (dark ? '#fff' : C.ink) : dark ? 'rgba(255,255,255,0.08)' : C.surface;
    const fg = on ? (dark ? C.ink : '#fff') : dark ? '#fff' : C.text;
    return (
      <Pressable
        key={key ?? 'family'}
        onPress={() => setScope(key)}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        style={{
          flexDirection: 'row-reverse', alignItems: 'center', gap: 6,
          paddingRight: avatar ? 4 : 12, paddingLeft: 12, paddingVertical: avatar ? 4 : 7,
          borderRadius: 999, backgroundColor: bg,
          borderWidth: dark ? 0 : 1, borderColor: on ? C.ink : C.line,
        }}
      >
        {avatar ? <Avatar name={avatar.name} color={avatar.color} size={24} /> : <Icon name="account-group-outline" size={16} color={fg} />}
        <T size={TS.small} w={on ? 'semibold' : 'regular'} color={fg}>{label}</T>
      </Pressable>
    );
  };

  return (
    <HScroll style={style}>
      {chip(null, 'العائلة')}
      {members.map((m) => chip(m.id, m.displayName, { name: m.displayName, color: m.color }))}
    </HScroll>
  );
}
