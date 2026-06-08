/**
 * Drives the `.dark` class on each surface root from the stored theme preference.
 *
 * The token VALUES live in theme.css on `.tractor-beam-themed.dark`; this module
 * only decides *whether* that class is present. It is the single runtime owner of
 * that decision — UI controls (ThemeToggle) merely write the preference to
 * config-storage and let syncTheme react, so write and apply stay decoupled.
 */
import { type ThemePreference, getThemePreference, onUiStateChange } from './config-storage';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Resolve a preference to an effective light/dark boolean. */
export function resolveDark(pref: ThemePreference): boolean {
  if (pref === 'system') {
    return typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(DARK_QUERY).matches
      : false;
  }
  return pref === 'dark';
}

/**
 * Keep `root`'s `.dark` class in sync with the stored theme preference. Reacts to
 * OS appearance changes (relevant while the preference is `system`) and to the
 * preference being changed on any extension page. Returns a cleanup fn that
 * detaches both listeners.
 */
export function syncTheme(root: HTMLElement): () => void {
  let pref: ThemePreference = 'system';
  const apply = () => root.classList.toggle('dark', resolveDark(pref));

  // Initial paint: default to the OS setting until the stored value loads.
  apply();
  getThemePreference().then((p) => {
    pref = p;
    apply();
  });

  const mq =
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(DARK_QUERY) : null;
  const onSystemChange = () => apply();
  mq?.addEventListener('change', onSystemChange);

  const unsubscribe = onUiStateChange((state) => {
    pref = state.themePreference;
    apply();
  });

  return () => {
    mq?.removeEventListener('change', onSystemChange);
    unsubscribe();
  };
}
