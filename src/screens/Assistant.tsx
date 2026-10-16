import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { qtyLabel } from '../budgets';
import { AssistantReply, ChatTurn, useFamily } from '../family';
import { useTabs } from '../tabsContext';
import { C, F, TS } from '../theme';
import { ExpenseLine } from '../types';
import { Icon, Money, Row, T } from '../ui';
import { dayLabel, num } from '../utils';

type Msg =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'assistant'; text: string; draft?: Extract<AssistantReply, { kind: 'receipt' }>['draft'] }
  | { id: number; role: 'error'; text: string; retry: string };

const SUGGESTIONS = [
  'قديش صرفنا هالشهر؟',
  'وين راحت أغلب المصاري الشهر الماضي؟',
  'مين صرف أكثر هالشهر؟',
  'اشتريت 2 كيلو بندورة بـ 8 دراهم وربطة خبز بـ 3',
];

export function Assistant() {
  const insets = useSafeAreaInsets();
  const { askAssistant } = useFamily();
  const { openDraft } = useTabs();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const scroller = useRef<ScrollView>(null);
  const nextId = useRef(1);

  const send = async (raw: string) => {
    const message = raw.trim();
    if (!message || busy) return;
    const history: ChatTurn[] = msgs
      .filter((m) => m.role !== 'error')
      .map((m) => ({ role: m.role as 'user' | 'assistant', text: m.text }));
    setMsgs((ms) => [...ms.filter((m) => m.role !== 'error'), { id: nextId.current++, role: 'user', text: message }]);
    setText('');
    setBusy(true);
    try {
      const r = await askAssistant(message, history);
      setMsgs((ms) => [...ms, { id: nextId.current++, role: 'assistant', text: r.answer, draft: r.kind === 'receipt' ? r.draft : undefined }]);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      setMsgs((ms) => [...ms, { id: nextId.current++, role: 'error', text: (e as Error).message, retry: message }]);
    }
    setBusy(false);
  };

  const review = (m: Extract<Msg, { role: 'assistant' }>) => {
    if (!m.draft) return;
    const lines: ExpenseLine[] = m.draft.lines.map((l) => ({
      itemId: l.itemId,
      name: l.name,
      unit: l.unit,
      categoryId: l.categoryId ?? '',
      quantity: l.quantity,
      amount: l.amount,
      uncertain: l.uncertain,
      needsPrice: l.needsPrice,
    }));
    // Spoken words are not receipt text, so no `raw` here: nothing is learned as a shop alias
    openDraft({ lines, date: m.draft.date, note: m.draft.store, warnings: m.draft.warnings });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.paper }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 10, backgroundColor: C.paper, borderBottomWidth: 1, borderColor: C.line }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row style={{ gap: 10, flexShrink: 1 }}>
            <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="creation" size={22} color={C.oasisLight} />
            </View>
            <View style={{ flexShrink: 1 }}>
              <T w="bold" size={TS.h2}>المساعد</T>
              <T size={TS.tiny} color={C.sub}>بيجاوب من أرقامكم، وبيسجّل مشترياتك من كلامك</T>
            </View>
          </Row>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            hitSlop={12}
            accessibilityLabel="رجوع"
            style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="close" size={22} color={C.text} />
          </Pressable>
        </Row>
      </View>

      <ScrollView
        ref={scroller}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 10, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
      >
        {msgs.length === 0 && (
          <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 24 }}>
            <T w="bold" size={TS.h1} align="center">شو بدك تعرف؟</T>
            <T color={C.sub} align="center" style={{ marginTop: 6, marginBottom: 20 }}>
              اسأل عن مصاريفكم، أو احكيلي شو اشتريت وأنا بجهّزلك الفاتورة.
            </T>
            <View style={{ gap: 8 }}>
              {SUGGESTIONS.map((s, i) => (
                <Pressable
                  key={s}
                  onPress={() => send(s)}
                  style={({ pressed }) => ({
                    flexDirection: 'row-reverse', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16,
                    backgroundColor: pressed ? C.line : C.surface,
                  })}
                >
                  <Icon name={i === SUGGESTIONS.length - 1 ? 'cart-outline' : 'chat-question-outline'} size={20} color={C.oasis} />
                  <T style={{ flex: 1 }}>{s}</T>
                </Pressable>
              ))}
            </View>
            <Row style={{ gap: 6, justifyContent: 'center', marginTop: 18 }}>
              <Icon name="microphone-outline" size={16} color={C.faint} />
              <T size={TS.small} color={C.faint}>بتقدر تحكي بدل ما تكتب: اضغط المايك بالكيبورد</T>
            </Row>
          </View>
        )}

        {msgs.map((m) => {
          if (m.role === 'user') {
            return (
              <View key={m.id} style={{ alignSelf: 'flex-end', maxWidth: '85%', backgroundColor: C.ink, borderRadius: 18, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 10 }}>
                <T color="#fff">{m.text}</T>
              </View>
            );
          }
          if (m.role === 'error') {
            return (
              <View key={m.id} style={{ alignSelf: 'flex-start', maxWidth: '88%', backgroundColor: C.pom + '12', borderRadius: 18, borderBottomLeftRadius: 6, padding: 14, gap: 8 }}>
                <T color={C.pom}>{m.text}</T>
                <Pressable onPress={() => send(m.retry)} hitSlop={8}>
                  <T w="semibold" size={TS.small} color={C.pom}>جرّب مرة ثانية</T>
                </Pressable>
              </View>
            );
          }
          return (
            <View key={m.id} style={{ alignSelf: 'flex-start', width: m.draft ? '92%' : undefined, maxWidth: '92%', backgroundColor: C.surface, borderRadius: 18, borderBottomLeftRadius: 6, padding: 14 }}>
              <T>{m.text}</T>
              {m.draft && <DraftCard draft={m.draft} onReview={() => review(m)} />}
            </View>
          );
        })}

        {busy && (
          <Row style={{ alignSelf: 'flex-start', gap: 8, backgroundColor: C.surface, borderRadius: 18, borderBottomLeftRadius: 6, paddingHorizontal: 14, paddingVertical: 12 }}>
            <ActivityIndicator size="small" color={C.oasis} />
            <T size={TS.small} color={C.sub}>عم بفكّر…</T>
          </Row>
        )}
      </ScrollView>

      {/* Input */}
      <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: C.surface, borderTopWidth: 1, borderColor: C.line }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="اسأل، أو اكتب شو اشتريت…"
          placeholderTextColor={C.faint}
          multiline
          maxLength={1500}
          onSubmitEditing={() => send(text)}
          submitBehavior="submit"
          returnKeyType="send"
          accessibilityLabel="رسالة للمساعد"
          style={{
            flex: 1, minWidth: 0, maxHeight: 120, fontFamily: F.regular, fontSize: TS.body, color: C.text,
            textAlign: 'right', writingDirection: 'rtl', backgroundColor: C.paper, borderRadius: 20,
            paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11,
          }}
        />
        <Pressable
          onPress={() => send(text)}
          disabled={!text.trim() || busy}
          accessibilityLabel="إرسال"
          style={({ pressed }) => ({
            width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
            backgroundColor: text.trim() && !busy ? C.oasis : C.track, transform: [{ scale: pressed ? 0.94 : 1 }],
          })}
        >
          {/* Mirrored so the arrow points left, the direction Arabic text flows */}
          <View style={{ transform: [{ scaleX: -1 }] }}>
            <Icon name="send" size={20} color={text.trim() && !busy ? '#fff' : C.faint} />
          </View>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function DraftCard({ draft, onReview }: { draft: Extract<AssistantReply, { kind: 'receipt' }>['draft']; onReview: () => void }) {
  const total = draft.lines.reduce((a, l) => a + l.amount, 0);
  const unpriced = draft.lines.filter((l) => l.needsPrice).length;
  return (
    <View style={{ marginTop: 12, backgroundColor: C.paper, borderRadius: 14, overflow: 'hidden' }}>
      <Row style={{ justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 }}>
        <Row style={{ gap: 6 }}>
          <Icon name="receipt-text-outline" size={16} color={C.sub} />
          <T size={TS.small} w="semibold" color={C.sub}>{draft.store || 'فاتورة'}</T>
        </Row>
        <T size={TS.tiny} color={C.sub}>{draft.date ? dayLabel(draft.date) : 'اليوم'}</T>
      </Row>
      {draft.lines.map((l, i) => (
        <Row key={i} style={{ paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderColor: C.line, gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Row style={{ gap: 6 }}>
              <T w="medium" numberOfLines={1} style={{ flexShrink: 1 }}>{l.name}</T>
              {!l.itemId && (
                <View style={{ backgroundColor: C.oasis + '18', borderRadius: 999, paddingHorizontal: 6 }}>
                  <T size={TS.tiny} w="semibold" color={C.oasis}>جديد</T>
                </View>
              )}
            </Row>
            <T size={TS.tiny} color={C.sub}>{qtyLabel(l.quantity, l.unit)}{l.amount > 0 && l.quantity > 0 ? `، ${num(l.amount / l.quantity)} للـ${l.unit}` : ''}</T>
          </View>
          {l.needsPrice ? <T size={TS.small} w="semibold" color={C.saffron}>بدون سعر</T> : <Money value={l.amount} decimals size={TS.small} />}
        </Row>
      ))}
      <Row style={{ justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderColor: C.line }}>
        <T size={TS.small} color={C.sub}>{unpriced ? `المجموع بدون ${unpriced === 1 ? 'صنف واحد' : `${unpriced} أصناف`}` : 'المجموع'}</T>
        <Money value={total} decimals w="bold" />
      </Row>
      <Pressable
        onPress={onReview}
        accessibilityRole="button"
        style={({ pressed }) => ({ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, backgroundColor: pressed ? C.inkSoft : C.ink })}
      >
        <Icon name="check-circle-outline" size={18} color="#fff" />
        <T w="semibold" color="#fff">راجع وسجّل</T>
      </Pressable>
    </View>
  );
}
