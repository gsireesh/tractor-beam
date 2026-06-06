import type { GlobalProvider } from '@ladle/react';
import '../src/ladle-globals.css';

export const Provider: GlobalProvider = ({ children }) => {
  return <div className="p-6">{children}</div>;
};
