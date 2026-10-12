// Doğum tarihi alanı: rakam klavyesi, "GG.AA.YYYY" maskesi ve altında hesaplanan yaş.
// Yerel tarih seçici bilerek yok: yeni native modül EAS Update ile gönderilemez.
import React, { forwardRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import AuthInput from './AuthInput';
import { maskBirthInput, parseBirthDate } from '../../utils/profileInfo';

const BirthDateInput = forwardRef(function BirthDateInput({ value, onChangeText, error, ...rest }, ref) {
  const { t } = useLanguage();
  const parsed = value?.length === 10 ? parseBirthDate(value) : null;
  const hint = parsed?.age != null && !parsed.error
    ? t('reg_birth_age', { age: parsed.age })
    : t('reg_birth_hint');
  return (
    <AuthInput
      ref={ref}
      icon="calendar-outline"
      placeholder={t('reg_birth_placeholder')}
      value={value}
      onChangeText={(v) => onChangeText(maskBirthInput(v))}
      keyboardType="number-pad"
      maxLength={10}
      autoComplete="birthdate-full"
      textContentType="none"
      hint={hint}
      error={error}
      {...rest}
    />
  );
});

export default BirthDateInput;
