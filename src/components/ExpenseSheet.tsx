import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, TextInput, View } from 'react-native';
import { qtyLabel } from '../budgets';
import { useFamily } from '../family';
import { MAX_PAGES, pickReceiptPdf, pickReceiptPhotos, ReceiptFile } from '../lib/receiptPhoto';
import { C, F, TS } from '../theme';
import { Expense, ExpenseLine, Item, ReceiptPrefill, UNITS } from '../types';
import { Avatar, CatTile, ErrorText, HScroll, Icon, IconName, Money, PrimaryButton, Row, T } from '../ui';
import { dayLabel, num, parseAmount, shortDay, toKey } from '../utils';
import { ADDABLE, chargeOf, ChargeKind, isCharge, LineKind, signed } from '../lineKinds';
import { CategoryPicker, GroupField, UnitPicker } from './ItemSheet';
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

type Props = {
  visible: boolean;
  onClose: () => void;
  editing?: Expense | null;
  prefill?: ReceiptPrefill | null;
  /** The member a new expense is for (the one selected on the home screen); defaults to the signed-in member */
  forMember?: string | null;
};

/** Mounted fresh each time it opens, so the form always starts from `editing` */
export function ExpenseSheet(props: Props) {
  if (!props.visible) return null;
  return <ExpenseForm key={props.editing?.id ?? (props.prefill ? 'draft' : 'new')} {...props} />;
}

type View_ = 'main' | 'pick' | 'line';
type Draft = { index: number | null; kind: LineKind; itemId: string | null; name: string; group: string; unit: string; categoryId: string; qty: string; amount: string; raw?: string };

