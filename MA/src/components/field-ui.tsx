import { Text } from '@/components/text';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { FieldColors, FieldRadius } from '@/constants/field-theme';

const iconNames = {
  bell: { ios: 'bell', android: 'notifications', web: 'notifications' },
  calendar: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  chevron: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  clock: { ios: 'clock', android: 'schedule', web: 'schedule' },
  document: { ios: 'doc.text', android: 'description', web: 'description' },
  filter: { ios: 'slider.horizontal.3', android: 'tune', web: 'tune' },
  headset: { ios: 'headphones', android: 'support_agent', web: 'support_agent' },
  home: { ios: 'house.fill', android: 'home', web: 'home' },
  location: { ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' },
  lock: { ios: 'lock.fill', android: 'lock', web: 'lock' },
  machine: { ios: 'waveform.path.ecg', android: 'medical_services', web: 'medical_services' },
  plus: { ios: 'plus', android: 'add', web: 'add' },
  qr: { ios: 'qrcode.viewfinder', android: 'qr_code_scanner', web: 'qr_code_scanner' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  tool: { ios: 'wrench.and.screwdriver', android: 'build', web: 'build' },
  user: { ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' },
  wifi: { ios: 'wifi', android: 'wifi', web: 'wifi' },
} as const;

export type FieldIconName = keyof typeof iconNames;

export function FieldIcon({
  name,
  size = 20,
  color = FieldColors.ink,
}: {
  name: FieldIconName;
  size?: number;
  color?: string;
}) {
  return <SymbolView name={iconNames[name]} size={size} tintColor={color} />;
}

export function Eyebrow({ children, color = FieldColors.muted }: { children: string; color?: string }) {
  return <Text style={[styles.eyebrow, { color }]}>{children}</Text>;
}

export function SectionHeading({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} style={styles.sectionAction}>
          <Text style={styles.sectionActionText}>{action}</Text>
          <FieldIcon name="chevron" size={14} color={FieldColors.brand} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function StatusPill({
  label,
  tone = 'blue',
}: {
  label: string;
  tone?: 'blue' | 'green' | 'amber' | 'red' | 'neutral';
}) {
  const tones = {
    blue: [FieldColors.blueSoft, FieldColors.blue],
    green: [FieldColors.greenSoft, FieldColors.green],
    amber: [FieldColors.amberSoft, '#9B6815'],
    red: [FieldColors.redSoft, FieldColors.red],
    neutral: ['#F5F4F1', FieldColors.muted],
  } as const;
  const [backgroundColor, color] = tones[tone];

  return (
    <View style={[styles.pill, { backgroundColor }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

export function IconButton({
  icon,
  onPress,
  badge,
}: {
  icon: FieldIconName;
  onPress?: () => void;
  badge?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
      <FieldIcon name={icon} size={19} color={FieldColors.ink} />
      {badge ? <View style={styles.notificationDot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.05,
  },
  sectionHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    color: FieldColors.ink,
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.35,
  },
  sectionAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  sectionActionText: {
    color: FieldColors.brand,
    fontSize: 14,
    fontWeight: '700',
  },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: FieldColors.surface,
    borderRadius: FieldRadius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  notificationDot: {
    backgroundColor: FieldColors.red,
    borderColor: FieldColors.canvas,
    borderRadius: 5,
    borderWidth: 1.5,
    height: 10,
    position: 'absolute',
    right: 9,
    top: 8,
    width: 10,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
});
