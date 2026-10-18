import React, { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useFamily } from '../family';
import { C, F, TS } from '../theme';
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

/**
 * The item's general type (خبز for خبز أسمر), which analysis adds up. Suggests the types the family
 * already uses; left empty, the item is its own type.
 */
export function GroupField({ value, onChange, name }: { value: string; onChange: (g: string) => void; name: string }) {
  const { items } = useFamily();
  const groups = useMemo(() => {
    const count = new Map<string, number>();
    for (const i of items) if (i.group && i.group !== i.name) count.set(i.group, (count.get(i.group) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g);
  }, [items]);
  const q = value.trim();
  // Types that the typed text, or the item's name, points to
  const words = name.trim().split(/\s+/).filter((w) => w.length > 1);
  const suggestions = groups
    .filter((g) => g !== q && (q ? g.includes(q) : words.some((w) => g.includes(w) || w.includes(g))))
    .slice(0, 6);
  return (
    <View>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={name.trim() ? `مثلاً: ${name.trim().split(/\s+/)[0]}` : 'مثلاً: خبز، شوكولاتة، حليب'}
        placeholderTextColor={C.faint}
        accessibilityLabel="النوع"
        style={{ fontFamily: F.regular, fontSize: TS.body, textAlign: 'right', writingDirection: 'rtl', color: C.text, backgroundColor: C.paper, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 }}
      />
      {suggestions.length > 0 && (
        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {suggestions.map((g) => (
            <Pressable key={g} onPress={() => onChange(g)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: C.oasis + '14' }}>
              <T size={TS.small} color={C.oasis}>{g}</T>
            </Pressable>
          ))}
        </View>
      )}
      <T size={TS.tiny} color={C.faint} style={{ marginTop: 6 }}>الأصناف من نفس النوع بتنجمع مع بعض بالتحليل.</T>
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
  const [group, setGroup] = useState(editing && editing.group !== editing.name ? editing.group : '');
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
      await saveItem({ id: editing?.id, name, unit, categoryId: catId, group });
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
      <Field label="اسم الصنف" value={name} onChangeText={setName} placeholder="مثلاً: خبز أسمر، شوكولاتة بندق" autoFocus={!editing} />
      <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 16, marginBottom: 8 }}>النوع</T>
      <GroupField value={group} onChange={setGroup} name={name} />
      <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 16, marginBottom: 8 }}>بينباع بالـ</T>
      <UnitPicker value={unit} onChange={setUnit} />
      <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 16, marginBottom: 8 }}>التصنيف</T>
      <CategoryPicker value={catId} onChange={setCatId} />
      <View style={{ height: 8 }} />
    </Sheet>
  );
}