function ExpenseForm({ visible, onClose, editing, prefill, forMember }: Props) {
  const { categories, items, expenses, me, members, memberOf, addExpense, updateExpense, deleteExpense, saveItem, scanReceipt, learnAliases } = useFamily();
  // Editable by the member it belongs to and by whoever recorded it
  const readOnly = !!editing && editing.userId !== me?.id && editing.createdBy !== me?.id;
  const [ownerId, setOwnerId] = useState<string | null>(
    editing?.userId ?? (forMember && members.some((m) => m.id === forMember) ? forMember : me?.id ?? null),
  );
  const [mode, setMode] = useState<'amount' | 'receipt'>(editing?.lines.length || prefill ? 'receipt' : 'amount');
  const [view, setView] = useState<View_>('main');
  const [amount, setAmount] = useState(editing && !editing.lines.length ? String(editing.amount) : '');
  const [lines, setLines] = useState<ExpenseLine[]>(editing?.lines ?? prefill?.lines ?? []);
  const [note, setNote] = useState(editing?.note ?? prefill?.note ?? '');
  const [catId, setCatId] = useState(editing?.categoryId ?? '');
  const [date, setDate] = useState(editing?.date ?? prefill?.date ?? toKey(new Date()));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // item picker + line editor state
  const [query, setQuery] = useState('');
  const [newItem, setNewItem] = useState<{ categoryId: string; unit: string; group: string } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  // receipt photo reading
  const [scanning, setScanning] = useState(false);
  const [pages, setPages] = useState<ReceiptFile[]>([]); // photos of a long receipt, waiting to be read together
  const [scanNotes, setScanNotes] = useState<string[]>(prefill?.warnings ?? []);
  const [relinking, setRelinking] = useState<Draft | null>(null); // a line waiting for a different item

  const days = lastDays(14);
  if (editing && !days.includes(editing.date)) days.push(editing.date);
  if (!days.includes(date)) days.push(date);
  const linesTotal = lines.reduce((a, l) => a + l.amount, 0);
  const catOf = (id: string) => categories.find((c) => c.id === id);

  // How often each item was bought, to list frequent items first; and its last unit price
  const usage = useMemo(() => {
    const count = new Map<string, number>();
    const last = new Map<string, { price: number; date: string }>();
    for (const e of expenses) {
      for (const l of e.lines) {
        if (!l.itemId) continue;
        count.set(l.itemId, (count.get(l.itemId) ?? 0) + 1);
        const prev = last.get(l.itemId);
        if (!prev || e.date > prev.date) last.set(l.itemId, { price: l.quantity ? l.amount / l.quantity : 0, date: e.date });
      }
    }
    return { count, last };
  }, [expenses]);

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
    let data;
    let finalLines: ExpenseLine[] = [];
    if (mode === 'receipt') {
      if (!lines.some((l) => !isCharge(l.kind))) return setError('أضف صنف واحد على الأقل للفاتورة');
      const noCat = lines.findIndex((l) => !isCharge(l.kind) && !l.categoryId);
      if (noCat >= 0) return setError(`اختر تصنيف «${lines[noCat].name}» قبل الحفظ`);
      const noPrice = lines.findIndex((l) => l.needsPrice);
      if (noPrice >= 0) return setError(`اكتب سعر «${lines[noPrice].name}» قبل الحفظ`);
      if (!(lines.reduce((a, l) => a + l.amount, 0) > 0)) return setError('مجموع الفاتورة لازم يكون أكثر من صفر');
    } else {
      const n = parseFloat(amount);
      if (!(n > 0)) return setError('اكتب المبلغ أولاً');
      if (!catId) return setError('اختر تصنيف المصروف');
      data = { amount: n, note: note.trim(), categoryId: catId, date, fixedId: editing?.fixedId ?? null, lines: [], userId: ownerId };
    }
    setBusy(true);
    try {
      if (mode === 'receipt') {
        // Lines read from a photo may name items the family doesn't have yet: add them first (charges are not items)
        finalLines = [];
        for (const l of lines) {
          if (l.itemId || isCharge(l.kind)) finalLines.push(l);
          else {
            const it = await saveItem({ name: l.name, categoryId: l.categoryId, unit: l.unit, group: l.group });
            finalLines.push({ ...l, itemId: it.id });
          }
        }
        // The receipt's main category is the one with the largest share of its products; charges count towards it
        const byCat = new Map<string, number>();
        finalLines.filter((l) => !isCharge(l.kind)).forEach((l) => byCat.set(l.categoryId, (byCat.get(l.categoryId) ?? 0) + l.amount));
        const mainCat = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0][0];
        finalLines = finalLines.map((l) => (isCharge(l.kind) && !l.categoryId ? { ...l, categoryId: mainCat } : l));
        const total = finalLines.reduce((a, l) => a + l.amount, 0);
        data = { amount: Math.round(total * 100) / 100, note: note.trim(), categoryId: mainCat, date, fixedId: editing?.fixedId ?? null, lines: finalLines, userId: ownerId };
      }
      if (editing) await updateExpense(editing.id, data!);
      else await addExpense(data!);
      const learned = finalLines.filter((l) => l.raw && l.itemId && !isCharge(l.kind)).map((l) => ({ raw: l.raw!, itemId: l.itemId! }));
      if (learned.length) learnAliases(learned).catch(() => {});
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  // Reads the receipt: one photo, the parts of a long receipt, or a PDF
  const read = async (files: ReceiptFile[]) => {
    setError('');
    setScanning(true);
    try {
      const d = await scanReceipt(files);
      const got: ExpenseLine[] = d.lines.map((l) => ({
        kind: l.kind ?? 'item',
        itemId: l.itemId,
        name: l.name,
        group: l.group,
        unit: l.unit,
        categoryId: l.categoryId ?? '',
        quantity: l.quantity,
        amount: l.amount,
        raw: l.raw,
        uncertain: l.uncertain,
      }));
      setLines((ls) => [...ls, ...got]);
      if (d.store && !note.trim()) setNote(d.store);
      if (d.date) setDate(d.date);
      setScanNotes(d.warnings);
      setPages([]);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      setError((e as Error).message);
    }
    setScanning(false);
  };

  // Camera: one part at a time, then read them together. Library: the chosen photos are read straight away.
  const addPhotos = async (source: 'camera' | 'library') => {
    setError('');
    const room = MAX_PAGES - pages.length;
    if (room <= 0) return setError(`أكثر إشي ${MAX_PAGES} صور للفاتورة الوحدة`);
    try {
      const got = await pickReceiptPhotos(source, room);
      if (!got.length) return;
      if (source === 'library' && !pages.length) return read(got);
      setPages((p) => [...p, ...got]);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const addPdf = async () => {
    setError('');
    try {
      const pdf = await pickReceiptPdf();
      if (pdf) await read([pdf]);
    } catch (e) {
      setError((e as Error).message);
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

  // ───── read-only view of someone else's expense ─────
  if (readOnly && editing) {
    const owner = memberOf(editing.userId);
    const recorder = memberOf(editing.createdBy);
    const cat = catOf(editing.categoryId);
    return (
      <Sheet visible={visible} onClose={onClose} title="تفاصيل المصروف">
        <View style={{ alignItems: 'center', paddingVertical: 12, gap: 10 }}>
          <CatTile icon={cat?.icon ?? 'help'} color={cat?.color ?? C.faint} size={56} />
          <Money value={editing.amount} size={40} w="bold" decimals />
          <T w="medium" align="center">{editing.note || cat?.name}</T>
          <T size={TS.small} color={C.sub} align="center">{cat?.name}، {dayLabel(editing.date)}</T>
        </View>
        {editing.lines.length > 0 && <LinesList lines={editing.lines} />}
        <Row style={{ backgroundColor: C.paper, borderRadius: 14, padding: 12, gap: 10, marginTop: 12, marginBottom: 12 }}>
          <Avatar name={owner?.displayName ?? '؟'} color={owner?.color ?? C.faint} size={32} />
          <T size={TS.small} color={C.sub} style={{ flex: 1 }}>
            {recorder && recorder.id !== owner?.id
              ? `مصروف ${owner?.displayName ?? 'عضو سابق'}، سجّله ${recorder.displayName}. هم الاثنين بس بيقدروا يعدّلوه أو يحذفوه.`
              : `سجّله ${owner?.displayName ?? 'عضو سابق'}. صاحب المصروف بس بيقدر يعدّله أو يحذفه.`}
          </T>
        </Row>
      </Sheet>
    );
  }

  // ───── item picker ─────
  if (view === 'pick') {
    const q = query.trim();
    const visibleItems = items
      .filter((i) => !i.archived && (!q || i.name.includes(q)))
      .sort((a, b) => (usage.count.get(b.id) ?? 0) - (usage.count.get(a.id) ?? 0) || a.name.localeCompare(b.name, 'ar'));
    const exact = items.some((i) => i.name === q);
    const startLine = (it: Item) => {
      if (relinking) {
        // Keep what was read from the receipt (quantity, price, printed text); swap the item
        setDraft({ ...relinking, itemId: it.id, name: it.name, group: it.group, unit: it.unit, categoryId: it.categoryId });
        setRelinking(null);
        setView('line');
        return;
      }
      const last = usage.last.get(it.id);
      setDraft({ index: null, kind: 'item', itemId: it.id, name: it.name, group: it.group, unit: it.unit, categoryId: it.categoryId, qty: '1', amount: last ? String(Math.round(last.price * 100) / 100) : '' });
      setView('line');
    };
    const createItem = async () => {
      if (!newItem?.categoryId) return setError('اختر تصنيف الصنف الجديد');
      setBusy(true);
      try {
        const it = await saveItem({ name: q, categoryId: newItem.categoryId, unit: newItem.unit, group: newItem.group });
        setNewItem(null);
        setError('');
        startLine(it);
      } catch (e) {
        setError((e as Error).message);
      }
      setBusy(false);
    };

    return (
      <Sheet
        visible={visible}
        onClose={onClose}
        title={relinking ? `بدّل «${relinking.name}» بصنف موجود` : 'اختر صنف'}
        footer={
          <View>
            <ErrorText text={error} />
            <Pressable
              onPress={() => {
                setNewItem(null);
                setError('');
                if (relinking) {
                  setDraft(relinking);
                  setRelinking(null);
                  setView('line');
                } else setView('main');
              }}
              style={{ paddingVertical: 12 }}
            >
              <T w="medium" color={C.oasis} align="center">{relinking ? 'رجوع للسطر' : 'رجوع للفاتورة'}</T>
            </Pressable>
          </View>
        }
      >
        <Row style={{ backgroundColor: C.paper, borderRadius: 14, paddingHorizontal: 12, marginTop: 4 }}>
          <Icon name="magnify" size={20} color={C.faint} />
          <TextInput
            value={query}
            onChangeText={(t) => (setQuery(t), setNewItem(null))}
            placeholder="ابحث أو اكتب اسم صنف جديد"
            placeholderTextColor={C.faint}
            autoFocus
            style={{ ...inputStyle, flex: 1, minWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 8 }}
          />
        </Row>

        {!!q && !exact && (
          <View style={{ marginTop: 12, backgroundColor: C.oasis + '10', borderRadius: 16, padding: 14 }}>
            {!newItem ? (
              <Pressable onPress={() => setNewItem({ categoryId: visibleItems[0]?.categoryId ?? '', unit: 'حبة', group: '' })} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                <Icon name="plus-circle-outline" size={22} color={C.oasis} />
                <T w="semibold" color={C.oasis}>أضف «{q}» كصنف جديد</T>
              </Pressable>
            ) : (
              <>
                <T w="semibold">«{q}» صنف جديد</T>
                <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 12, marginBottom: 8 }}>بينباع بالـ</T>
                <UnitPicker value={newItem.unit} onChange={(u) => setNewItem({ ...newItem, unit: u })} />
                <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 12, marginBottom: 8 }}>التصنيف</T>
                <CategoryPicker value={newItem.categoryId} onChange={(id) => setNewItem({ ...newItem, categoryId: id })} />
                <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 12, marginBottom: 8 }}>النوع</T>
                <GroupField value={newItem.group} onChange={(g) => setNewItem({ ...newItem, group: g })} name={q} />
                <View style={{ marginTop: 14 }}>
                  <PrimaryButton label="أضف الصنف وكمّل" onPress={createItem} busy={busy} tone="oasis" />
                </View>
              </>
            )}
          </View>
        )}

        <View style={{ marginTop: 12, marginBottom: 8 }}>
          {visibleItems.length === 0 && !q && (
            <T color={C.sub} align="center" style={{ padding: 16 }}>
              ما في أصناف لسه. اكتب اسم أول صنف بالبحث فوق، أو أضف الأصناف من الإعدادات ← التصنيفات.
            </T>
          )}
          {visibleItems.slice(0, 60).map((it, i) => {
            const cat = catOf(it.categoryId);
            const last = usage.last.get(it.id);
            return (
              <Pressable
                key={it.id}
                onPress={() => startLine(it)}
                style={({ pressed }) => ({
                  flexDirection: 'row-reverse', alignItems: 'center', gap: 12, paddingVertical: 11,
                  borderTopWidth: i ? 1 : 0, borderColor: C.line, backgroundColor: pressed ? C.paper : 'transparent',
                })}
              >
                <CatTile icon={cat?.icon ?? 'tag'} color={cat?.color ?? C.faint} size={34} />
                <View style={{ flex: 1 }}>
                  <T w="medium">{it.name}</T>
                  <T size={TS.tiny} color={C.sub}>{cat?.name}، بالـ{it.unit}</T>
                </View>
                {last && <T size={TS.tiny} color={C.faint}>آخر سعر {num(last.price)}</T>}
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    );
  }

  // ───── charge editor (VAT, service, delivery, tip, fee, discount, correction) ─────
  if (view === 'line' && draft && isCharge(draft.kind)) {
    const kind = draft.kind as ChargeKind;
    const info = chargeOf(kind)!;
    const value = parseFloat(draft.amount.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(',', '.'));
    const commit = () => {
      if (!isFinite(value) || value === 0) return setError('اكتب المبلغ');
      const line: ExpenseLine = {
        kind, itemId: null, name: draft.name.trim() || info.label, unit: 'حبة', categoryId: draft.categoryId,
        quantity: 1, amount: Math.round(signed(kind, value) * 100) / 100, raw: draft.raw, uncertain: false, needsPrice: false,
      };
      setLines((ls) => (draft.index === null ? [...ls, line] : ls.map((l, i) => (i === draft.index ? { ...l, ...line } : l))));
      setDraft(null);
      setError('');
      setView('main');
    };
    const kinds = kind === 'adjust' ? [...ADDABLE, info] : ADDABLE;
    return (
      <Sheet
        visible={visible}
        onClose={onClose}
        title={draft.index === null ? 'رسوم أو خصم' : info.label}
        footer={
          <View>
            <ErrorText text={error} />
            <View style={{ height: 10 }} />
            <PrimaryButton label={draft.index === null ? 'أضف للفاتورة' : 'حفظ السطر'} onPress={commit} />
            <Pressable
              onPress={() => {
                if (draft.index !== null) setLines((ls) => ls.filter((_, i) => i !== draft.index));
                setDraft(null);
                setError('');
                setView('main');
              }}
              style={{ paddingVertical: 12 }}
            >
              <T size={TS.small} w="medium" color={draft.index === null ? C.oasis : C.pom} align="center">
                {draft.index === null ? 'رجوع للفاتورة' : 'احذف السطر من الفاتورة'}
              </T>
            </Pressable>
          </View>
        }
      >
        {kind === 'adjust' && (
          <T size={TS.small} color={C.sub} style={{ marginTop: 4 }}>
            هاد الفرق بين الأسطر اللي انقرت ومجموع الفاتورة. إذا عرفت شو هو اختر نوعه، وإذا كان غلط بالقراءة احذفه وصلّح السطر الغلط.
          </T>
        )}
        <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 12, marginBottom: 8 }}>النوع</T>
        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }}>
          {kinds.map((k) => {
            const on = k.key === kind;
            return (
              <Pressable
                key={k.key}
                onPress={() => setDraft({ ...draft, kind: k.key, name: draft.name === info.label || !draft.name ? k.label : draft.name })}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: on ? C.ink : C.paper }}
              >
                <Icon name={k.icon} size={16} color={on ? '#fff' : C.ink} />
                <T size={TS.small} w={on ? 'semibold' : 'regular'} color={on ? '#fff' : C.text}>{k.label}</T>
              </Pressable>
            );
          })}
        </View>
        {(kind === 'fee' || kind === 'discount') && (
          <>
            <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 16, marginBottom: 8 }}>الاسم (اختياري)</T>
            <TextInput
              value={draft.name === info.label ? '' : draft.name}
              onChangeText={(t) => setDraft({ ...draft, name: t })}
              placeholder={kind === 'fee' ? 'مثلاً: رسوم الطلب الصغير، كيس' : 'مثلاً: كود الخصم'}
              placeholderTextColor={C.faint}
              style={inputStyle}
            />
          </>
        )}
        <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 16, marginBottom: 8 }}>
          {kind === 'discount' ? 'قيمة الخصم (درهم)' : 'المبلغ (درهم)'}
        </T>
        <TextInput
          value={draft.amount}
          onChangeText={(t) => setDraft({ ...draft, amount: t })}
          keyboardType={kind === 'adjust' ? 'numbers-and-punctuation' : 'decimal-pad'}
          placeholder="0"
          placeholderTextColor={C.faint}
          accessibilityLabel="المبلغ"
          autoFocus={!draft.amount}
          style={{ ...inputStyle, fontFamily: F.bold, fontSize: 28, textAlign: 'center', paddingVertical: 12 }}
        />
        {kind === 'discount' && <T size={TS.tiny} color={C.sub} align="center" style={{ marginTop: 8 }}>بينطرح من مجموع الفاتورة.</T>}
        <View style={{ height: 12 }} />
      </Sheet>
    );
  }

  // ───── line editor (quantity + total price) ─────
  if (view === 'line' && draft) {
    const qty = parseAmount(draft.qty) || 0;
    const amt = parseAmount(draft.amount) || 0;
    const step = ['كيلو', 'لتر'].includes(draft.unit) ? 0.5 : draft.unit === 'غرام' ? 100 : 1;
    const cat = catOf(draft.categoryId);
    const last = draft.itemId ? usage.last.get(draft.itemId) : undefined;
    const commit = () => {
      if (!(qty > 0)) return setError('اكتب الكمية');
      if (!(amt >= 0) || !draft.amount.trim()) return setError('اكتب السعر الإجمالي لهذا الصنف');
      if (!draft.itemId && !draft.name.trim()) return setError('اكتب اسم الصنف');
      if (!draft.categoryId) return setError('اختر تصنيف الصنف');
      const line: ExpenseLine = {
        kind: 'item', itemId: draft.itemId, name: draft.name.trim(), group: draft.group.trim() || undefined, unit: draft.unit, categoryId: draft.categoryId, quantity: qty, amount: amt,
        raw: draft.raw, uncertain: false, needsPrice: false,
      };
      setLines((ls) => (draft.index === null ? [...ls, line] : ls.map((l, i) => (i === draft.index ? { ...l, ...line } : l))));
      setDraft(null);
      setQuery('');
      setError('');
      setView('main');
    };
    return (
      <Sheet
        visible={visible}
        onClose={onClose}
        title={draft.itemId ? draft.name : draft.index === null ? 'صنف جديد' : draft.name || 'صنف جديد'}
        footer={
          <View>
            <ErrorText text={error} />
            <View style={{ height: 10 }} />
            <PrimaryButton label={draft.index === null ? 'أضف للفاتورة' : 'حفظ السطر'} onPress={commit} />
            <Pressable
              onPress={() => {
                if (draft.index !== null) setLines((ls) => ls.filter((_, i) => i !== draft.index));
                setDraft(null);
                setError('');
                setView(draft.index === null ? 'pick' : 'main');
              }}
              style={{ paddingVertical: 12 }}
            >
              <T size={TS.small} w="medium" color={draft.index === null ? C.oasis : C.pom} align="center">
                {draft.index === null ? 'اختر صنف ثاني' : 'احذف السطر من الفاتورة'}
              </T>
            </Pressable>
          </View>
        }
      >
        {!!draft.raw && (
          <View style={{ backgroundColor: C.paper, borderRadius: 12, padding: 10, marginTop: 2 }}>
            <T size={TS.tiny} color={C.sub}>مكتوب بالفاتورة</T>
            <T size={TS.small} style={{ writingDirection: 'ltr', textAlign: 'left' }}>{draft.raw}</T>
          </View>
        )}
        {draft.itemId ? (
          <Row style={{ gap: 10, marginTop: 10 }}>
            <CatTile icon={cat?.icon ?? 'tag'} color={cat?.color ?? C.faint} size={36} />
            <T size={TS.small} color={C.sub} style={{ flex: 1 }}>{cat?.name}، بالـ{draft.unit}</T>
            {draft.index !== null && (
              <Pressable onPress={() => (setRelinking(draft), setQuery(''), setError(''), setView('pick'))} hitSlop={8}>
                <T size={TS.small} w="medium" color={C.oasis}>غيّر الصنف</T>
              </Pressable>
            )}
          </Row>
        ) : (
          <View style={{ marginTop: 10 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ backgroundColor: C.oasis + '18', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
                <T size={TS.tiny} w="semibold" color={C.oasis}>صنف جديد، بينضاف لأصنافكم عند الحفظ</T>
              </View>
              <Pressable onPress={() => (setRelinking(draft), setQuery(''), setError(''), setView('pick'))} hitSlop={8}>
                <T size={TS.small} w="medium" color={C.oasis}>اربطه بصنف موجود</T>
              </Pressable>
            </Row>
            <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 14, marginBottom: 8 }}>اسم الصنف</T>
            <TextInput value={draft.name} onChangeText={(t) => setDraft({ ...draft, name: t })} style={inputStyle} />
            <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 14, marginBottom: 8 }}>بينباع بالـ</T>
            <UnitPicker value={draft.unit} onChange={(u) => setDraft({ ...draft, unit: u })} />
            <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 14, marginBottom: 8 }}>التصنيف</T>
            <CategoryPicker value={draft.categoryId} onChange={(id) => setDraft({ ...draft, categoryId: id })} />
            <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 14, marginBottom: 8 }}>النوع</T>
            <GroupField value={draft.group} onChange={(g) => setDraft({ ...draft, group: g })} name={draft.name} />
          </View>
        )}

        <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 18, marginBottom: 8 }}>الكمية</T>
        <Row style={{ gap: 10 }}>
          <Pressable
            onPress={() => setDraft({ ...draft, qty: String(Math.round((qty + step) * 1000) / 1000) })}
            accessibilityLabel="زيادة الكمية"
            style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="plus" size={24} color="#fff" />
          </Pressable>
          <View style={{ flex: 1, flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: C.paper, borderRadius: 16, paddingHorizontal: 14 }}>
            <TextInput
              value={draft.qty}
              onChangeText={(t) => setDraft({ ...draft, qty: t })}
              keyboardType="decimal-pad"
              accessibilityLabel="الكمية"
              style={{ flex: 1, minWidth: 0, fontFamily: F.bold, fontSize: 24, color: C.text, textAlign: 'center', paddingVertical: 10 }}
            />
            <T w="medium" color={C.sub}>{draft.unit}</T>
          </View>
          <Pressable
            onPress={() => setDraft({ ...draft, qty: String(Math.max(Math.round((qty - step) * 1000) / 1000, step)) })}
            accessibilityLabel="تقليل الكمية"
            style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="minus" size={24} color={C.text} />
          </Pressable>
        </Row>

        <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 18, marginBottom: 8 }}>السعر الإجمالي لهذا الصنف (درهم)</T>
        <TextInput
          value={draft.amount}
          onChangeText={(t) => setDraft({ ...draft, amount: t })}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={C.faint}
          accessibilityLabel="السعر الإجمالي"
          autoFocus={draft.index !== null || !draft.amount}
          style={{ ...inputStyle, fontFamily: F.bold, fontSize: 28, textAlign: 'center', paddingVertical: 12 }}
        />
        <View style={{ marginTop: 10, marginBottom: 8, gap: 4 }}>
          {qty > 0 && amt > 0 && (
            <T size={TS.small} color={C.sub} align="center">سعر الـ{draft.unit}: {num(amt / qty)} درهم</T>
          )}
          {last && (
            <T size={TS.tiny} color={C.faint} align="center">آخر مرة اشتريتوه بـ {num(last.price)} درهم للـ{draft.unit} ({dayLabel(last.date)})</T>
          )}
        </View>
      </Sheet>
    );
  }

  // ───── main form ─────
  const display = amount ? Number(amount.split('.')[0]).toLocaleString('en-US') + (amount.includes('.') ? '.' + amount.split('.')[1] : '') : '0';

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={editing ? 'تعديل المصروف' : 'مصروف جديد'}
      footer={
        <View>
          <ErrorText text={error} />
          <View style={{ height: error ? 10 : 0 }} />
          <PrimaryButton label={editing ? 'حفظ التعديل' : mode === 'receipt' ? 'سجّل الفاتورة' : 'سجّل المصروف'} onPress={save} busy={busy} />
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
      {/* Mode */}
      {!editing?.fixedId && (
        <View style={{ flexDirection: 'row-reverse', backgroundColor: C.paper, borderRadius: 14, padding: 4, marginTop: 4 }}>
          {([['amount', 'مبلغ واحد', 'cash'], ['receipt', 'فاتورة بأصناف', 'receipt-text-outline']] as const).map(([k, label, icon]) => {
            const on = mode === k;
            return (
              <Pressable
                key={k}
                onPress={() => (setMode(k), setError(''))}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={{ flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 11, backgroundColor: on ? C.surface : 'transparent' }}
              >
                <Icon name={icon} size={18} color={on ? C.ink : C.sub} />
                <T size={TS.small} w={on ? 'semibold' : 'regular'} color={on ? C.ink : C.sub}>{label}</T>
              </Pressable>
            );
          })}
        </View>
      )}

      {mode === 'amount' ? (
        <>
          <View style={{ alignItems: 'center', paddingVertical: 8 }}>
            <Row style={{ alignItems: 'baseline' }}>
              <T w="bold" size={48} color={amount ? C.text : C.faint} align="center" style={{ letterSpacing: -1.5, lineHeight: 64 }}>{display}</T>
              <T w="medium" size={18} color={C.sub} style={{ marginRight: 6 }}>درهم</T>
            </Row>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
            {KEYS.map((k) => (
              <View key={k} style={{ width: '33.333%', padding: 4 }}>
                <Pressable
                  onPress={() => press(k)}
                  style={({ pressed }) => ({ height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? C.line : C.paper })}
                >
                  {k === 'del' ? <Icon name="backspace-outline" size={22} color={C.text} /> : <T w="semibold" size={22} align="center">{k}</T>}
                </Pressable>
              </View>
            ))}
          </View>

          <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 20, marginBottom: 10 }}>التصنيف</T>
          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', marginHorizontal: -4 }}>
            {categories.map((c) => {
              const on = c.id === catId;
              return (
                <View key={c.id} style={{ width: '25%', padding: 4 }}>
                  <Pressable
                    onPress={() => (tap(), setCatId(c.id), setError(''))}
                    style={{ alignItems: 'center', paddingVertical: 10, borderRadius: 16, borderWidth: 1.5, borderColor: on ? c.color : 'transparent', backgroundColor: on ? c.color + '12' : 'transparent' }}
                  >
                    <CatTile icon={c.icon} color={c.color} size={40} />
                    <T size={TS.tiny} w={on ? 'semibold' : 'regular'} align="center" numberOfLines={1} style={{ marginTop: 6 }}>{c.name}</T>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </>
      ) : (
        <>
          {pages.length === 0 ? (
            <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 12 }}>
              <Pressable
                onPress={() => addPhotos('camera')}
                disabled={scanning}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8,
                  paddingVertical: 13, borderRadius: 14, backgroundColor: C.ink, opacity: pressed || scanning ? 0.8 : 1,
                })}
              >
                <Icon name="camera-outline" size={20} color="#fff" />
                <T w="semibold" color="#fff">صوّر الفاتورة</T>
              </Pressable>
              <SourceButton icon="image-multiple-outline" label="الصور" onPress={() => addPhotos('library')} disabled={scanning} />
              <SourceButton icon="file-pdf-box" label="PDF" onPress={addPdf} disabled={scanning} />
            </View>
          ) : (
            !scanning && (
              <View style={{ backgroundColor: C.paper, borderRadius: 16, padding: 12, marginTop: 12 }}>
                <T size={TS.small} w="semibold">
                  {pages.length === 1 ? 'صورة وحدة جاهزة' : `${pages.length} أجزاء من نفس الفاتورة`}
                </T>
                <T size={TS.tiny} color={C.sub} style={{ marginTop: 2 }}>
                  فاتورة طويلة؟ صوّرها على أجزاء من فوق لتحت، وخلّي كل جزء يبيّن آخر سطر من الجزء اللي قبله.
                </T>
                <HScroll style={{ marginTop: 10 }}>
                  {pages.map((p, i) => (
                    <View key={p.uri + i} style={{ width: 64, height: 86, borderRadius: 10, overflow: 'hidden', backgroundColor: C.line }}>
                      <Image source={{ uri: `data:${p.mimeType};base64,${p.base64}` }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      <View style={{ position: 'absolute', bottom: 3, right: 3, backgroundColor: C.ink + 'CC', borderRadius: 999, paddingHorizontal: 6 }}>
                        <T size={TS.tiny} w="semibold" color="#fff">{i + 1}</T>
                      </View>
                      <Pressable
                        onPress={() => setPages((ps) => ps.filter((_, j) => j !== i))}
                        accessibilityLabel={`احذف الجزء ${i + 1}`}
                        hitSlop={6}
                        style={{ position: 'absolute', top: 3, left: 3, width: 20, height: 20, borderRadius: 10, backgroundColor: C.ink + 'CC', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Icon name="close" size={14} color="#fff" />
                      </Pressable>
                    </View>
                  ))}
                  {pages.length < MAX_PAGES && (
                    <Pressable
                      onPress={() => addPhotos('camera')}
                      accessibilityLabel="صوّر الجزء التالي"
                      style={{ width: 64, height: 86, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.oasis, alignItems: 'center', justifyContent: 'center', gap: 2 }}
                    >
                      <Icon name="camera-plus-outline" size={22} color={C.oasis} />
                      <T size={TS.tiny} color={C.oasis} align="center">الجزء التالي</T>
                    </Pressable>
                  )}
                </HScroll>
                <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 12 }}>
                  <Pressable
                    onPress={() => read(pages)}
                    accessibilityRole="button"
                    style={({ pressed }) => ({ flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14, backgroundColor: C.ink, opacity: pressed ? 0.85 : 1 })}
                  >
                    <Icon name="text-recognition" size={20} color="#fff" />
                    <T w="semibold" color="#fff">اقرأ الفاتورة</T>
                  </Pressable>
                  <SourceButton icon="image-plus" label="من الصور" onPress={() => addPhotos('library')} />
                </View>
              </View>
            )
          )}

          {scanning && (
            <Row style={{ gap: 10, backgroundColor: C.paper, borderRadius: 14, padding: 14, marginTop: 10 }}>
              <ActivityIndicator color={C.oasis} />
              <T size={TS.small} color={C.sub} style={{ flex: 1 }}>جاري قراءة الفاتورة، بتاخد كم ثانية…</T>
            </Row>
          )}

          {scanNotes.length > 0 && !scanning && (
            <View style={{ backgroundColor: C.saffron + '14', borderRadius: 14, padding: 12, marginTop: 10, gap: 4 }}>
              {scanNotes.map((n, i) => (
                <Row key={i} style={{ gap: 6, alignItems: 'flex-start' }}>
                  <Icon name="information-outline" size={16} color={C.saffron} />
                  <T size={TS.small} style={{ flex: 1 }}>{n}</T>
                </Row>
              ))}
            </View>
          )}

          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 6 }}>
            <T size={TS.small} color={C.sub} align="center">مجموع الفاتورة</T>
            <Money value={linesTotal} size={40} w="bold" decimals />
          </View>
          {lines.length > 0 && (
            <LinesList
              lines={lines}
              onPress={(i) => {
                const l = lines[i];
                setDraft({ index: i, kind: l.kind ?? 'item', itemId: l.itemId, name: l.name, group: l.group ?? '', unit: UNITS.includes(l.unit as (typeof UNITS)[number]) ? l.unit : 'حبة', categoryId: l.categoryId, qty: String(l.quantity), amount: String(isCharge(l.kind) && l.kind !== 'adjust' ? Math.abs(l.amount) : l.amount), raw: l.raw });
                setView('line');
              }}
            />
          )}
          <Pressable
            onPress={() => (setError(''), setView('pick'))}
            style={({ pressed }) => ({
              flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12,
              paddingVertical: 14, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.oasis,
              backgroundColor: pressed ? C.oasis + '10' : 'transparent',
            })}
          >
            <Icon name="plus" size={20} color={C.oasis} />
            <T w="semibold" color={C.oasis}>{lines.length ? 'أضف صنف ثاني' : 'أضف أول صنف'}</T>
          </Pressable>
          {lines.length > 0 && (
            <Pressable
              onPress={() => {
                setError('');
                setDraft({ index: null, kind: 'delivery', itemId: null, name: chargeOf('delivery')!.label, group: '', unit: 'حبة', categoryId: '', qty: '1', amount: '' });
                setView('line');
              }}
              accessibilityRole="button"
              style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 }}
            >
              <Icon name="cash-plus" size={18} color={C.sub} />
              <T size={TS.small} w="medium" color={C.sub}>أضف ضريبة أو رسوم أو خصم</T>
            </Pressable>
          )}
        </>
      )}

      {/* Whose expense: counts against that member's budget */}
      {members.length > 1 && !editing?.fixedId && (
        <>
          <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 18, marginBottom: 10 }}>مصروف مين؟</T>
          <HScroll>
            {members.map((m) => {
              const on = m.id === ownerId;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => (tap(), setOwnerId(m.id))}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={{
                    flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingVertical: 6, paddingLeft: 14, paddingRight: 6,
                    borderRadius: 999, borderWidth: 1.5, borderColor: on ? m.color : C.line, backgroundColor: on ? m.color + '14' : C.surface,
                  }}
                >
                  <Avatar name={m.displayName} color={m.color} size={28} />
                  <T size={TS.small} w={on ? 'semibold' : 'regular'}>{m.id === me?.id ? `${m.displayName} (أنا)` : m.displayName}</T>
                </Pressable>
              );
            })}
          </HScroll>
          {ownerId !== me?.id && (
            <T size={TS.tiny} color={C.sub} style={{ marginTop: 6 }}>بينحسب من بادجت {memberOf(ownerId)?.displayName}.</T>
          )}
        </>
      )}

      {/* Date */}
      <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 18, marginBottom: 10 }}>التاريخ</T>
      <HScroll>
        {days.map((d) => {
          const on = d === date;
          const s = shortDay(d);
          return (
            <Pressable key={d} onPress={() => (tap(), setDate(d))} style={{ width: 56, paddingVertical: 8, borderRadius: 14, alignItems: 'center', backgroundColor: on ? C.ink : C.paper }}>
              <T size={TS.tiny} color={on ? C.inkMuted : C.sub} align="center">{s.top}</T>
              <T w="bold" size={17} color={on ? '#fff' : C.text} align="center">{s.bottom}</T>
            </Pressable>
          );
        })}
      </HScroll>

      {/* Note */}
      <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 18, marginBottom: 10 }}>{mode === 'receipt' ? 'المحل' : 'ملاحظة'}</T>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder={mode === 'receipt' ? 'مثلاً: كارفور، لولو، بقالة الحي' : 'مثلاً: بنزين، كارفور، قسط الباص'}
        placeholderTextColor={C.faint}
        style={{ ...inputStyle, marginBottom: 8 }}
      />
    </Sheet>
  );
}

