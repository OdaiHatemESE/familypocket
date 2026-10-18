import React, { useRef, useState } from 'react';
import { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, TS } from '../theme';
import { Icon, IconName, T } from '../ui';
import { Logo } from './Logo';

type Slide = { key: string; title: string; body: string; art: React.ReactNode };

const glass = { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' } as const;

function Line({ name, qty, amount, check = true }: { name: string; qty: string; amount: string; check?: boolean }) {
  return (
    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
      {check && <Icon name="check-circle" size={16} color={C.oasisLight} />}
      <View style={{ flex: 1 }}>
        <T size={TS.small} w="medium" color="#fff">{name}</T>
        <T size={TS.tiny} color={C.inkMuted}>{qty}</T>
      </View>
      <T size={TS.small} w="semibold" color="#fff">{amount}</T>
    </View>
  );
}

function Feature({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(46,230,166,0.12)' }}>
      <Icon name={icon} size={15} color={C.oasisLight} />
      <T size={TS.tiny} w="semibold" color={C.oasisLight}>{label}</T>
    </View>
  );
}

const SLIDES: Slide[] = [
  {
    key: 'hello',
    title: 'قديش صرفنا؟ وقديش ضايل؟',
    body: 'قديش بيجاوبك. مصاريف العيلة وبادجتها والتزاماتها، كلها بمكان واحد وبالدرهم.',
    art: (
      <View style={{ alignItems: 'center', gap: 18 }}>
        <View style={{ width: 168, height: 168, borderRadius: 44, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(46,230,166,0.25)' }}>
          <Logo size={112} tone="light" />
        </View>
        <T w="bold" size={44} color="#fff" align="center" style={{ lineHeight: 60 }}>قديش</T>
      </View>
    ),
  },
  {
    key: 'receipt',
    title: 'صوّر الفاتورة، والباقي علينا',
    body: 'صورة، أو كم صورة لفاتورة طويلة، أو ملف PDF. بنقرأ الأصناف والكميات والأسعار، وإنت بس بتراجع وبتحفظ.',
    art: (
      <View style={{ ...glass, padding: 16, width: '100%', maxWidth: 320 }}>
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <T w="semibold" color="#fff">كارفور</T>
          <T size={TS.tiny} color={C.inkMuted}>14 أكتوبر</T>
        </View>
        <Line name="خبز أسمر" qty="2 ربطة" amount="8" />
        <Line name="شوكولاتة بندق" qty="3 حبة" amount="15" />
        <Line name="دواء جلي ليمون" qty="2 علبة" amount="31.5" />
        <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          <Feature icon="camera-outline" label="صورة" />
          <Feature icon="image-multiple-outline" label="كم صورة" />
          <Feature icon="file-pdf-box" label="PDF" />
        </View>
      </View>
    ),
  },
  {
    key: 'salary',
    title: 'الراتب أول، والالتزامات قبل كل إشي',
    body: 'شيكات الإيجار، المدارس، الفواتير، والتحويل للأهل. بنجنّب لكل التزام حصته كل شهر، وبتعرف بالضبط قديش ضايل للمصروف.',
    art: (
      <View style={{ ...glass, padding: 16, width: '100%', maxWidth: 320, gap: 10 }}>
        {[
          ['الراتب', '31,000', '#fff'],
          ['الالتزامات', '− 15,200', C.inkMuted],
        ].map(([k, v, c]) => (
          <View key={k} style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
            <T color={C.inkMuted}>{k}</T>
            <T w="semibold" color={c}>{v}</T>
          </View>
        ))}
        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <T w="semibold" color="#fff">ضايل للمصروف</T>
          <T w="bold" size={24} color={C.oasisLight}>15,800</T>
        </View>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', flexDirection: 'row-reverse' }}>
          <View style={{ width: '38%', backgroundColor: C.oasisLight }} />
        </View>
        <View style={{ flexDirection: 'row-reverse', gap: 6, flexWrap: 'wrap' }}>
          <Feature icon="home-city-outline" label="إيجار بشيكات" />
          <Feature icon="school-outline" label="مدارس" />
          <Feature icon="bank-transfer" label="تحويل للأهل" />
        </View>
      </View>
    ),
  },
  {
    key: 'family',
    title: 'كل العيلة على نفس الحساب',
    body: 'كل فرد بحسابه وبادجته. بتسجّل مصروفك أو مصروف حدا من العيلة، وبتشوفوا مع بعض وين راحت المصاري، صنف صنف.',
    art: (
      <View style={{ ...glass, padding: 16, width: '100%', maxWidth: 320, gap: 14 }}>
        {[
          ['ي', '#2E5EAA', 'يمش', 0.62],
          ['ر', '#B23A58', 'رنا', 0.41],
        ].map(([a, color, name, pct]) => (
          <View key={name as string} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: color as string, alignItems: 'center', justifyContent: 'center' }}>
              <T w="bold" color="#fff">{a as string}</T>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <T size={TS.small} w="medium" color="#fff">{name as string}</T>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', flexDirection: 'row-reverse' }}>
                <View style={{ width: `${(pct as number) * 100}%`, borderRadius: 3, backgroundColor: C.oasisLight }} />
              </View>
            </View>
          </View>
        ))}
        <View style={{ flexDirection: 'row-reverse', gap: 6, flexWrap: 'wrap' }}>
          <Feature icon="chart-donut" label="بادجت لكل فرد" />
          <Feature icon="shape-outline" label="تحليل بالأنواع" />
        </View>
      </View>
    ),
  },
  {
    key: 'ask',
    title: 'اسأل قديش',
    body: 'اسأل عن مصاريفك بكلامك، أو احكيله شو اشتريت وبيسجّلها فاتورة. أسرع من أي جدول.',
    art: (
      <View style={{ width: '100%', maxWidth: 320, gap: 10 }}>
        <View style={{ alignSelf: 'flex-end', maxWidth: '82%', backgroundColor: C.oasisLight, borderRadius: 18, borderBottomRightRadius: 4, paddingVertical: 10, paddingHorizontal: 14 }}>
          <T w="medium" color={C.ink}>قديش صرفنا على الخبز هالشهر؟</T>
        </View>
        <View style={{ alignSelf: 'flex-start', maxWidth: '86%', ...glass, borderRadius: 18, borderBottomLeftRadius: 4, paddingVertical: 10, paddingHorizontal: 14 }}>
          <T color="#fff">96 درهم على الخبز: الأسمر 60 والأبيض 36. أقل من الشهر الماضي بـ 12 درهم.</T>
        </View>
        <View style={{ alignSelf: 'flex-end', maxWidth: '82%', backgroundColor: C.oasisLight, borderRadius: 18, borderBottomRightRadius: 4, paddingVertical: 10, paddingHorizontal: 14 }}>
          <T w="medium" color={C.ink}>اشتريت 2 كيلو بندورة بـ 8</T>
        </View>
      </View>
    ),
  },
];

/** The intro: what قديش is and how to use it. Swipe or tap through; skip any time. */
export function Onboarding({ onDone, doneLabel = 'يلا نبلّش' }: { onDone: () => void; doneLabel?: string }) {
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [index, setIndex] = useState(0);
  const n = SLIDES.length;
  // Arabic reads right to left: the scroller is mirrored, so the first slide sits on the right and the next comes
  // in from the left; each slide is mirrored back
  const go = (i: number) => scroll.current?.scrollTo({ x: i * size.width, animated: true });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.width || height !== size.height) setSize({ width, height });
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!size.width) return;
    const i = Math.min(n - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / size.width)));
    if (i !== index) setIndex(i);
  };
  const last = index === n - 1;

  return (
    <View style={{ flex: 1, backgroundColor: C.ink }}>
      <View style={{ position: 'absolute', top: -120, left: -80, width: 360, height: 360, borderRadius: 180, backgroundColor: 'rgba(46,230,166,0.10)' }} />
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingTop: insets.top + 10, paddingHorizontal: 20, height: insets.top + 54 }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
          <Logo size={26} tone="light" />
          <T w="bold" color="#fff">قديش</T>
        </View>
        {!last && (
          <Pressable onPress={onDone} hitSlop={10} accessibilityRole="button">
            <T w="medium" color={C.inkMuted}>تخطّي</T>
          </Pressable>
        )}
      </View>

      <ScrollView
        ref={scroll}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onLayout={onLayout}
        style={{ flex: 1, transform: [{ scaleX: -1 }] }}
      >
        {SLIDES.map((s) => (
          <View key={s.key} style={{ width: size.width || 1, height: size.height || undefined, paddingHorizontal: 24, justifyContent: 'center', transform: [{ scaleX: -1 }] }}>
            <View style={{ alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>{s.art}</View>
            <View style={{ marginTop: 34 }}>
              <T w="bold" size={26} color="#fff" style={{ lineHeight: 38 }}>{s.title}</T>
              <T size={TS.body} color={C.inkMuted} style={{ marginTop: 10, lineHeight: 24 }}>{s.body}</T>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 20, paddingTop: 12, gap: 18 }}>
        <View style={{ flexDirection: 'row-reverse', gap: 6, justifyContent: 'center' }}>
          {SLIDES.map((s, i) => (
            <Pressable key={s.key} onPress={() => go(i)} hitSlop={6} accessibilityLabel={`الخطوة ${i + 1}`}>
              <View style={{ width: i === index ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === index ? C.oasisLight : 'rgba(255,255,255,0.2)' }} />
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={() => (last ? onDone() : go(index + 1))}
          accessibilityRole="button"
          style={({ pressed }) => ({
            backgroundColor: C.oasisLight, borderRadius: 16, paddingVertical: 16, alignItems: 'center',
            flexDirection: 'row-reverse', justifyContent: 'center', gap: 8, opacity: pressed ? 0.85 : 1,
          })}
        >
          <T w="bold" size={16} color={C.ink}>{last ? doneLabel : 'التالي'}</T>
          <Icon name={last ? 'check' : 'arrow-left'} size={20} color={C.ink} />
        </Pressable>
      </View>
    </View>
  );
}
