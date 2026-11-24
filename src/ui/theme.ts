/* Visual language: bright, high-contrast option, large targets (SPEC R-G4, §11.3). Layout is RTL via row-reverse. */
import { useWindowDimensions } from 'react-native';
import { useProfile, DEFAULT_SETTINGS, type Settings } from '../state/store';

export const ROW = 'row-reverse' as const;

export const FONT = {
  read: 'NotoSansHebrew_700Bold',
  readMed: 'NotoSansHebrew_500Medium',
  serif: 'NotoSerifHebrew_700Bold',
  ui: 'Rubik_700Bold',
  uiHeavy: 'Rubik_800ExtraBold',
  uiMed: 'Rubik_500Medium',
};

const NORMAL = {
  bg: '#FFF6E5', ink: '#24304A', soft: '#6B7A99', card: '#FFFFFF', line: '#24304A',
  orange: '#FF8A00', blue: '#2D7FF9', green: '#2EB85C', red: '#F25C54', purple: '#8E5CF7', yellow: '#FFC928', teal: '#13B5B1', pink: '#FF5FA2',
  good: '#2EB85C', bad: '#F25C54', glow: '#FFC928', shadow: 'rgba(36,48,74,0.25)', dim: 0.35,
};
const CONTRAST: typeof NORMAL = {
  ...NORMAL, bg: '#FFFFFF', ink: '#000000', soft: '#222222', line: '#000000', shadow: 'rgba(0,0,0,0.6)', dim: 0.2,
  orange: '#C25E00', blue: '#0040C0', green: '#00702A', red: '#B00020', purple: '#5B21B6', teal: '#00706C',
};
export type Palette = typeof NORMAL;

export function useSettings(): Settings {
  return useProfile()?.settings ?? DEFAULT_SETTINGS;
}
export function usePalette(): Palette {
  return useSettings().highContrast ? CONTRAST : NORMAL;
}

/** Sizes scale with the short side of the screen (phone ≈ 1, tablet up to 1.8) and the text-size setting. */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  const short = Math.min(width, height);
  const k = Math.max(0.82, Math.min(1.8, short / 400));
  const textScale = useSettings().textScale;
  return { w: width, h: height, short, tablet: short >= 600, landscape: width > height * 1.15, s: (n: number) => Math.round(n * k), t: (n: number) => Math.round(n * k * textScale) };
}
