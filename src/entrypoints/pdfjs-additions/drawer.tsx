/**
 * In-page drawer entrypoint — mounts the DrawerContainer React root into the PDF
 * viewer page and installs the window.TractorBeamDrawer API.
 *
 * The components live in @/components/sidebar/DrawerContainer; the imperative
 * window-API bridge (refs + annotation pipeline orchestration) lives in
 * ./drawer-host. This file is just the wiring that connects them to the page.
 */

import { createRoot, Root } from 'react-dom/client';
import { syncTheme } from '@/lib/theme';
import { DrawerContainer } from '@/components/sidebar/DrawerContainer.tsx';
import cssText from './drawer-styles.css?inline';
import { installDrawerApi } from './drawer-host';

let root: Root | null = null;

function init() {
  const style = document.createElement('style');
  style.textContent = cssText;
  document.head.appendChild(style);

  const container = document.createElement('div');
  container.id = 'tractor-beam-drawer-root';
  container.className = 'tractor-beam-themed';
  document.body.appendChild(container);
  syncTheme(container);

  root = createRoot(container);
  root.render(<DrawerContainer />);

  installDrawerApi();

  console.log('[pdfjs-additions] Drawer initialized');
}

export function initDrawer() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
