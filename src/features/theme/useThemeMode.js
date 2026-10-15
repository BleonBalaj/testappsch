import { useSyncExternalStore } from 'react';
import { getThemeMode, subscribeTheme } from './themeStore';

export function useThemeMode() {
  return useSyncExternalStore(subscribeTheme, getThemeMode, () => 'dark');
}
