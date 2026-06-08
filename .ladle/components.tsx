import { type GlobalProvider, ThemeState } from '@ladle/react';
import '../src/ladle-globals.css';

// Ladle's toolbar exposes a light/dark/auto theme control via globalState.theme.
// We translate "dark" into the `.dark` class our token system keys off of, and
// paint the wrapper with token-driven bg/text so the sandbox surface itself
// reflects the active theme (not just the components inside it).
export const Provider: GlobalProvider = ({ children, globalState }) => {
  const dark = globalState.theme === ThemeState.Dark;
  return (
    <div className={`tractor-beam-themed p-6 bg-background text-foreground ${dark ? 'dark' : ''}`}>
      {children}
    </div>
  );
};
