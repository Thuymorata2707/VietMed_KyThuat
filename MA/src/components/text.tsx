import { forwardRef } from 'react';
import { StyleSheet, Text as NativeText, TextInput as NativeTextInput, TextInputProps, TextProps } from 'react-native';

const families = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extraBold: 'Inter_800ExtraBold',
  black: 'Inter_900Black',
} as const;

function fontFor(style: TextProps['style'] | TextInputProps['style']) {
  const weight = StyleSheet.flatten(style)?.fontWeight;
  if (weight === '900' || weight === 900) return families.black;
  if (weight === '800' || weight === 800) return families.extraBold;
  if (weight === '700' || weight === 700 || weight === 'bold') return families.bold;
  if (weight === '600' || weight === 600) return families.semibold;
  if (weight === '500' || weight === 500 || weight === 'medium') return families.medium;
  return families.regular;
}

export const Text = forwardRef<NativeText, TextProps>(function AppText({ style, ...props }, ref) {
  return <NativeText ref={ref} {...props} style={[{ fontFamily: fontFor(style) }, style]} />;
});

export const TextInput = forwardRef<NativeTextInput, TextInputProps>(function AppTextInput({ style, ...props }, ref) {
  return <NativeTextInput ref={ref} {...props} style={[{ fontFamily: fontFor(style) }, style]} />;
});
