import { Link } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { AuthShell } from '../components/AuthShell';
import { useFamily } from '../family';
import { C } from '../theme';
import { ErrorText, Field, PrimaryButton, T } from '../ui';

export default function Register() {
  const { register } = useFamily();
  const [name, setName] = useState('');
  const [family, setFamily] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return setError('اكتب اسمك');
    if (!/^[a-z0-9_.]{3,24}$/.test(username.trim())) return setError('اسم المستخدم من 3 إلى 24 حرف إنجليزي صغير أو رقم، بدون مسافات');
    if (password.length < 6) return setError('كلمة المرور لازم تكون 6 خانات أو أكثر');
    setBusy(true);
    setError('');
    try {
      await register({ username, password, displayName: name, familyName: family });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <AuthShell title="حساب العائلة" subtitle="إنت صاحب الحساب، وبعدها بتضيف باقي أفراد العائلة من الإعدادات.">
      <Field label="اسمك" value={name} onChangeText={setName} placeholder="مثلاً: عدي" />
      <Field label="اسم العائلة" value={family} onChangeText={setFamily} placeholder="مثلاً: بيت حاتم" />
      <Field label="اسم المستخدم" value={username} onChangeText={(t) => setUsername(t.toLowerCase())} ltr hint="حروف إنجليزية صغيرة وأرقام، بتستخدمه لتسجيل الدخول" />
      <Field label="كلمة المرور" value={password} onChangeText={setPassword} ltr secure placeholder="6 خانات أو أكثر" onSubmitEditing={submit} />
      <ErrorText text={error} />
      <View style={{ marginTop: 22 }}>
        <PrimaryButton label="أنشئ الحساب" onPress={submit} busy={busy} />
      </View>
      <View style={{ marginTop: 28, alignItems: 'center', gap: 4 }}>
        <T color={C.sub} align="center">عندك حساب؟</T>
        <Link href="/login" replace>
          <T w="semibold" color={C.oasis} align="center">سجّل دخول</T>
        </Link>
      </View>
    </AuthShell>
  );
}
