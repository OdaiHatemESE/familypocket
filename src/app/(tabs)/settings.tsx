import { router } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { PageHeader } from '../../components/PageHeader';
import { useFamily } from '../../family';
import { C, TS } from '../../theme';
import { Avatar, Card, ListRow, Row, SectionHead, T } from '../../ui';
import { num } from '../../utils';

export default function Settings() {
  const { me, household, members, categories, fixed, signOut } = useFamily();
  const [confirmOut, setConfirmOut] = useState(false);
  const totalBudget = categories.reduce((a, c) => a + c.monthlyBudget, 0);
  const activeFixed = fixed.filter((f) => f.active);
  const fixedTotal = activeFixed.reduce((a, f) => a + f.amount, 0);

  return (
    <View style={{ flex: 1 }}>
      <PageHeader title="الإعدادات" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <Card style={{ padding: 16, marginTop: 8 }}>
          <Row style={{ gap: 12 }}>
            <Avatar name={me?.displayName ?? '؟'} color={me?.color ?? C.faint} size={52} />
            <View style={{ flex: 1 }}>
              <T w="bold" size={TS.h2}>{me?.displayName}</T>
              <T size={TS.small} color={C.sub}>
                {household?.name}، {me?.role === 'owner' ? 'صاحب الحساب' : 'فرد بالعائلة'}
              </T>
            </View>
          </Row>
        </Card>

        <SectionHead title="العائلة والميزانية" />
        <Card>
          <ListRow
            icon="account-group-outline"
            iconColor="#2E5EAA"
            title="أفراد العائلة"
            detail={members.map((m) => m.displayName).join('، ')}
            onPress={() => router.push('/settings/family')}
          />
          <ListRow
            icon="chart-donut"
            iconColor="#0F7B6C"
            title="البادجت والتصنيفات"
            detail={`${categories.length} تصنيف، بادجت شهري ${num(totalBudget)} درهم`}
            onPress={() => router.push('/settings/budgets')}
          />
          <ListRow
            icon="calendar-sync-outline"
            iconColor="#C9822B"
            title="المصاريف الإجبارية"
            detail={activeFixed.length ? `${activeFixed.length} شهرياً بمجموع ${num(fixedTotal)} درهم` : 'إيجار، أقساط، فواتير ثابتة'}
            onPress={() => router.push('/settings/fixed')}
            last
          />
        </Card>

        <SectionHead title="حسابي" />
        <Card>
          <ListRow icon="account-circle-outline" iconColor="#6B4FA3" title="الاسم واللون وكلمة المرور" detail={`@${me?.username}`} onPress={() => router.push('/settings/account')} />
          <ListRow
            icon="logout"
            title={confirmOut ? 'اضغط مرة ثانية لتسجيل الخروج' : 'تسجيل الخروج'}
            danger
            onPress={() => (confirmOut ? signOut() : setConfirmOut(true))}
            last
          />
        </Card>
        <T size={TS.tiny} color={C.faint} align="center" style={{ marginTop: 24 }}>مصاريفي، بياناتكم محفوظة ومتزامنة بين أجهزة العائلة.</T>
      </ScrollView>
    </View>
  );
}
