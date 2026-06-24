import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu.tsx';
import {
  type ThemePreference,
  getThemePreference,
  onUiStateChange,
  setThemePreference,
} from '@/lib/config-storage.ts';

/**
 * A schema-actions menu row that cycles the color-theme preference
 * system → light → dark. It only *writes* the preference; applying the `.dark`
 * class to surface roots is syncTheme's job (it reacts to the same storage
 * write). Stays in sync if the preference is changed on another page.
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
  system: 'System Theme',
  light: 'Light Mode',
  dark: 'Dark Mode',
};

export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePreference>('system');

  useEffect(() => {
    void getThemePreference().then(setPref);
    return onUiStateChange((state) => setPref(state.themePreference));
  }, []);

  const Icon = ICON[pref];

  return (
    <DropdownMenuItem
      onSelect={(event) => {
        const nextTheme = NEXT[pref];
        setPref(nextTheme);
        void setThemePreference(nextTheme);
        event.preventDefault();
      }}
    >
      <Icon strokeWidth={1} size="1em" />
      {LABEL[pref]}
    </DropdownMenuItem>
  );
}
