import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MonthAnalysis } from '../analysis';
import { C, F, TS } from '../theme';
import { Icon, Money, Row, T } from '../ui';
import { monthLabel, monthName, num } from '../utils';
import { ScopeSwitch } from './ScopeSwitch';

const STRIP_H = 56;

/** Counts up (or down) to `value` whenever it changes, like a meter */
function useCounter(value: number) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    const start = from.current;
    if (start === value) return;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) {
          from.current = value;
          setShown(value);
          return;
        }
        const t0 = Date.now();
        const dur = 700;
        const tick = () => {
          const p = Math.min((Date.now() - t0) / dur, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          const v = start + (value - start) * eased;
          from.current = v;
          setShown(v);
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [value]);
  return shown;
}

/** The month as a strip of days; each bar is that day's spending */
function DayStrip({ a }: { a: MonthAnalysis }) {
  const today = a.isCurrent ? new Date().getDate() : -1;
  const max = Math.max(...a.daily, 1);
  return (
    <View>
      <View style={{ height: STRIP_H, flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 2 }}>
        {a.daily.map((v, i) => {
          const day = i + 1;
          const future = a.isCurrent ? day > today : a.elapsedDays === 0;
          return (
            <View key={i} style={{ flex: 1, height: STRIP_H, justifyContent: 'flex-end' }}>
              <View
                style={{
                  height: future || v === 0 ? 3 : Math.max((v / max) * STRIP_H, 3),
                  borderRadius: 2,
                  backgroundColor: future || v === 0 ? C.inkSoft : day === today ? '#fff' : C.oasisLight,
                  opacity: day === today ? 1 : 0.85,
                }}
              />
            </View>
          );
        })}
      </View>
      <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
        <T size={TS.tiny} color={C.inkMuted}>1</T>
        <T size={TS.tiny} color={C.inkMuted}>الصرف يوم بيوم</T>
        <T size={TS.tiny} color={C.inkMuted}>{a.daysInMonth}</T>
      </Row>
    </View>
  );
}

export function Hero({ a, onPrev, onNext }: { a: MonthAnalysis; onPrev: () => void; onNext: () => void }) {
  const insets = useSafeAreaInsets();
  const shown = useCounter(a.totalSpent);
  const solo = !!a.scope;
  const remaining = a.totalBudget - a.totalSpent;
  const over = a.hasBudget && remaining < 0;
  const pct = a.hasBudget ? a.totalSpent / a.totalBudget : 0;
  const barColor = over ? C.pomLight : pct > 0.85 ? C.saffronLight : C.oasisLight;

  const label = a.isCurrent ? (solo ? 'صرفت هذا الشهر' : 'صرفنا هذا الشهر') : `مجموع صرف ${monthName(a.month)}`;

  return (
    <View
      style={{
        backgroundColor: C.ink,
        paddingTop: insets.top + 12,
        paddingHorizontal: 20,
        paddingBottom: 24,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
      }}
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <Pressable onPress={onPrev} hitSlop={14} style={{ padding: 6 }} accessibilityLabel="الشهر السابق">
          <Icon name="chevron-right" size={24} color={C.inkMuted} />
        </Pressable>
        <T w="medium" size={TS.body} color="#fff">{monthLabel(a.month)}</T>
        <Pressable onPress={onNext} hitSlop={14} style={{ padding: 6, opacity: a.isCurrent ? 0.25 : 1 }} disabled={a.isCurrent} accessibilityLabel="الشهر التالي">
          <Icon name="chevron-left" size={24} color={C.inkMuted} />
        </Pressable>
      </Row>

      <ScopeSwitch dark style={{ paddingTop: 12 }} />

      {/* The meter: total spent this month, counting up */}
      <View style={{ marginTop: 18 }} accessible accessibilityLabel={`${label} ${num(a.totalSpent)} درهم`}>
        <T size={TS.body} color={C.inkMuted}>{label}</T>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'baseline' }}>
          <Text style={{ fontFamily: F.bold, fontSize: TS.hero, color: over ? C.pomLight : '#fff', letterSpacing: -1.5, fontVariant: ['tabular-nums'] }}>
            {Math.round(shown).toLocaleString('en-US')}
          </Text>
          <Text style={{ fontFamily: F.medium, fontSize: 20, color: '#fff', opacity: 0.65, marginRight: 6 }}>درهم</Text>
        </View>
      </View>

      {a.hasBudget ? (
        <View style={{ marginTop: 10 }}>
          <View style={{ height: 10, borderRadius: 5, backgroundColor: C.inkSoft, overflow: 'hidden', flexDirection: 'row-reverse' }}>
            <View style={{ width: `${Math.min(pct, 1) * 100}%`, backgroundColor: barColor, borderRadius: 5 }} />
          </View>
          <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
            <T size={TS.small} color={C.inkMuted}>من أصل {num(a.totalBudget)} درهم ({Math.round(pct * 100)}%)</T>
            <T size={TS.small} w="semibold" color={over ? C.pomLight : C.oasisLight}>
              {over ? `تجاوز ${num(-remaining)}` : `باقي ${num(remaining)}`}
            </T>
          </Row>
        </View>
      ) : (
        <T size={TS.small} color={C.inkMuted} style={{ marginTop: 6 }}>
          ما في بادجت لهذا الشهر. حدّده من الإعدادات ← البادجت الشهري.
        </T>
      )}

      <View style={{ marginTop: 22 }}>
        <DayStrip a={a} />
      </View>

      <Row style={{ marginTop: 18, gap: 12 }}>
        {a.isCurrent && (
          <>
            <Figure label="اليوم" value={a.todaySpent} />
            <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: C.inkSoft }} />
          </>
        )}
        <Figure label="متوسط اليوم" value={a.dailyAvg} />
        <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: C.inkSoft }} />
        <Figure label="إجباري لسه ما انتدفع" value={a.pendingFixed} color={a.pendingFixed ? C.saffronLight : '#fff'} />
      </Row>
    </View>
  );
}

function Figure({ label, value, color = '#fff' }: { label: string; value: number; color?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <T size={TS.tiny} color={C.inkMuted} numberOfLines={1}>{label}</T>
      <Money value={value} size={17} color={color} />
    </View>
  );
}
