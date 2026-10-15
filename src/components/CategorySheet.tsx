import React, { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useStore } from '../store';
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

export function CategorySheet({ visible, onClose, editing }: { visible: boolean; onClose: () => void; editing: Category | null }) {
  const { categories, expenses, addCategory, updateCategory, deleteCategory } = useStore();
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [icon, setIcon] = useState(ICONS[0]);
  const [color, setColor] = useState(PALETTE[0]);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setError('');
    setConfirmDelete(false);
    setName(editing?.name ?? '');
    setBudget(editing?.monthlyBudget ? String(editing.monthlyBudget) : '');
    setIcon(editing?.icon ?? ICONS[5]);
    setColor(editing?.color ?? PALETTE[categories.length % PALETTE.length]);
  }, [visible, editing]);

  const save = () => {
    if (!name.trim()) return setError('اكتب اسم التصنيف');
    const b = budget.trim() ? parseAmount(budget) : 0;
    if (isNaN(b) || b < 0) return setError('البادجت لازم يكون رقم');
    const data = { name: name.trim(), monthlyBudget: b, icon, color };
    if (editing) updateCategory({ ...editing, ...data });
    else addCategory(data);
    onClose();
  };

  const linked = editing ? expenses.filter((e) => e.categoryId === editing.id).length : 0;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={editing ? 'تعديل التصنيف' : 'تصنيف جديد'}
      footer={
        <View>
          {!!error && <T size={TS.small} color={C.pom} align="center" style={{ marginBottom: 8 }}>{error}</T>}
          <PrimaryButton label={editing ? 'حفظ التعديل' : 'أضف التصنيف'} onPress={save} />
          {editing && (
            <Pressable
              onPress={() => (confirmDelete ? (deleteCategory(editing.id), onClose()) : setConfirmDelete(true))}
              style={{ paddingVertical: 12 }}
            >
              <T size={TS.small} w="medium" color={C.pom} align="center">
                {confirmDelete
                  ? linked
                    ? `اضغط مرة ثانية: رح ينحذف التصنيف و${linked} مصروف معه`
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

      <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 16, marginBottom: 8 }}>البادجت الشهري بالدرهم</T>
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
