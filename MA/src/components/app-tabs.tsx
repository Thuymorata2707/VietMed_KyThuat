import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { FieldColors } from '@/constants/field-theme';

export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor={FieldColors.surface}
      indicatorColor={FieldColors.brandSoft}
      tintColor={FieldColors.brand}
      labelStyle={{ selected: { color: FieldColors.brand } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Hôm nay</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house" md="home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>Phiếu</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="doc.text" md="assignment" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="tasks">
        <NativeTabs.Trigger.Label>Công việc</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="checklist" md="task_alt" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="machines">
        <NativeTabs.Trigger.Label>Thiết bị</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="wrench.and.screwdriver" md="precision_manufacturing" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Cá nhân</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
