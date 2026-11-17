import type { TextStyle } from 'react-native';

export { C } from './data';

// Bundled fonts (assets/fonts, linked via react-native-asset). Files are named by
// PostScript name, so the same fontFamily string works on iOS and Android.
const FAMILIES = {
  cond: { 500: 'BarlowCondensed-Medium', 600: 'BarlowCondensed-SemiBold', 700: 'BarlowCondensed-Bold', 800: 'BarlowCondensed-ExtraBold', 900: 'BarlowCondensed-Black' },
  body: { 400: 'Barlow-Regular', 500: 'Barlow-Medium', 600: 'Barlow-SemiBold', 700: 'Barlow-Bold' },
  mono: { 500: 'JetBrainsMono-Medium', 600: 'JetBrainsMono-SemiBold' },
} as const;

type Family = keyof typeof FAMILIES;

function font<F extends Family>(fam: F, size: number, weight: keyof (typeof FAMILIES)[F], lh?: number): TextStyle {
  return {
    fontFamily: FAMILIES[fam][weight] as string,
    fontSize: size,
    includeFontPadding: false,
    // Only set lineHeight for wrapping text; tight (<1) line-heights clip glyphs on iOS for single lines.
    ...(lh !== undefined && { lineHeight: Math.round(size * lh) }),
  };
}

/** Barlow Condensed: display numbers and headings. */
export const cond = (size: number, weight: 500 | 600 | 700 | 800 | 900 = 800, lh?: number) => font('cond', size, weight, lh);
/** Barlow: body copy. */
export const body = (size: number, weight: 400 | 500 | 600 | 700 = 500, lh?: number) => font('body', size, weight, lh);
/** JetBrains Mono: labels, units and data. */
export const mono = (size: number, weight: 500 | 600 = 600, lh?: number) => font('mono', size, weight, lh);

/** CSS `letter-spacing: Nem` → RN px. */
export const em = (size: number, n: number) => size * n;

/** Body-map colours for muscles trained by an exercise or a session. */
export const WORK_PRIMARY = '#c8f53c';
export const WORK_SECONDARY = '#5f7a1c';
export const WORK_NONE = '#232523';
