import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFamily } from '../family';
import { C, TS } from '../theme';
import { Member } from '../types';
import { Avatar, ErrorText, Field, Icon, PrimaryButton, Row, T } from '../ui';
import { PALETTE } from '../utils';
import { Sheet } from './Sheet';

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 }}>
      {PALETTE.map((p) => (
        <Pressable
          key={p}
          onPress={() => onChange(p)}
          accessibilityLabel="لون"
          style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: p, alignItems: 'center', justifyContent: 'center' }}
        >
          {value === p && <Icon name="check" size={18} color="#fff" />}
        </Pressable>
      ))}
    </View>
  );
}

/** Add a family member with their own username and password */
export function AddMemberSheet(props: { visible: boolean; onClose: () => void }) {
  if (!props.visible) return null;
  return <AddMemberForm {...props} />;
}

function AddMemberForm({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { addMember, members } = useFamily();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [color, setColor] = useState(PALETTE[(members.length * 3) % PALETTE.length]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ username: string; password: string } | null>(null);

  const save = async () => {
    if (!name.trim()) return setError('اكتب اسم الشخص');
    if (!/^[a-z0-9_.]{3,24}$/.test(username.trim().toLowerCase())) return setError('اسم المستخدم من 3 إلى 24 حرف إنجليزي صغير أو رقم، بدون مسافات');
    if (password.length < 6) return setError('كلمة المرور لازم تكون 6 خانات أو أكثر');
    setBusy(true);
    try {
      await addMember({ username, password, displayName: name, color });
      setDone({ username: username.trim().toLowerCase(), password });
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  if (done) {
    return (
      <Sheet visible={visible} onClose={onClose} title="تمت الإضافة" footer={<PrimaryButton label="تم" onPress={onClose} />}>
        <View style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Avatar name={name} color={color} size={64} />
          <T w="bold" size={TS.h2} align="center" style={{ marginTop: 10 }}>{name}</T>
          <T color={C.sub} align="center" style={{ marginTop: 4 }}>صار فرد بالعائلة. ابعتله بيانات الدخول:</T>
        </View>
        <View style={{ backgroundColor: C.paper, borderRadius: 16, padding: 16, marginTop: 12, marginBottom: 12, gap: 8 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T color={C.sub}>اسم المستخدم</T>
            <T w="bold" style={{ writingDirection: 'ltr' }}>{done.username}</T>
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <T color={C.sub}>كلمة المرور</T>
            <T w="bold" style={{ writingDirection: 'ltr' }}>{done.password}</T>
          </Row>
        </View>
        <T size={TS.tiny} color={C.faint} style={{ marginBottom: 8 }}>بيقدر يغيّر كلمة المرور بعد أول دخول من «حسابي».</T>
      </Sheet>
    );
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="إضافة فرد للعائلة"
      footer={
        <View>
          <ErrorText text={error} />
          <View style={{ height: 10 }} />
          <PrimaryButton label="أضف الفرد" onPress={save} busy={busy} />
        </View>
      }
    >
      <View style={{ alignItems: 'center', marginTop: 4 }}>
        <Avatar name={name || '؟'} color={color} size={56} />
      </View>
      <Field label="الاسم" value={name} onChangeText={setName} placeholder="مثلاً: أم عدي" />
      <Field label="اسم المستخدم" value={username} onChangeText={(t) => setUsername(t.toLowerCase())} ltr placeholder="sara" hint="حروف إنجليزية صغيرة وأرقام، بيستخدمه لتسجيل الدخول" />
      <Field label="كلمة المرور" value={password} onChangeText={setPassword} ltr secure placeholder="6 خانات أو أكثر" />
      <T w="semibold" size={TS.small} color={C.sub} style={{ marginTop: 16, marginBottom: 8 }}>اللون بالتحليل</T>
      <ColorPicker value={color} onChange={setColor} />
      <View style={{ height: 8 }} />
    </Sheet>
  );
}

/** Owner actions on another member: new password, remove */
export function MemberActionsSheet(props: { member: Member | null; onClose: () => void }) {
  if (!props.member) return null;
  return <MemberActions key={props.member.id} member={props.member} onClose={props.onClose} />;
}

function MemberActions({ member, onClose }: { member: Member; onClose: () => void }) {
  const { setMemberPassword, removeMember } = useFamily();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const savePassword = async () => {
    if (password.length < 6) return setError('كلمة المرور لازم تكون 6 خانات أو أكثر');
    setBusy(true); setError('');
    try {
      await setMemberPassword(member.id, password);
      setNote(`تم تغيير كلمة مرور ${member.displayName}.`);
      setPassword('');
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  const remove = async () => {
    if (!confirmRemove) return setConfirmRemove(true);
    setBusy(true);
    try {
      await removeMember(member.id);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Sheet visible={!!member} onClose={onClose} title={member.displayName}>
      <Row style={{ gap: 12, marginTop: 4 }}>
        <Avatar name={member.displayName} color={member.color} size={48} />
        <View style={{ flex: 1 }}>
          <T w="bold">{member.displayName}</T>
          <T size={TS.small} color={C.sub} style={{ writingDirection: 'ltr', textAlign: 'right' }}>@{member.username}</T>
        </View>
      </Row>

      <Field label="كلمة مرور جديدة" value={password} onChangeText={setPassword} ltr secure placeholder="6 خانات أو أكثر" />
      <View style={{ height: 12 }} />
      <PrimaryButton label="غيّر كلمة المرور" onPress={savePassword} busy={busy} />
      {!!note && <T size={TS.small} color={C.oasis} style={{ marginTop: 10 }}>{note}</T>}
      <ErrorText text={error} />

      <Pressable onPress={remove} disabled={busy} style={{ paddingVertical: 18 }}>
        <T size={TS.small} w="medium" color={C.pom} align="center">
          {confirmRemove ? `اضغط مرة ثانية لحذف ${member.displayName}. ما بيقدر يدخل بعدها، ومصاريفه بتضل بالسجل باسمه` : 'حذف من العائلة'}
        </T>
      </Pressable>
    </Sheet>
  );
}
