import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MonthAnalysis } from '../analysis';
import { C, TS } from '../theme';
import { Icon, Money, Row, T } from '../ui';
import { monthLabel, num } from '../utils';

const STRIP_H = 64;
const CAP = 2; // a day at 2× the daily allowance fills the full height

/**
 * The month as a strip of days. Each day's bar is that day's spend measured
 * against the daily allowance (the dashed line).
 */
function DayStrip({ a }: { a: MonthAnalysis }) {
  const today = a.isCurrent ? new Date().getDate() : -1;
  const allowance = a.dailyAllowance || 1;
  const lineY = STRIP_H / CAP;
  return (
    <View>
      <View style={{ height: STRIP_H, flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 2 }}>
        {a.daily.map((v, i) => {
          const day = i + 1;
          const future = a.isCurrent ? day > today : a.elapsedDays === 0;
          const ratio = Math.min(v / allowance, CAP) / CAP;
          const over = v > allowance;
          const color = over ? C.pomLight : C.oasisLight;
          return (
            <View key={i} style={{ flex: 1, height: STRIP_H, justifyContent: 'flex-end' }}>
              {future ? (
                <View style={{ height: 3, borderRadius: 2, backgroundColor: C.inkSoft }} />
              ) : (
                <View
                  style={{
                    height: Math.max(ratio * STRIP_H, 3),
                    borderRadius: 2,
                    backgroundColor: v === 0 ? C.inkSoft : color,
                    opacity: day === today ? 1 : 0.85,
                  }}
                />
              )}
              {day === today && (
                <View style={{ position: 'absolute', bottom: -9, alignSelf: 'center', width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff' }} />
              )}
            </View>
          );
        })}
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, right: 0, bottom: lineY, borderTopWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.35)' }}
        />
      </View>
      <Row style={{ justifyContent: 'space-between', marginTop: 12 }}>
        <T size={TS.tiny} color={C.inkMuted}>1</T>
        <T size={TS.tiny} color={C.inkMuted}>الخط = حصتك اليومية ({num(allowance)} درهم)</T>
        <T size={TS.tiny} color={C.inkMuted}>{a.daysInMonth}</T>
      </Row>
    </View>
  );
}

export function Hero({
  a,
  onPrev,
  onNext,
}: {
  a: MonthAnalysis;
  onPrev: () => void;
  onNext: () => void;
}) {
  const insets = useSafeAreaInsets();
  const remaining = a.totalBudget - a.totalSpent;
  const overMonth = remaining < 0;

  let label: string;
  let value: number;
  let valueColor = '#fff';
  if (a.isCurrent && !overMonth) {
    label = 'تقدر تصرف اليوم';
    value = Math.max(a.safeDaily - a.todaySpent, 0);
    if (a.todaySpent > a.safeDaily) {
      label = 'تجاوزت حصة اليوم بـ';
      value = a.todaySpent - a.safeDaily;
      valueColor = C.pomLight;
    }
  } else if (overMonth) {
    label = 'تجاوزت بادجت الشهر بـ';
    value = -remaining;
    valueColor = C.pomLight;
  } else {
    label = `مجموع صرف ${monthLabel(a.month)}`;
    value = a.totalSpent;
  }

  return (
    <View
      style={{
        backgroundColor: C.ink,
        paddingTop: insets.top + 12,
        paddingHorizontal: 20,
        paddingBottom: 28,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
      }}
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <Pressable onPress={onPrev} hitSlop={14} style={{ padding: 6 }}>
          <Icon name="chevron-right" size={24} color={C.inkMuted} />
        </Pressable>
        <T w="medium" size={TS.body} color="#fff">{monthLabel(a.month)}</T>
        <Pressable onPress={onNext} hitSlop={14} style={{ padding: 6, opacity: a.isCurrent ? 0.25 : 1 }} disabled={a.isCurrent}>
          <Icon name="chevron-left" size={24} color={C.inkMuted} />
        </Pressable>
      </Row>

      <View style={{ marginTop: 18 }}>
        <T size={TS.body} color={C.inkMuted}>{label}</T>
        <Money value={value} size={TS.hero} color={valueColor} w="bold" />
        {a.isCurrent && !overMonth && a.daysLeft > 0 && (
          <T size={TS.small} color={C.inkMuted}>
            حتى تخلص الشهر ضمن البادجت، حصتك {num(a.safeDaily)} درهم باليوم لـ {a.daysLeft} يوم.
          </T>
        )}
      </View>

      <View style={{ marginTop: 22 }}>
        <DayStrip a={a} />
      </View>

      <Row style={{ marginTop: 22, gap: 12 }}>
        <Figure label="صرفت" value={a.totalSpent} />
        <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: C.inkSoft }} />
        <Figure label="البادجت" value={a.totalBudget} />
        <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: C.inkSoft }} />
        <Figure
          label={overMonth ? 'التجاوز' : 'الباقي'}
          value={Math.abs(remaining)}
          color={overMonth ? C.pomLight : C.oasisLight}
        />
      </Row>
    </View>
  );
}

function Figure({ label, value, color = '#fff' }: { label: string; value: number; color?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <T size={TS.tiny} color={C.inkMuted}>{label}</T>
      <Money value={value} size={17} color={color} />
    </View>
  );
}
