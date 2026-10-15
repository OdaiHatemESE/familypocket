import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useFamily } from '../family';
import { C, F, TS } from '../theme';
import { Category } from '../types';
import { CatTile, Icon, IconName, PrimaryButton, T } from '../ui';
import { ICONS, PALETTE, parseAmount } from '../utils';
import { Sheet } from './Sheet';

const inputStyle = {
  fontFamily: F.regular,
  fontSize: TS.body,
  textAlign: 'right' as const,
  writingDirection: 'rtl' as const,
  color: C.text,
  backgroundColor: C.paper,
  borderRadius: 14,
  paddingHorizontal: 14,
  paddingVertical: 12,
};

type Props = { visible: boolean; onClose: () => void; editing: Category | null };

export function CategorySheet(props: Props) {
  if (!props.visible) return null;
  return <CategoryForm key={props.editing?.id ?? 'new'} {...props} />;
}

function CategoryForm({ visible, onClose, editing }: Props) {
  const { categories, expenses, fixed, saveCategory, deleteCategory } = useFamily();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(editing?.name ?? '');
  const [budget, setBudget] = useState(editing?.monthlyBudget ? String(editing.monthlyBudget) : '');
  const [icon, setIcon] = useState(editing?.icon ?? ICONS[5]);
  const [color, setColor] = useState(editing?.color ?? PALETTE[categories.length % PALETTE.length]);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    if (!name.trim()) return setError('اكتب اسم التصنيف');
    const b = budget.trim() ? parseAmount(budget) : 0;
    if (isNaN(b) || b < 0) return setError('البادجت لازم يكون رقم');
    setBusy(true);
    try {
      await saveCategory({ id: editing?.id, name: name.trim(), monthlyBudget: b, icon, color });
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
      await deleteCategory(editing.id);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const linked = editing ? expenses.filter((e) => e.categoryId === editing.id).length : 0;
  const linkedFixed = editing ? fixed.filter((f) => f.categoryId === editing.id).length : 0;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={editing ? 'تعديل التصنيف' : 'تصنيف جديد'}
      footer={
        <View>
          {!!error && <T size={TS.small} color={C.pom} align="center" style={{ marginBottom: 8 }}>{error}</T>}
          <PrimaryButton label={editing ? 'حفظ التعديل' : 'أضف التصنيف'} onPress={save} busy={busy} />
          {editing && (
            <Pressable onPress={remove} disabled={busy} style={{ paddingVertical: 12 }}>
              <T size={TS.small} w="medium" color={C.pom} align="center">
                {confirmDelete
                  ? linked || linkedFixed
                    ? `اضغط مرة ثانية: رح ينحذف التصنيف مع ${linked} مصروف${linkedFixed ? ` و${linkedFixed} إجباري` : ''} لكل العائلة`
                    : 'اضغط مرة ثانية لتأكيد الحذف'
                  : 'حذف التصنيف'}
              </T>
            </Pressable>
          )}
        </View>
      }
    >
      <View style={{ alignItems: 'center', marginVertical: 10 }}>
        <CatTile icon={icon} color={color} size={64} />
      </View>

      <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 8, marginBottom: 8 }}>الاسم</T>
      <TextInput style={inputStyle} value={name} onChangeText={setName} placeholder="مثلاً: رسوم المدرسة" placeholderTextColor={C.faint} />

      <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 16, marginBottom: 8 }}>البادجت الشهري لهذا التصنيف (درهم)</T>
      <TextInput
        style={inputStyle}
        value={budget}
        onChangeText={setBudget}
        keyboardType="decimal-pad"
        placeholder="اتركه فاضي إذا ما بدك حد"
        placeholderTextColor={C.faint}
      />

      <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 16, marginBottom: 8 }}>الأيقونة</T>
      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }}>
        {ICONS.map((i) => {
          const on = icon === i;
          return (
            <Pressable
              key={i}
              onPress={() => setIcon(i)}
              style={{
                width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
                backgroundColor: on ? color : C.paper,
              }}
            >
              <Icon name={i as IconName} size={22} color={on ? '#fff' : C.sub} />
            </Pressable>
          );
        })}
      </View>

      <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 16, marginBottom: 8 }}>اللون</T>
      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
        {PALETTE.map((p) => (
          <Pressable
            key={p}
            onPress={() => setColor(p)}
            style={{
              width: 36, height: 36, borderRadius: 18, backgroundColor: p,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            {color === p && <Icon name="check" size={18} color="#fff" />}
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}
