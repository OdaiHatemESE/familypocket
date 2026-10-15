import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFamily } from '../family';
import { C, TS } from '../theme';
import { Item, UNITS } from '../types';
import { CatTile, ErrorText, Field, PrimaryButton, T } from '../ui';
import { Sheet } from './Sheet';

export function UnitPicker({ value, onChange }: { value: string; onChange: (u: string) => void }) {
  return (
    <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }}>
      {UNITS.map((u) => {
        const on = u === value;
        return (
          <Pressable
            key={u}
            onPress={() => onChange(u)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: on ? C.ink : C.paper }}
          >
            <T size={TS.small} w={on ? 'semibold' : 'regular'} color={on ? '#fff' : C.text}>{u}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function CategoryPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { categories } = useFamily();
  return (
    <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }}>
      {categories.map((c) => {
        const on = c.id === value;
        return (
          <Pressable
            key={c.id}
            onPress={() => onChange(c.id)}
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
  );
}

type Props = { visible: boolean; onClose: () => void; editing: Item | null; categoryId?: string };

export function ItemSheet(props: Props) {
  if (!props.visible) return null;
  return <ItemForm key={props.editing?.id ?? 'new'} {...props} />;
}

function ItemForm({ visible, onClose, editing, categoryId }: Props) {
  const { saveItem, deleteItem, expenses } = useFamily();
  const [name, setName] = useState(editing?.name ?? '');
  const [unit, setUnit] = useState(editing?.unit ?? 'حبة');
  const [catId, setCatId] = useState(editing?.categoryId ?? categoryId ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const used = editing ? expenses.reduce((a, e) => a + e.lines.filter((l) => l.itemId === editing.id).length, 0) : 0;

  const save = async () => {
    if (!name.trim()) return setError('اكتب اسم الصنف');
    if (!catId) return setError('اختر التصنيف');
    setBusy(true);
    try {
      await saveItem({ id: editing?.id, name, unit, categoryId: catId });
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
      await deleteItem(editing.id);
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
      title={editing ? 'تعديل الصنف' : 'صنف جديد'}
      footer={
        <View>
          <ErrorText text={error} />
          <View style={{ height: 10 }} />
          <PrimaryButton label={editing ? 'حفظ التعديل' : 'أضف الصنف'} onPress={save} busy={busy} />
          {editing && (
            <Pressable onPress={remove} disabled={busy} style={{ paddingVertical: 12 }}>
              <T size={TS.small} w="medium" color={C.pom} align="center">
                {confirmDelete
                  ? used
                    ? `اضغط مرة ثانية للحذف. ${used} شراء سابق بيضل بالسجل باسمه`
                    : 'اضغط مرة ثانية لتأكيد الحذف'
                  : 'حذف الصنف'}
              </T>
            </Pressable>
          )}
        </View>
      }
    >
      <Field label="اسم الصنف" value={name} onChangeText={setName} placeholder="مثلاً: دواء جلي، دجاج، خبز" autoFocus={!editing} />
      <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 16, marginBottom: 8 }}>بينباع بالـ</T>
      <UnitPicker value={unit} onChange={setUnit} />
      <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 16, marginBottom: 8 }}>التصنيف</T>
      <CategoryPicker value={catId} onChange={setCatId} />
      <View style={{ height: 8 }} />
    </Sheet>
  );
}
