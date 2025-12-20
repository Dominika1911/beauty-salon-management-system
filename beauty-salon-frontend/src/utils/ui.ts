// src/utils/ui.ts
// Wspólne, proste style (bez nowych bibliotek UI).
// Uwaga: używamy CSS variables z Twoich plików (beauty-*), a tam gdzie ich nie ma – fallback.

import type { CSSProperties } from 'react';

export const beautyColors = {
  primary: 'var(--beauty-primary, #E91E63)',
  primaryDark: 'var(--beauty-primary-dark, #C2185B)',
  primaryDarker: 'var(--beauty-primary-darker, #880E4F)',
  primaryLight: 'var(--beauty-primary-light, #FCE4EC)',
  bg: 'var(--beauty-primary-bg, #FFF5FA)',
  text: 'var(--beauty-text-primary, #2c3e50)',
  muted: 'rgba(44, 62, 80, 0.75)',
  border: 'rgba(233, 30, 99, 0.20)',
  danger: 'var(--beauty-danger, #e74c3c)',
  dangerDark: 'var(--beauty-danger-dark, #c0392b)',
};

export const beautyCardStyle: CSSProperties = {
  background: '#fff',
  border: `1px solid ${beautyColors.border}`,
  borderRadius: 12,
  boxShadow: '0 6px 18px rgba(0,0,0,0.06)',
};

export const beautyCardHeaderStyle: CSSProperties = {
  padding: '12px 14px',
  borderBottom: `1px solid ${beautyColors.border}`,
  background: beautyColors.bg,
  borderTopLeftRadius: 12,
  borderTopRightRadius: 12,
};

export const beautyCardBodyStyle: CSSProperties = {
  padding: 14,
};

export const beautyInputStyle: CSSProperties = {
  width: '100%',
  padding: 10,
  borderRadius: 10,
  border: `1px solid ${beautyColors.border}`,
  background: '#fff',
  outline: 'none',
};

export const beautySelectStyle: CSSProperties = beautyInputStyle;

export const beautyButtonStyle: CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: `1px solid ${beautyColors.primary}`,
  background: beautyColors.primary,
  color: '#fff',
  fontWeight: 750,
  cursor: 'pointer',
};

export const beautyButtonSecondaryStyle: CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: `1px solid ${beautyColors.border}`,
  background: '#fff',
  color: beautyColors.text,
  fontWeight: 650,
  cursor: 'pointer',
};

export const beautyButtonDangerStyle: CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: `1px solid ${beautyColors.danger}`,
  background: beautyColors.danger,
  color: '#fff',
  fontWeight: 750,
  cursor: 'pointer',
};

export const beautyPageTitleStyle: CSSProperties = {
  margin: 0,
  color: beautyColors.primaryDarker,
};

export const beautyMutedTextStyle: CSSProperties = {
  marginTop: 6,
  color: beautyColors.muted,
};
