import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, TS } from '../theme';
import { T } from '../ui';

// The same day-bars motif as the home screen, as the brand mark
const BARS = [0.35, 0.6, 0.45, 0.9, 0.5, 0.3, 0.7, 1.15, 0.55, 0.4, 0.8, 0.5, 0.25, 0.65];

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.paper }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
        <View
          style={{
            backgroundColor: C.ink,
            paddingTop: insets.top + 36,
            paddingHorizontal: 24,
            paddingBottom: 36,
            borderBottomLeftRadius: 32,
            borderBottomRightRadius: 32,
          }}
        >
          <T w="bold" size={40} color="#fff" style={{ lineHeight: 56 }}>مصاريفي</T>
          <T size={TS.body} color={C.inkMuted}>مصاريف العائلة وبادجتها، بمكان واحد.</T>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 4, height: 44, marginTop: 24 }}>
            {BARS.map((h, i) => (
              <View
                key={i}
                style={{ flex: 1, height: Math.min(h, 1) * 44, borderRadius: 2, backgroundColor: h > 1 ? C.pomLight : C.oasisLight, opacity: 0.85 }}
              />
            ))}
          </View>
        </View>
        <View style={{ paddingHorizontal: 20, paddingTop: 28, paddingBottom: insets.bottom + 24 }}>
          <T w="bold" size={TS.h1}>{title}</T>
          <T color={C.sub} style={{ marginTop: 2 }}>{subtitle}</T>
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