function SourceButton({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingVertical: 13, paddingHorizontal: 14, borderRadius: 14, backgroundColor: C.paper, opacity: pressed || disabled ? 0.7 : 1,
      })}
    >
      <Icon name={icon} size={20} color={C.ink} />
      <T w="medium">{label}</T>
    </Pressable>
  );
}

function LinesList({ lines, onPress }: { lines: ExpenseLine[]; onPress?: (i: number) => void }) {
  return (
    <View style={{ backgroundColor: C.paper, borderRadius: 16, marginTop: 8 }}>
      {lines.map((l, i) => (
        <Pressable
          key={`${l.itemId ?? l.name}-${i}`}
          onPress={onPress ? () => onPress(i) : undefined}
          disabled={!onPress}
          style={{
            flexDirection: 'row-reverse', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderColor: C.line,
            borderRightWidth: onPress && (isCharge(l.kind) ? l.kind === 'adjust' : l.uncertain || !l.categoryId || l.needsPrice) ? 3 : 0, borderRightColor: C.saffron,
          }}
        >
          {isCharge(l.kind) ? (
            <View style={{ flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
              <Icon name={chargeOf(l.kind)?.icon ?? 'cash'} size={18} color={l.kind === 'adjust' ? C.saffron : C.sub} />
              <View style={{ flex: 1 }}>
                <T w="medium" color={C.sub} numberOfLines={1}>{l.name}</T>
                {onPress && l.kind === 'adjust' && <T size={TS.tiny} color={C.saffron}>راجع هذا السطر</T>}
              </View>
            </View>
          ) : (
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
              <T w="medium" style={{ flexShrink: 1 }} numberOfLines={1}>{l.name}</T>
              {onPress && !l.itemId && (
                <View style={{ backgroundColor: C.oasis + '18', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 }}>
                  <T size={TS.tiny} w="semibold" color={C.oasis}>جديد</T>
                </View>
              )}
            </View>
            <T size={TS.tiny} color={onPress && (l.uncertain || !l.categoryId || l.needsPrice) ? C.saffron : C.sub}>
              {onPress && !l.categoryId
                ? 'اختر التصنيف'
                : onPress && l.needsPrice
                  ? `${qtyLabel(l.quantity, l.unit)}، اكتب السعر`
                  : onPress && l.uncertain
                  ? 'راجع هذا السطر'
                  : `${qtyLabel(l.quantity, l.unit)}${l.quantity > 0 ? `، ${num(l.amount / l.quantity)} للـ${l.unit}` : ''}`}
            </T>
          </View>
          )}
          <Money value={l.amount} decimals />
          {onPress && <Icon name="chevron-left" size={18} color={C.faint} />}
        </Pressable>
      ))}
    </View>
  );
}
