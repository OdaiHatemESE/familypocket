import { Link } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { AuthShell } from '../components/AuthShell';
import { useFamily } from '../family';
import { C } from '../theme';
import { ErrorText, Field, PrimaryButton, T } from '../ui';

export default function Login() {
  const { signIn } = useFamily();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!username.trim() || !password) return setError('اكتب اسم المستخدم وكلمة المرور');
    setBusy(true);
    setError('');
    try {
      await signIn(username, password);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <AuthShell title="تسجيل الدخول" subtitle="ادخل بحسابك الشخصي داخل حساب العائلة.">
      <Field label="اسم المستخدم" value={username} onChangeText={(t) => setUsername(t.toLowerCase())} ltr returnKeyType="next" />
      <Field label="كلمة المرور" value={password} onChangeText={setPassword} ltr secure onSubmitEditing={submit} returnKeyType="go" />
      <ErrorText text={error} />
      <View style={{ marginTop: 22 }}>
        <PrimaryButton label="ادخل" onPress={submit} busy={busy} />
      </View>
      <View style={{ marginTop: 28, alignItems: 'center', gap: 4 }}>
        <T color={C.sub} align="center">أول مرة تستخدموا التطبيق؟</T>
        <Link href="/register" replace>
          <T w="semibold" color={C.oasis} align="center">أنشئ حساب العائلة</T>
        </Link>
      </View>
    </AuthShell>
  );
}
