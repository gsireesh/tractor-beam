import React from 'react';
import { createRoot } from 'react-dom/client';
import './schema-manager.css';
import { SchemaManagerApp } from './SchemaManagerApp';
import { syncTheme } from '@/lib/theme';

const root = document.getElementById('root');
if (root) {
  syncTheme(root);
  createRoot(root).render(
    <React.StrictMode>
      <SchemaManagerApp />
    </React.StrictMode>,
  );
}
