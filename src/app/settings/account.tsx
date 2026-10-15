import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ColorPicker } from '../../components/MemberSheets';
import { PageHeader } from '../../components/PageHeader';
import { useFamily } from '../../family';
import { C, TS } from '../../theme';
import { Avatar, Card, ErrorText, Field, PrimaryButton, T } from '../../ui';

export default function AccountScreen() {
  const { me, updateMe, changePassword } = useFamily();
  const [name, setName] = useState(me?.displayName ?? '');
  const [color, setColor] = useState(me?.color ?? '#2E5EAA');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const saveProfile = async () => {
    if (!name.trim()) return setProfileErr('اكتب اسمك');
    setSavingProfile(true); setProfileErr(''); setProfileMsg('');
    try {
      await updateMe({ displayName: name, color });
      setProfileMsg('تم الحفظ');
    } catch (e) {
      setProfileErr((e as Error).message);
    }
    setSavingProfile(false);
  };

  const savePassword = async () => {
    if (pw.length < 6) return setPwErr('كلمة المرور لازم تكون 6 خانات أو أكثر');
    if (pw !== pw2) return setPwErr('كلمتي المرور مش متطابقتين');
    setSavingPw(true); setPwErr(''); setPwMsg('');
    try {
      await changePassword(pw);
      setPw(''); setPw2('');
      setPwMsg('تم تغيير كلمة المرور');
    } catch (e) {
      setPwErr((e as Error).message);
    }
    setSavingPw(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <PageHeader title="حسابي" back />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Card style={{ padding: 16, marginTop: 8 }}>
          <View style={{ alignItems: 'center' }}>
            <Avatar name={name || '؟'} color={color} size={64} />
            <T size={TS.small} color={C.sub} align="center" style={{ marginTop: 6, writingDirection: 'ltr' }}>@{me?.username}</T>
          </View>
          <Field label="الاسم" value={name} onChangeText={setName} />
          <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 14, marginBottom: 8 }}>لونك بالتحليل</T>
          <ColorPicker value={color} onChange={setColor} />
          <ErrorText text={profileErr} />
          <View style={{ marginTop: 16 }}>
            <PrimaryButton label="احفظ" onPress={saveProfile} busy={savingProfile} />
          </View>
          {!!profileMsg && <T size={TS.small} color={C.oasis} align="center" style={{ marginTop: 8 }}>{profileMsg}</T>}
        </Card>

        <T w="bold" size={TS.h2} style={{ marginTop: 28, marginBottom: 4 }}>كلمة المرور</T>
        <Card style={{ padding: 16 }}>
          <Field label="كلمة المرور الجديدة" value={pw} onChangeText={setPw} ltr secure placeholder="6 خانات أو أكثر" />
          <Field label="أكّد كلمة المرور" value={pw2} onChangeText={setPw2} ltr secure onSubmitEditing={savePassword} />
          <ErrorText text={pwErr} />
          <View style={{ marginTop: 16 }}>
            <PrimaryButton label="غيّر كلمة المرور" onPress={savePassword} busy={savingPw} />
          </View>
          {!!pwMsg && <T size={TS.small} color={C.oasis} align="center" style={{ marginTop: 8 }}>{pwMsg}</T>}
        </Card>
      </ScrollView>
    </View>
  );
}
