import React, { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { useFamily } from '../family';
import { C, TS } from '../theme';
import { FixedExpense } from '../types';
import { Avatar, CatTile, ErrorText, Field, PrimaryButton, Row, T } from '../ui';
import { parseAmount } from '../utils';
import { Sheet } from './Sheet';

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

type Props = { visible: boolean; onClose: () => void; editing: FixedExpense | null };

export function FixedSheet(props: Props) {
  if (!props.visible) return null;
  return <FixedForm key={props.editing?.id ?? 'new'} {...props} />;
}

function FixedForm({ visible, onClose, editing }: Props) {
  const { categories, members, me, saveFixed, deleteFixed } = useFamily();
  const [name, setName] = useState(editing?.name ?? '');
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '');
  const [catId, setCatId] = useState(editing?.categoryId ?? '');
  const [day, setDay] = useState(editing?.dueDay ?? 1);
  const [active, setActive] = useState(editing?.active ?? true);
  const [ownerId, setOwnerId] = useState<string | null>(editing?.ownerId ?? me?.id ?? null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    const n = parseAmount(amount);
    if (!name.trim()) return setError('اكتب اسم المصروف، مثلاً: الإيجار');
    if (!(n > 0)) return setError('اكتب المبلغ الشهري');
    if (!catId) return setError('اختر التصنيف اللي بينحسب عليه');
    setBusy(true);
    try {
      await saveFixed({ id: editing?.id, name: name.trim(), amount: n, categoryId: catId, dueDay: day, active, ownerId });
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
      await deleteFixed(editing.id);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={editing ? 'تعديل مصروف إجباري' : 'مصروف إجباري جديد'}
      footer={
        <View>
          <ErrorText text={error} />
          <View style={{ height: 10 }} />
          <PrimaryButton label={editing ? 'حفظ التعديل' : 'أضف المصروف الإجباري'} onPress={save} busy={busy} />
          {editing && (
            <Pressable onPress={remove} disabled={busy} style={{ paddingVertical: 12 }}>
              <T size={TS.small} w="medium" color={C.pom} align="center">
                {confirmDelete ? 'اضغط مرة ثانية لتأكيد الحذف. المدفوعات السابقة بتضل بالسجل' : 'حذف المصروف الإجباري'}
              </T>
            </Pressable>
          )}
        </View>
      }
    >
      <Field label="الاسم" value={name} onChangeText={setName} placeholder="مثلاً: الإيجار، قسط المدرسة، ديوا" />
      <Field label="المبلغ الشهري (درهم)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" />

      {members.length > 1 && (
        <>
          <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 16, marginBottom: 8 }}>المسؤول عنه (بينخصم من بادجته)</T>
          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }}>
            {members.map((m) => {
              const on = m.id === ownerId;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => setOwnerId(m.id)}
                  style={{
                    flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingVertical: 5, paddingLeft: 14, paddingRight: 5,
                    borderRadius: 999, borderWidth: 1.5, borderColor: on ? m.color : C.line, backgroundColor: on ? m.color + '12' : C.surface,
                  }}
                >
                  <Avatar name={m.displayName} color={m.color} size={26} />
                  <T size={TS.small} w={on ? 'semibold' : 'regular'}>{m.displayName}</T>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 16, marginBottom: 8 }}>بينحسب على تصنيف</T>
      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }}>
        {categories.map((c) => {
          const on = c.id === catId;
          return (
            <Pressable
              key={c.id}
              onPress={() => setCatId(c.id)}
              style={{
                flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingVertical: 6, paddingLeft: 12, paddingRight: 6,
                borderRadius: 999, borderWidth: 1.5, borderColor: on ? c.color : C.line, backgroundColor: on ? c.color + '12' : C.surface,
              }}
            >
              <CatTile icon={c.icon} color={c.color} size={26} />
              <T size={TS.small} w={on ? 'semibold' : 'regular'}>{c.name}</T>
            </Pressable>
          );
        })}
      </View>

      <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 16, marginBottom: 8 }}>يستحق كل شهر يوم</T>
      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', marginHorizontal: -3 }}>
        {DAYS.map((d) => {
          const on = d === day;
          return (
            <View key={d} style={{ width: `${100 / 7}%`, padding: 3 }}>
              <Pressable
                onPress={() => setDay(d)}
                style={{ height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.ink : C.paper }}
              >
                <T w={on ? 'bold' : 'regular'} color={on ? '#fff' : C.text} align="center">{String(d)}</T>
              </Pressable>
            </View>
          );
        })}
      </View>
      {day > 28 && <T size={TS.tiny} color={C.faint} style={{ marginTop: 4 }}>بالأشهر الأقصر بيستحق آخر يوم بالشهر.</T>}

      <Row style={{ justifyContent: 'space-between', marginTop: 18, marginBottom: 8, backgroundColor: C.paper, borderRadius: 14, padding: 12 }}>
        <View style={{ flex: 1 }}>
          <T w="medium">فعّال</T>
          <T size={TS.tiny} color={C.sub}>وقّفه إذا ما عليكم هالمصروف هالفترة.</T>
        </View>
        <Switch value={active} onValueChange={setActive} trackColor={{ true: C.oasis, false: C.line }} thumbColor="#fff" />
      </Row>
    </Sheet>
  );
}
