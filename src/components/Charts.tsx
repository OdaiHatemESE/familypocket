import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { C, TS } from '../theme';
import { Money, T } from '../ui';

export function Donut({
  data,
  size = 168,
  stroke = 18,
  label,
  value,
}: {
  data: { value: number; color: string }[];
  size?: number;
  stroke?: number;
  label: string;
  value: number;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const total = data.reduce((a, d) => a + d.value, 0);
  const segs = data.filter((d) => d.value > 0);
  let offset = 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.track} strokeWidth={stroke} fill="none" />
          {total > 0 &&
            segs.map((d, i) => {
              const len = (d.value / total) * circ;
              const gap = segs.length > 1 ? 3 : 0;
              const el = (
                <Circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  stroke={d.color}
                  strokeWidth={stroke}
                  fill="none"
                  strokeDasharray={`${Math.max(len - gap, 0.1)} ${circ}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += len;
              return el;
            })}
        </G>
      </Svg>
      <T size={TS.tiny} color={C.sub} align="center">{label}</T>
      <Money value={value} size={20} w="bold" />
    </View>
  );
}

/** Ring showing how much of a budget is used */
export function Ring({ pct, color, size = 46, stroke = 5 }: { pct: number; color: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const p = Math.min(Math.max(pct, 0), 1);
  return (
    <Svg width={size} height={size}>
      <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.track} strokeWidth={stroke} fill="none" />
        {p > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${p * circ} ${circ}`}
          />
        )}
      </G>
    </Svg>
  );
}

/** Vertical bars with labels; optional reference line */
export function Columns({
  items,
  height = 150,
  reference,
  referenceLabel,
}: {
  items: { label: string; value: number; color: string; caption?: string }[];
  height?: number;
  reference?: number;
  referenceLabel?: string;
}) {
  const max = Math.max(...items.map((i) => i.value), reference ?? 0, 1) * 1.08;
  return (
    <View>
      <View style={{ height, flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 10 }}>
        {items.map((it, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height }}>
            {!!it.caption && (
              <T size={TS.tiny} color={C.sub} align="center" style={{ marginBottom: 2 }}>{it.caption}</T>
            )}
            <View
              style={{
                width: '72%',
                height: Math.max((it.value / max) * (height - 22), it.value > 0 ? 3 : 1),
                backgroundColor: it.color,
                borderTopLeftRadius: 6,
                borderTopRightRadius: 6,
              }}
            />
          </View>
        ))}
        {reference !== undefined && reference > 0 && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute', left: 0, right: 0,
              bottom: (reference / max) * (height - 22),
              borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: C.saffron,
            }}
          />
        )}
      </View>
      <View style={{ height: 1, backgroundColor: C.line }} />
      <View style={{ flexDirection: 'row-reverse', gap: 10, marginTop: 6 }}>
        {items.map((it, i) => (
          <T key={i} size={TS.tiny} color={C.sub} align="center" style={{ flex: 1 }}>{it.label}</T>
        ))}
      </View>
      {!!referenceLabel && (
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginTop: 10 }}>
          <View style={{ width: 16, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: C.saffron }} />
          <T size={TS.tiny} color={C.sub}>{referenceLabel}</T>
        </View>
      )}
    </View>
  );
}
