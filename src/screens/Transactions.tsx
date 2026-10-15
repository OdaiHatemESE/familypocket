import React, { useMemo, useState } from 'react';
import { Pressable, SectionList, TextInput, View } from 'react-native';
import { ExpenseRow } from '../components/ExpenseRow';
import { useFamily } from '../family';
import { useTabs } from '../tabsContext';
import { C, F, TS } from '../theme';
import { Expense } from '../types';
import { Avatar, Chip, HScroll, Icon, Money, Row, T } from '../ui';
import { dayLabel } from '../utils';
import { PageHeader } from '../components/PageHeader';

export function Transactions() {
  const { expenses, categories, members, memberOf } = useFamily();
  const { month, setMonth, openExpense: onEdit } = useTabs();
  const [filter, setFilter] = useState<string | null>(null);
  const [who, setWho] = useState<string | null>(null);
  const family = members.length > 1;
  const [q, setQ] = useState('');

  const { sections, total, count } = useMemo(() => {
    const query = q.trim();
    const list = expenses
      .filter((e) => e.date.startsWith(month) && (!filter || e.categoryId === filter) && (!who || e.userId === who) && (!query || e.note.includes(query)))
      .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
    const map = new Map<string, Expense[]>();
    list.forEach((e) => map.set(e.date, [...(map.get(e.date) ?? []), e]));
    return {
      sections: [...map.entries()].map(([date, data]) => ({ date, total: data.reduce((a, e) => a + e.amount, 0), data })),
      total: list.reduce((a, e) => a + e.amount, 0),
      count: list.length,
    };
  }, [expenses, month, filter, who, q]);

  const catOf = (id: string) => categories.find((c) => c.id === id);

  return (
    <View style={{ flex: 1 }}>
      <PageHeader title="المصاريف" month={month} setMonth={setMonth}>
        <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
          <T size={TS.small} color={C.sub}>{count} مصروف</T>
          <Money value={total} size={TS.body} />
        </Row>
        <Row style={{ backgroundColor: C.surface, borderRadius: 14, paddingHorizontal: 12, marginTop: 12 }}>
          <Icon name="magnify" size={20} color={C.faint} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="ابحث بالملاحظة"
            placeholderTextColor={C.faint}
            style={{ flex: 1, fontFamily: F.regular, fontSize: TS.body, textAlign: 'right', writingDirection: 'rtl', color: C.text, paddingVertical: 11, marginRight: 8 }}
          />
        </Row>
        {family && (
          <HScroll style={{ paddingTop: 12 }}>
            <Chip label="كل العائلة" icon="account-group-outline" on={!who} onPress={() => setWho(null)} />
            {members.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => setWho(who === m.id ? null : m.id)}
                style={{
                  flexDirection: 'row-reverse', alignItems: 'center', gap: 6, paddingRight: 4, paddingLeft: 12, paddingVertical: 4,
                  borderRadius: 999, backgroundColor: who === m.id ? C.ink : C.surface, borderWidth: 1, borderColor: who === m.id ? C.ink : C.line,
                }}
              >
                <Avatar name={m.displayName} color={m.color} size={24} />
                <T size={TS.small} w={who === m.id ? 'semibold' : 'regular'} color={who === m.id ? '#fff' : C.text}>{m.displayName}</T>
              </Pressable>
            ))}
          </HScroll>
        )}
        <HScroll style={{ paddingVertical: 12 }}>
          <Chip label="الكل" on={!filter} onPress={() => setFilter(null)} />
          {categories.map((c) => (
            <Chip key={c.id} label={c.name} icon={c.icon} on={filter === c.id} onPress={() => setFilter(filter === c.id ? null : c.id)} />
          ))}
        </HScroll>
      </PageHeader>

      <SectionList
        sections={sections}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140 }}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Icon name="receipt-text-outline" size={40} color={C.faint} />
            <T color={C.sub} align="center" style={{ marginTop: 10 }}>
              {q || filter || who ? 'ما في نتائج. جرّب بحث أو تصنيف ثاني.' : 'ما في مصاريف بهذا الشهر. اضغط + لتسجيل مصروف.'}
            </T>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Row style={{ justifyContent: 'space-between', marginTop: 18, marginBottom: 8, paddingHorizontal: 4 }}>
            <T w="semibold" size={TS.small} color={C.sub}>{dayLabel(section.date)}</T>
            <T size={TS.small} color={C.sub}>{Math.round(section.total).toLocaleString('en-US')} درهم</T>
          </Row>
        )}
        renderItem={({ item, index, section }) => (
          <View
            style={{
              backgroundColor: C.surface,
              borderTopLeftRadius: index === 0 ? 20 : 0,
              borderTopRightRadius: index === 0 ? 20 : 0,
              borderBottomLeftRadius: index === section.data.length - 1 ? 20 : 0,
              borderBottomRightRadius: index === section.data.length - 1 ? 20 : 0,
              overflow: 'hidden',
            }}
          >
            <ExpenseRow e={item} cat={catOf(item.categoryId)} member={memberOf(item.userId)} showMember={family} onPress={() => onEdit(item)} last={index === section.data.length - 1} />
          </View>
        )}
      />
    </View>
  );
}
