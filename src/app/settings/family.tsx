import React, { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { AddMemberSheet, MemberActionsSheet } from '../../components/MemberSheets';
import { PageHeader } from '../../components/PageHeader';
import { useFamily } from '../../family';
import { C, F, TS } from '../../theme';
import { Member } from '../../types';
import { Avatar, Card, ErrorText, Icon, Row, SectionHead, T } from '../../ui';

export default function FamilyScreen() {
  const { me, members, household, renameHousehold } = useFamily();
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Member | null>(null);
  const [name, setName] = useState(household?.name ?? '');
  const [error, setError] = useState('');
  const isOwner = me?.role === 'owner';

  const saveName = async () => {
    if (!name.trim() || name.trim() === household?.name) return;
    try {
      setError('');
      await renameHousehold(name);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <PageHeader title="أفراد العائلة" back />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 8, marginBottom: 6 }}>اسم العائلة</T>
        <TextInput
          value={name}
          onChangeText={setName}
          onBlur={saveName}
          onSubmitEditing={saveName}
          style={{ fontFamily: F.medium, fontSize: TS.body, textAlign: 'right', writingDirection: 'rtl', color: C.text, backgroundColor: C.surface, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13 }}
        />
        <ErrorText text={error} />

        <SectionHead title={`${members.length} ${members.length === 1 ? 'فرد' : 'أفراد'}`} />
        <Card>
          {members.map((m, i) => {
            const canManage = isOwner && m.id !== me?.id;
            return (
              <Pressable
                key={m.id}
                onPress={canManage ? () => setSelected(m) : undefined}
                style={({ pressed }) => ({
                  flexDirection: 'row-reverse', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14,
                  borderTopWidth: i ? 1 : 0, borderColor: C.line, backgroundColor: pressed && canManage ? C.paper : 'transparent',
                })}
              >
                <Avatar name={m.displayName} color={m.color} size={42} />
                <View style={{ flex: 1 }}>
                  <Row style={{ gap: 8 }}>
                    <T w="semibold">{m.displayName}</T>
                    {m.id === me?.id && <T size={TS.tiny} color={C.sub}>(إنت)</T>}
                  </Row>
                  <T size={TS.small} color={C.sub} style={{ writingDirection: 'ltr', textAlign: 'right' }}>@{m.username}</T>
                </View>
                {m.role === 'owner' && (
                  <View style={{ backgroundColor: C.ink, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
                    <T size={TS.tiny} w="semibold" color="#fff">صاحب الحساب</T>
                  </View>
                )}
                {canManage && <Icon name="chevron-left" size={22} color={C.faint} />}
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setAdding(true)}
            style={({ pressed }) => ({
              flexDirection: 'row-reverse', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14,
              borderTopWidth: 1, borderColor: C.line, backgroundColor: pressed ? C.paper : 'transparent',
            })}
          >
            <View style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.oasis, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="plus" size={22} color={C.oasis} />
            </View>
            <T w="semibold" color={C.oasis}>إضافة فرد</T>
          </Pressable>
        </Card>

        <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 16, paddingHorizontal: 4 }}>
          <Icon name="shield-account-outline" size={18} color={C.sub} />
          <T size={TS.small} color={C.sub} style={{ flex: 1 }}>
            كل فرد بيدخل بحسابه وبيسجل مصاريفه باسمه. الكل بيشوف مصاريف العائلة وبيقدر يعدّل البادجت والإجبارية، وكل واحد بيعدّل مصاريفه هو بس.
            {isOwner ? ' كصاحب الحساب، اضغط على أي فرد لتغيير كلمة مروره أو حذفه.' : ''}
          </T>
        </View>
      </ScrollView>

      <AddMemberSheet visible={adding} onClose={() => setAdding(false)} />
      <MemberActionsSheet member={selected} onClose={() => setSelected(null)} />
    </View>
  );
}
