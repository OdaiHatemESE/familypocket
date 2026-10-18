import { router } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { PageHeader } from '../../components/PageHeader';
import { useFamily } from '../../family';
import { C, F, TS } from '../../theme';
import { Card, Chip, ErrorText, HScroll, Icon, PrimaryButton, Row, SectionHead, T } from '../../ui';
import { monthKey, monthLabel, num, shiftMonth } from '../../utils';

const CONFIRM_WORD = 'امسح';

/** Owner only: clear one month's spending, or everything the family has recorded, and start over */
export default function ResetScreen() {
  const { me, expenses, resetData } = useFamily();
  const thisMonth = monthKey(new Date());
  const months = useMemo(() => [0, -1, -2, -3, -4, -5].map((d) => shiftMonth(thisMonth, d)), [thisMonth]);
  const [month, setMonth] = useState(thisMonth);
  const inMonth = expenses.filter((e) => e.date.startsWith(month));
  const monthTotal = inMonth.reduce((a, e) => a + e.amount, 0);

  const [confirmMonth, setConfirmMonth] = useState(false);
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState<'month' | 'all' | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const scroll = useRef<ScrollView>(null);

  const run = async (scope: 'month' | 'all') => {
    setBusy(scope);
    setError('');
    setDone('');
    try {
      await resetData(scope, scope === 'month' ? month : undefined);
      setDone(scope === 'month' ? `انمسحت مصاريف ${monthLabel(month)}` : 'تفضّت كل البيانات، وبلّشتوا من جديد');
      setConfirmMonth(false);
      setWord('');
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(null);
    scroll.current?.scrollTo({ y: 0, animated: true });
  };

  if (me?.role !== 'owner') {
    return (
      <View style={{ flex: 1 }}>
        <PageHeader title="مسح البيانات" back />
        <Card style={{ margin: 16, padding: 20, alignItems: 'center' }}>
          <Icon name="lock-outline" size={36} color={C.faint} />
          <T color={C.sub} align="center" style={{ marginTop: 8 }}>صاحب الحساب بس بيقدر يمسح بيانات العائلة.</T>
        </Card>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <PageHeader title="مسح البيانات" back />
      <ScrollView ref={scroll} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Card style={{ padding: 14, marginTop: 8, backgroundColor: C.pom + '10' }}>
          <Row style={{ gap: 8, alignItems: 'flex-start' }}>
            <Icon name="alert-outline" size={20} color={C.pom} />
            <T size={TS.small} color={C.text} style={{ flex: 1 }}>
              المسح نهائي وما بيرجع. أفراد العائلة وحساباتهم وكلمات المرور بيضلّوا زي ما هم.
            </T>
          </Row>
        </Card>
        {!!done && (
          <Card style={{ padding: 14, marginTop: 12, backgroundColor: C.oasis + '14' }}>
            <Row style={{ gap: 8 }}>
              <Icon name="check-circle-outline" size={20} color={C.oasis} />
              <T size={TS.small} w="semibold" color={C.oasis} style={{ flex: 1 }}>{done}</T>
            </Row>
          </Card>
        )}
        <ErrorText text={error} />

        {/* One month */}
        <SectionHead title="مسح مصاريف شهر" />
        <Card style={{ padding: 16 }}>
          <HScroll>
            {months.map((m) => (
              <Chip key={m} label={monthLabel(m)} on={m === month} onPress={() => (setMonth(m), setConfirmMonth(false))} />
            ))}
          </HScroll>
          <T style={{ marginTop: 14 }}>
            {inMonth.length ? `${inMonth.length} مصروف بـ ${num(monthTotal)} درهم بـ ${monthLabel(month)}.` : `ما في مصاريف مسجّلة بـ ${monthLabel(month)}.`}
          </T>
          <T size={TS.small} color={C.sub} style={{ marginTop: 4, marginBottom: 14 }}>
            بينمسح كل مصاريف وفواتير هالشهر، ومعها دفعات الالتزامات والمبالغ المجنّبة فيه. الميزانيات والرواتب والالتزامات والتصنيفات بتضل.
          </T>
          <PrimaryButton
            tone="danger"
            label={confirmMonth ? 'متأكد؟ اضغط مرة ثانية للمسح' : `امسح مصاريف ${monthLabel(month)}`}
            busy={busy === 'month'}
            disabled={!!busy}
            onPress={() => (confirmMonth ? run('month') : setConfirmMonth(true))}
          />
        </Card>

        {/* Everything */}
        <SectionHead title="ابدأ من جديد" />
        <Card style={{ padding: 16 }}>
          <T>بينمسح كل إشي سجّلتوه:</T>
          {['كل المصاريف والفواتير', 'الميزانيات والرواتب', 'الالتزامات والشيكات والمبالغ المجنّبة', 'الأصناف، والتصنيفات بترجع للأساسية'].map((t) => (
            <Row key={t} style={{ gap: 8, marginTop: 6 }}>
              <Icon name="close-circle-outline" size={16} color={C.pom} />
              <T size={TS.small} color={C.sub}>{t}</T>
            </Row>
          ))}
          <T size={TS.small} w="semibold" style={{ marginTop: 16, marginBottom: 8 }}>للتأكيد اكتب «{CONFIRM_WORD}»</T>
          <TextInput
            value={word}
            onChangeText={setWord}
            placeholder={CONFIRM_WORD}
            placeholderTextColor={C.faint}
            accessibilityLabel="كلمة التأكيد"
            style={{ fontFamily: F.semibold, fontSize: TS.body, color: C.text, textAlign: 'right', backgroundColor: C.paper, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 14 }}
          />
          <PrimaryButton tone="danger" label="امسح كل البيانات" busy={busy === 'all'} disabled={!!busy || word.trim() !== CONFIRM_WORD} onPress={() => run('all')} />
        </Card>

        {!!done && (
          <View style={{ marginTop: 20 }}>
            <PrimaryButton label="رجوع للرئيسية" onPress={() => router.replace('/')} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
