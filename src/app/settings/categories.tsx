import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { CategorySheet } from '../../components/CategorySheet';
import { PageHeader } from '../../components/PageHeader';
import { useFamily } from '../../family';
import { C, TS } from '../../theme';
import { Category } from '../../types';
import { Card, CatTile, Icon, T } from '../../ui';

export default function CategoriesScreen() {
  const { categories, expenses } = useFamily();
  const [editing, setEditing] = useState<Category | null>(null);
  const [open, setOpen] = useState(false);
  const countOf = (id: string) => expenses.filter((e) => e.categoryId === id).length;

  return (
    <View style={{ flex: 1 }}>
      <PageHeader title="التصنيفات" back />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <T size={TS.small} color={C.sub} style={{ marginTop: 4, marginBottom: 12 }}>
          التصنيفات مشتركة لكل العائلة. حصة كل تصنيف بتتحدد لكل فرد من «البادجت الشهري».
        </T>
        <Card>
          {categories.map((c, i) => (
            <Pressable
              key={c.id}
              onPress={() => (setEditing(c), setOpen(true))}
              style={({ pressed }) => ({
                flexDirection: 'row-reverse', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14,
                borderTopWidth: i ? 1 : 0, borderColor: C.line, backgroundColor: pressed ? C.paper : 'transparent',
              })}
            >
              <CatTile icon={c.icon} color={c.color} size={40} />
              <View style={{ flex: 1 }}>
                <T w="semibold">{c.name}</T>
                <T size={TS.small} color={C.sub}>{countOf(c.id)} مصروف</T>
              </View>
              <Icon name="chevron-left" size={22} color={C.faint} />
            </Pressable>
          ))}
          <Pressable
            onPress={() => (setEditing(null), setOpen(true))}
            style={({ pressed }) => ({
              flexDirection: 'row-reverse', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14,
              borderTopWidth: categories.length ? 1 : 0, borderColor: C.line, backgroundColor: pressed ? C.paper : 'transparent',
            })}
          >
            <View style={{ width: 40, height: 40, borderRadius: 13, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.oasis, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="plus" size={22} color={C.oasis} />
            </View>
            <T w="semibold" color={C.oasis}>تصنيف جديد</T>
          </Pressable>
        </Card>
      </ScrollView>
      <CategorySheet visible={open} editing={editing} onClose={() => setOpen(false)} />
    </View>
  );
}
