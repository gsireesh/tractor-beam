import React from 'react';
import { createRoot } from 'react-dom/client';
import './schema-manager.css';
import { SchemaManagerApp } from './SchemaManagerApp';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <SchemaManagerApp />
    </React.StrictMode>,
  );
}
