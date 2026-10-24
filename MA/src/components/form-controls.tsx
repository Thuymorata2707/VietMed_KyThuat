import { Text, TextInput } from '@/components/text';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, TextInputProps, View } from 'react-native';
import { FieldColors } from '@/constants/field-theme';

export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <View style={styles.section}><View style={styles.sectionHead}><Text style={styles.sectionTitle}>{title}</Text>{description ? <Text style={styles.sectionDescription}>{description}</Text> : null}</View>{children}</View>;
}

export function FormField({ label, required, error, style, ...inputProps }: TextInputProps & { label: string; required?: boolean; error?: string }) {
  return <View style={styles.field}><Text style={styles.label}>{label}{required ? <Text style={styles.required}> *</Text> : null}</Text><TextInput {...inputProps} style={[styles.input, inputProps.multiline && styles.multiline, inputProps.editable === false && styles.readOnly, style]} />{error ? <Text style={styles.error}>{error}</Text> : null}</View>;
}

export function FormSelect({ label, value, placeholder, onPress, required, disabled }: { label: string; value?: string; placeholder: string; onPress: () => void; required?: boolean; disabled?: boolean }) {
  return <View style={styles.field}><Text style={styles.label}>{label}{required ? <Text style={styles.required}> *</Text> : null}</Text><Pressable disabled={disabled} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.select, pressed && styles.pressed, disabled && styles.readOnly]}><Text numberOfLines={1} style={[styles.selectText, !value && styles.placeholder]}>{value || placeholder}</Text><Text style={styles.chevron}>⌄</Text></Pressable></View>;
}

export function FormChoiceGroup<T extends string>({ label, value, options, onChange }: { label?: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return <View style={styles.field}>{label ? <Text style={styles.label}>{label}</Text> : null}<View style={styles.choices}>{options.map((option) => { const active = value === option.value; return <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ selected: active }} onPress={() => onChange(option.value)} style={({ pressed }) => [styles.choice, active && styles.choiceActive, pressed && styles.pressed]}><Text style={[styles.choiceText, active && styles.choiceTextActive]}>{option.label}</Text></Pressable>; })}</View></View>;
}

const styles = StyleSheet.create({
  section: { gap: 14, paddingTop: 3 },
  sectionHead: { gap: 4, marginBottom: 1 },
  sectionTitle: { color: FieldColors.ink, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  sectionDescription: { color: FieldColors.muted, fontSize: 12, lineHeight: 18 },
  field: { gap: 7 },
  label: { color: FieldColors.ink, fontSize: 12, fontWeight: '600' },
  required: { color: FieldColors.red },
  input: { backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderRadius: 12, borderWidth: 1, color: FieldColors.ink, fontSize: 14, minHeight: 51, paddingHorizontal: 14, paddingVertical: 11 },
  multiline: { minHeight: 108, paddingTop: 13, textAlignVertical: 'top' },
  readOnly: { backgroundColor: '#F0EFED', color: FieldColors.muted },
  error: { color: FieldColors.red, fontSize: 12 },
  select: { alignItems: 'center', backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderRadius: 12, borderWidth: 1, flexDirection: 'row', minHeight: 51, paddingHorizontal: 14 },
  selectText: { color: FieldColors.ink, flex: 1, fontSize: 14 },
  placeholder: { color: '#899794' },
  chevron: { color: FieldColors.muted, fontSize: 17 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { backgroundColor: '#ECEAE7', borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10 },
  choiceActive: { backgroundColor: FieldColors.brandSoft },
  choiceText: { color: FieldColors.muted, fontSize: 12, fontWeight: '600' },
  choiceTextActive: { color: FieldColors.brandDark, fontWeight: '700' },
  pressed: { opacity: 0.78 },
});
