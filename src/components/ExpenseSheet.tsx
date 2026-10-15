import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';
import { useStore } from '../store';
import { C, F, TS } from '../theme';
import { Expense } from '../types';
import { CatTile, HScroll, Icon, PrimaryButton, Row, T } from '../ui';
import { shortDay, toKey } from '../utils';
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

export function ExpenseSheet({ visible, onClose, editing }: { visible: boolean; onClose: () => void; editing?: Expense | null }) {
  const { categories, addExpense, updateExpense, deleteExpense } = useStore();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [catId, setCatId] = useState('');
  const [date, setDate] = useState(toKey(new Date()));
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setError('');
    setConfirmDelete(false);
    setAmount(editing ? String(editing.amount) : '');
    setNote(editing?.note ?? '');
    setCatId(editing?.categoryId ?? '');
    setDate(editing?.date ?? toKey(new Date()));
  }, [visible, editing]);

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

  const save = () => {
    const n = parseFloat(amount);
    if (!(n > 0)) return setError('اكتب المبلغ أولاً');
    if (!catId) return setError('اختر تصنيف المصروف');
    const data = { amount: n, note: note.trim(), categoryId: catId, date };
    if (editing) updateExpense({ ...editing, ...data });
    else addExpense(data);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onClose();
  };

  const display = amount ? Number(amount.split('.')[0]).toLocaleString('en-US') + (amount.includes('.') ? '.' + amount.split('.')[1] : '') : '0';

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={editing ? 'تعديل المصروف' : 'مصروف جديد'}
      footer={
        <View>
          {!!error && <T size={TS.small} color={C.pom} align="center" style={{ marginBottom: 8 }}>{error}</T>}
          <PrimaryButton label={editing ? 'حفظ التعديل' : 'سجّل المصروف'} onPress={save} />
          {editing && (
            <Pressable
              onPress={() => (confirmDelete ? (deleteExpense(editing.id), onClose()) : setConfirmDelete(true))}
              style={{ paddingVertical: 12 }}
            >
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
