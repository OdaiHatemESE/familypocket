import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';
import { useFamily } from '../family';
import { C, F, TS } from '../theme';
import { Expense } from '../types';
import { Avatar, CatTile, HScroll, Icon, Money, PrimaryButton, Row, T } from '../ui';
import { dayLabel, shortDay, toKey } from '../utils';
import { Sheet } from './Sheet';

const tap = () => {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
};

const lastDays = (n: number) =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return toKey(d);
  });

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'];

type Props = { visible: boolean; onClose: () => void; editing?: Expense | null };

/** Mounted fresh each time it opens, so the form always starts from `editing` */
export function ExpenseSheet(props: Props) {
  if (!props.visible) return null;
  return <ExpenseForm key={props.editing?.id ?? 'new'} {...props} />;
}

function ExpenseForm({ visible, onClose, editing }: Props) {
  const { categories, me, memberOf, addExpense, updateExpense, deleteExpense } = useFamily();
  const [busy, setBusy] = useState(false);
  const readOnly = !!editing && editing.userId !== me?.id;
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '');
  const [note, setNote] = useState(editing?.note ?? '');
  const [catId, setCatId] = useState(editing?.categoryId ?? '');
  const [date, setDate] = useState(editing?.date ?? toKey(new Date()));
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const days = lastDays(14);
  if (editing && !days.includes(editing.date)) days.push(editing.date);

  const press = (k: string) => {
    tap();
    setError('');
    setAmount((a) => {
      if (k === 'del') return a.slice(0, -1);
      if (k === '.') return a.includes('.') ? a : (a || '0') + '.';
      if (a.includes('.') && a.split('.')[1].length >= 2) return a;
      if (a.replace('.', '').length >= 7) return a;
      if (a === '0') return k;
      return a + k;
    });
  };

  const save = async () => {
    const n = parseFloat(amount);
    if (!(n > 0)) return setError('اكتب المبلغ أولاً');
    if (!catId) return setError('اختر تصنيف المصروف');
    const data = { amount: n, note: note.trim(), categoryId: catId, date, fixedId: editing?.fixedId ?? null };
    setBusy(true);
    try {
      if (editing) await updateExpense(editing.id, data);
      else await addExpense(data);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    if (!confirmDelete) return setConfirmDelete(true);
    setBusy(true);
    try {
      await deleteExpense(editing.id);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  if (readOnly && editing) {
    const owner = memberOf(editing.userId);
    const cat = categories.find((c) => c.id === editing.categoryId);
    return (
      <Sheet visible={visible} onClose={onClose} title="تفاصيل المصروف">
        <View style={{ alignItems: 'center', paddingVertical: 12, gap: 10 }}>
          <CatTile icon={cat?.icon ?? 'help'} color={cat?.color ?? C.faint} size={56} />
          <Money value={editing.amount} size={40} w="bold" decimals />
          <T w="medium" align="center">{editing.note || cat?.name}</T>
          <T size={TS.small} color={C.sub} align="center">{cat?.name}، {dayLabel(editing.date)}</T>
        </View>
        <Row style={{ backgroundColor: C.paper, borderRadius: 14, padding: 12, gap: 10, marginTop: 8, marginBottom: 12 }}>
          <Avatar name={owner?.displayName ?? '؟'} color={owner?.color ?? C.faint} size={32} />
          <T size={TS.small} color={C.sub} style={{ flex: 1 }}>
            سجّله {owner?.displayName ?? 'عضو سابق'}. صاحب المصروف بس بيقدر يعدّله أو يحذفه.
          </T>
        </Row>
      </Sheet>
    );
  }

  const display = amount ? Number(amount.split('.')[0]).toLocaleString('en-US') + (amount.includes('.') ? '.' + amount.split('.')[1] : '') : '0';

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={editing ? 'تعديل المصروف' : 'مصروف جديد'}
      footer={
        <View>
          {!!error && <T size={TS.small} color={C.pom} align="center" style={{ marginBottom: 8 }}>{error}</T>}
          <PrimaryButton label={editing ? 'حفظ التعديل' : 'سجّل المصروف'} onPress={save} busy={busy} />
          {editing && (
            <Pressable onPress={remove} disabled={busy} style={{ paddingVertical: 12 }}>
              <T size={TS.small} w="medium" color={C.pom} align="center">
                {confirmDelete ? 'اضغط مرة ثانية لتأكيد الحذف' : 'حذف المصروف'}
              </T>
            </Pressable>
          )}
        </View>
      }
    >
      {/* Amount */}
      <View style={{ alignItems: 'center', paddingVertical: 8 }}>
        <Row style={{ alignItems: 'baseline' }}>
          <T w="bold" size={48} color={amount ? C.text : C.faint} align="center" style={{ letterSpacing: -1.5, lineHeight: 64 }}>
            {display}
          </T>
          <T w="medium" size={18} color={C.sub} style={{ marginRight: 6 }}>درهم</T>
        </Row>
      </View>

      {/* Keypad (digits keep phone order, left to right) */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
        {KEYS.map((k) => (
          <View key={k} style={{ width: '33.333%', padding: 4 }}>
            <Pressable
              onPress={() => press(k)}
              style={({ pressed }) => ({
                height: 50,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: pressed ? C.line : C.paper,
              })}
            >
              {k === 'del' ? (
                <Icon name="backspace-outline" size={22} color={C.text} />
              ) : (
                <T w="semibold" size={22} align="center">{k}</T>
              )}
            </Pressable>
          </View>
        ))}
      </View>

      {/* Category */}
      <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 20, marginBottom: 10 }}>التصنيف</T>
      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', marginHorizontal: -4 }}>
        {categories.map((c) => {
          const on = c.id === catId;
          return (
            <View key={c.id} style={{ width: '25%', padding: 4 }}>
              <Pressable
                onPress={() => (tap(), setCatId(c.id), setError(''))}
                style={{
                  alignItems: 'center',
                  paddingVertical: 10,
                  borderRadius: 16,
                  borderWidth: 1.5,
                  borderColor: on ? c.color : 'transparent',
                  backgroundColor: on ? c.color + '12' : 'transparent',
                }}
              >
                <CatTile icon={c.icon} color={c.color} size={40} />
                <T size={TS.tiny} w={on ? 'semibold' : 'regular'} align="center" numberOfLines={1} style={{ marginTop: 6 }}>
                  {c.name}
                </T>
              </Pressable>
            </View>
          );
        })}
      </View>

      {/* Date */}
      <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 18, marginBottom: 10 }}>التاريخ</T>
      <HScroll>
        {days.map((d) => {
          const on = d === date;
          const s = shortDay(d);
          return (
            <Pressable
              key={d}
              onPress={() => (tap(), setDate(d))}
              style={{ width: 56, paddingVertical: 8, borderRadius: 14, alignItems: 'center', backgroundColor: on ? C.ink : C.paper }}
            >
              <T size={TS.tiny} color={on ? C.inkMuted : C.sub} align="center">{s.top}</T>
              <T w="bold" size={17} color={on ? '#fff' : C.text} align="center">{s.bottom}</T>
            </Pressable>
          );
        })}
      </HScroll>

      {/* Note */}
      <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 18, marginBottom: 10 }}>ملاحظة</T>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="مثلاً: بنزين، كارفور، قسط الباص"
        placeholderTextColor={C.faint}
        style={{
          fontFamily: F.regular,
          fontSize: TS.body,
          textAlign: 'right',
          writingDirection: 'rtl',
          color: C.text,
          backgroundColor: C.paper,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 12,
          marginBottom: 8,
        }}
      />
    </Sheet>
  );
}
