import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton.tsx';
import {
  type ThemePreference,
  getThemePreference,
  onUiStateChange,
  setThemePreference,
} from '@/lib/config-storage.ts';

/**
 * Cycles the color-theme preference system → light → dark. It only *writes* the
 * preference; applying the `.dark` class to surface roots is syncTheme's job (it
 * reacts to the same storage write), so this control works identically wherever
 * it's mounted. Stays in sync if the preference is changed on another page.
 */
const NEXT: Record<ThemePreference, ThemePreference> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};

const ICON: Record<ThemePreference, typeof Monitor> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

const LABEL: Record<ThemePreference, string> = {
  system: 'Theme: follow system',
  light: 'Theme: light',
  dark: 'Theme: dark',
};

export function ThemeToggle({
  size = 'icon-sm',
}: {
  size?: 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg';
}) {
  const [pref, setPref] = useState<ThemePreference>('system');

  useEffect(() => {
    getThemePreference().then(setPref);
    return onUiStateChange((state) => setPref(state.themePreference));
  }, []);

  return (
    <IconButton
      title={`${LABEL[pref]} (click to change)`}
      icon={ICON[pref]}
      size={size}
      onClick={() => {
        const next = NEXT[pref];
        setPref(next); // optimistic; onUiStateChange reconciles
        setThemePreference(next);
      }}
    />
  );
}
