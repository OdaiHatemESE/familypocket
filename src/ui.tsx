import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StyleProp, Text, TextProps, TextStyle, View, ViewStyle } from 'react-native';
import { C, F, TS } from './theme';

type Weight = 'regular' | 'medium' | 'semibold' | 'bold';

/** Arabic text: Plex font, right aligned, RTL bidi */
export function T({
  w = 'regular',
  size = TS.body,
  color = C.text,
  align = 'right',
  style,
  ...rest
}: TextProps & { w?: Weight; size?: number; color?: string; align?: 'right' | 'left' | 'center'; style?: StyleProp<TextStyle> }) {
  return (
    <Text
      {...rest}
      style={[
        { fontFamily: F[w], fontSize: size, color, textAlign: align, writingDirection: 'rtl', lineHeight: Math.round(size * 1.5) },
        style,
      ]}
    />
  );
}

/** Number + small currency, laid out right-to-left */
export function Money({
  value,
  size = TS.body,
  color = C.text,
  w = 'semibold',
  decimals = false,
}: {
  value: number;
  size?: number;
  color?: string;
  w?: Weight;
  decimals?: boolean;
}) {
  const n = decimals
    ? value.toLocaleString('en-US', { maximumFractionDigits: 2 })
    : Math.round(value).toLocaleString('en-US');
  return (
    <View style={{ flexDirection: 'row-reverse', alignItems: 'baseline' }}>
      <Text style={{ fontFamily: F[w], fontSize: size, color, letterSpacing: size > 30 ? -1.5 : 0 }}>{n}</Text>
      <Text style={{ fontFamily: F.medium, fontSize: Math.max(11, size * 0.38), color, opacity: 0.65, marginRight: 4 }}>
        درهم
      </Text>
    </View>
  );
}

export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Icon({ name, size = 22, color = C.text }: { name: IconName; size?: number; color?: string }) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}

/** Category icon tile — squircle tinted with the category colour */
export function CatTile({ icon, color, size = 42 }: { icon: string; color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: color + '1F',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={icon as IconName} size={size * 0.52} color={color} />
    </View>
  );
}

export function Row({ style, children }: { style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  return <View style={[{ flexDirection: 'row-reverse', alignItems: 'center' }, style]}>{children}</View>;
}

export function Bar({ pct, color, height = 6, track = C.track }: { pct: number; color: string; height?: number; track?: string }) {
  const p = Math.min(Math.max(pct, 0), 1);
  return (
    <View style={{ height, backgroundColor: track, borderRadius: height, overflow: 'hidden', flexDirection: 'row-reverse' }}>
      <View style={{ width: `${p * 100}%`, backgroundColor: color, borderRadius: height }} />
    </View>
  );
}

export function SectionHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: 28, marginBottom: 12 }}>
      <T w="bold" size={TS.h2}>{title}</T>
      {action && (
        <Pressable onPress={onAction} hitSlop={10}>
          <T w="medium" size={TS.small} color={C.oasis}>{action}</T>
        </Pressable>
      )}
    </Row>
  );
}

/** Horizontal scroller that starts from the right edge (RTL) */
export function HScroll({ children, gap = 8, style }: { children: React.ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  const ref = React.useRef<ScrollView>(null);
  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      onContentSizeChange={() => ref.current?.scrollToEnd({ animated: false })}
      contentContainerStyle={[{ flexDirection: 'row-reverse', gap }, style]}
    >
      {children}
    </ScrollView>
  );
}

export function Chip({ label, on, onPress, icon }: { label: string; on: boolean; onPress: () => void; icon?: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: on ? C.ink : C.surface,
        borderWidth: 1,
        borderColor: on ? C.ink : C.line,
      }}
    >
      {icon && <Icon name={icon as IconName} size={15} color={on ? '#fff' : C.sub} />}
      <T size={TS.small} w={on ? 'semibold' : 'regular'} color={on ? '#fff' : C.text}>{label}</T>
    </Pressable>
  );
}

export function PrimaryButton({ label, onPress, tone = 'ink' }: { label: string; onPress: () => void; tone?: 'ink' | 'oasis' }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: tone === 'ink' ? C.ink : C.oasis,
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <T w="bold" size={16} color="#fff" align="center">{label}</T>
    </Pressable>
  );
}
