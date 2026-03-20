/**
 * Selection popover — moved from viewer-popover.tsx.
 * Exposes window.TractorBeamPopover API.
 */

import { createRoot, Root } from 'react-dom/client';
import { SelectionPopover } from '@/components/SelectionPopover';
import { PdfBox } from '@/lib/definitions';
import cssText from './popover-styles.css?inline';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

interface PopoverState {
  visible: boolean;
  text: string;
  position: { top: number; left: number; bottom: number };
  coords: PdfBox[] | null;
}

let state: PopoverState = {
  visible: false,
  text: '',
  position: { top: 0, left: 0, bottom: 0 },
  coords: null,
};

function render() {
  if (!root || !container) return;

  if (!state.visible) {
    root.render(null);
    return;
  }

  root.render(
    <SelectionPopover
      text={state.text}
      position={state.position}
      coords={state.coords}
      onClose={hidePopover}
      onAddInstance={(text, schemaId, classId, coords) => {
        chrome.runtime.sendMessage({
          type: 'addInstance',
          text,
          schemaId,
          classId,
          coords,
          pdfUrl: new URLSearchParams(window.location.search).get('file') || '',
        }).catch(() => {});
        hidePopover();
      }}
    />
  );
}

function showPopover(text: string, rect: DOMRect, coords?: PdfBox[]) {
  state = {
    visible: true,
    text,
    position: {
      top: rect.top,
      left: rect.left,
      bottom: rect.bottom,
    },
    coords: coords && coords.length > 0 ? coords : null,
  };
  render();
}

function hidePopover() {
  state = { ...state, visible: false };
  render();
}

function init() {
  const style = document.createElement('style');
  style.textContent = cssText;
  document.head.appendChild(style);

  container = document.createElement('div');
  container.id = 'tractor-beam-popover-root';
  document.body.appendChild(container);

  root = createRoot(container);

  (window as any).TractorBeamPopover = {
    show: showPopover,
    hide: hidePopover,
  };

  console.log('[pdfjs-additions] Popover initialized');
}

export function initPopover() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
