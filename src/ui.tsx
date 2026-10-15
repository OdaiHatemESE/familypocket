import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleProp, Text, TextInput, TextInputProps, TextProps, TextStyle, View, ViewStyle } from 'react-native';
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

export function PrimaryButton({
  label,
  onPress,
  tone = 'ink',
  busy = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  tone?: 'ink' | 'oasis' | 'danger';
  busy?: boolean;
  disabled?: boolean;
}) {
  const bg = tone === 'ink' ? C.ink : tone === 'oasis' ? C.oasis : C.pom;
  return (
    <Pressable
      onPress={busy || disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled }}
      style={({ pressed }) => ({
        backgroundColor: bg,
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
        opacity: disabled ? 0.45 : pressed || busy ? 0.8 : 1,
      })}
    >
      {busy ? <ActivityIndicator color="#fff" /> : <T w="bold" size={16} color="#fff" align="center">{label}</T>}
    </Pressable>
  );
}

/** Labelled text input. `ltr` for usernames and passwords. */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secure,
  ltr,
  keyboardType,
  autoFocus,
  hint,
  onSubmitEditing,
  returnKeyType,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secure?: boolean;
  ltr?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  autoFocus?: boolean;
  hint?: string;
  onSubmitEditing?: () => void;
  returnKeyType?: TextInputProps['returnKeyType'];
}) {
  const [hidden, setHidden] = React.useState(true);
  return (
    <View style={{ marginTop: 14 }}>
      <T w="semibold" size={TS.small} color={C.sub} style={{ marginBottom: 6 }}>{label}</T>
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: C.paper, borderRadius: 14, borderWidth: 1, borderColor: C.line }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.faint}
          secureTextEntry={secure && hidden}
          autoCapitalize={ltr ? 'none' : 'sentences'}
          autoCorrect={!ltr}
          keyboardType={keyboardType}
          autoFocus={autoFocus}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          style={{
            flex: 1,
            minWidth: 0,
            width: '100%',
            fontFamily: F.regular,
            fontSize: TS.body,
            color: C.text,
            textAlign: 'right',
            writingDirection: ltr ? 'ltr' : 'rtl',
            paddingHorizontal: 14,
            paddingVertical: 13,
          }}
        />
        {secure && (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} style={{ paddingHorizontal: 12 }} accessibilityLabel={hidden ? 'إظهار كلمة المرور' : 'إخفاء كلمة المرور'}>
            <Icon name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={C.faint} />
          </Pressable>
        )}
      </View>
      {!!hint && <T size={TS.tiny} color={C.faint} style={{ marginTop: 4 }}>{hint}</T>}
    </View>
  );
}

/** Round initial badge for a family member */
export function Avatar({ name, color, size = 36 }: { name: string; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: F.bold, fontSize: size * 0.42, color: '#fff' }}>{(name.trim()[0] ?? '؟').toUpperCase()}</Text>
    </View>
  );
}

/** Settings-style row: icon, title, optional detail, chevron */
export function ListRow({
  icon,
  iconColor = C.ink,
  title,
  detail,
  onPress,
  last,
  danger,
  right,
}: {
  icon?: string;
  iconColor?: string;
  title: string;
  detail?: string;
  onPress?: () => void;
  last?: boolean;
  danger?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({ flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: pressed ? C.paper : 'transparent' })}
    >
      {icon && <CatTile icon={icon} color={danger ? C.pom : iconColor} size={36} />}
      <View style={{ flex: 1, marginRight: icon ? 12 : 0 }}>
        <T w="medium" color={danger ? C.pom : C.text}>{title}</T>
        {!!detail && <T size={TS.small} color={C.sub}>{detail}</T>}
      </View>
      {right ?? (onPress && !danger ? <Icon name="chevron-left" size={22} color={C.faint} /> : null)}
      {!last && <View style={{ position: 'absolute', bottom: 0, left: 16, right: icon ? 64 : 16, height: 1, backgroundColor: C.line }} />}
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ backgroundColor: C.surface, borderRadius: 20, overflow: 'hidden' }, style]}>{children}</View>;
}

export function ErrorText({ text }: { text: string }) {
  if (!text) return null;
  return (
    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: C.pom + '14', borderRadius: 12, padding: 10, marginTop: 14 }}>
      <Icon name="alert-circle-outline" size={18} color={C.pom} />
      <T size={TS.small} color={C.pom} style={{ flex: 1 }}>{text}</T>
    </View>
  );
}
