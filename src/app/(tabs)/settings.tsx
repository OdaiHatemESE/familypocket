import { router } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { PageHeader } from '../../components/PageHeader';
import { useFamily } from '../../family';
import { C, TS } from '../../theme';
import { Avatar, Card, ListRow, Row, SectionHead, T } from '../../ui';
import { monthKey, monthName, num } from '../../utils';

export default function Settings() {
  const { me, household, members, categories, fixed, signOut, budgetsFor } = useFamily();
  const [confirmOut, setConfirmOut] = useState(false);
  const month = monthKey(new Date());
  const budgets = budgetsFor(month);
  const totalBudget = members.reduce((a, m) => a + (budgets[m.id]?.total ?? 0), 0);
  const unset = members.filter((m) => !budgets[m.id]?.total).length;
  const activeFixed = fixed.filter((f) => f.active);
  const fixedTotal = activeFixed.reduce((a, f) => a + f.amount / (f.everyMonths || 1), 0);

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
            iconColor={C.oasis}
            title="البادجت الشهري"
            detail={
              totalBudget
                ? `${monthName(month)}: ${num(totalBudget)} درهم${unset ? `، ${unset} بدون بادجت` : ''}`
                : 'حدّد بادجت كل فرد ووزّعه على التصنيفات'
            }
            onPress={() => router.push('/settings/budgets')}
          />
          <ListRow
            icon="shape-outline"
            iconColor="#3B8EA5"
            title="التصنيفات"
            detail={`${categories.length} تصنيف`}
            onPress={() => router.push('/settings/categories')}
          />
          <ListRow
            icon="calendar-sync-outline"
            iconColor="#C9822B"
            title="الراتب والالتزامات"
            detail={activeFixed.length ? `${activeFixed.length} التزامات، ${num(fixedTotal)} درهم بالشهر` : 'الراتب، الإيجار، المدارس، الفواتير، التحويلات'}
            onPress={() => router.push('/settings/fixed')}
            last
          />
        </Card>

        <SectionHead title="حسابي" />
        <Card>
          <ListRow icon="account-circle-outline" iconColor="#6B4FA3" title="الاسم واللون وكلمة المرور" detail={`@${me?.username}`} onPress={() => router.push('/settings/account')} />
          <ListRow icon="lightbulb-on-outline" iconColor={C.oasis} title="تعرّف على قديش" detail="شو بيعمل التطبيق وكيف تستخدمه" onPress={() => router.push('/settings/intro')} />
          {me?.role === 'owner' && (
            <ListRow icon="delete-sweep-outline" title="مسح البيانات" detail="مصاريف شهر، أو ابدأوا من جديد" danger onPress={() => router.push('/settings/reset')} />
          )}
          <ListRow
            icon="logout"
            title={confirmOut ? 'اضغط مرة ثانية لتسجيل الخروج' : 'تسجيل الخروج'}
            danger
            onPress={() => (confirmOut ? signOut() : setConfirmOut(true))}
            last
          />
        </Card>
        <T size={TS.tiny} color={C.faint} align="center" style={{ marginTop: 24 }}>قديش، بياناتكم محفوظة ومتزامنة بين أجهزة العائلة.</T>
      </ScrollView>
    </View>
  );
}
