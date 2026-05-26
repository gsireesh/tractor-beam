/**
 * Popover mount point — switches among CreateInstancePopover / PromoteInstancePopover /
 * EditInstancePopover based on the calling mode. Exposes window.TractorBeamPopover API.
 */

import { createRoot, Root } from 'react-dom/client';
import { CreateInstancePopover } from '@/components/popovers/CreateInstancePopover';
import { PromoteInstancePopover } from '@/components/popovers/PromoteInstancePopover';
import { EditInstancePopover } from '@/components/popovers/EditInstancePopover';
import { Highlight, PdfBox } from '@/lib/definitions';
import cssText from './popover-styles.css?inline';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

type Position = { top: number; left: number; bottom: number };

type PopoverState =
  | null
  | { mode: 'create'; text: string; position: Position; coords: PdfBox[] | null }
  | { mode: 'promote'; highlight: Highlight; position: Position }
  | { mode: 'edit'; schemaId: string; classId: string; instanceId: string; position: Position };

let state: PopoverState = null;

function rectToPosition(rect: DOMRect): Position {
  return { top: rect.top, left: rect.left, bottom: rect.bottom };
}

function render() {
  if (!root || !container) return;
  if (!state) {
    root.render(null);
    return;
  }

  switch (state.mode) {
    case 'create': {
      const pdfUrl = new URLSearchParams(window.location.search).get('file') ?? '';
      root.render(
        <CreateInstancePopover
          text={state.text}
          pdfUrl={pdfUrl}
          position={state.position}
          coords={state.coords}
          onClose={hidePopover}
          onAddInstance={(schemaId, classId, instance) => {
            window.TractorBeamDrawer?.dispatch({
              actionType: 'addInstance',
              schemaId,
              classId,
              instance,
            });
            hidePopover();
          }}
          onAddClass={(schemaId, schemaClass) => {
            window.TractorBeamDrawer?.dispatch({
              actionType: 'addClass',
              schemaId,
              classInfo: schemaClass,
            });
            hidePopover();
          }}
        />,
      );
      return;
    }
    case 'promote': {
      root.render(
        <PromoteInstancePopover
          highlight={state.highlight}
          position={state.position}
          onClose={hidePopover}
        />,
      );
      return;
    }
    case 'edit': {
      root.render(
        <EditInstancePopover
          schemaId={state.schemaId}
          classId={state.classId}
          instanceId={state.instanceId}
          position={state.position}
          onClose={hidePopover}
        />,
      );
      return;
    }
  }
}

function showPopover(text: string, rect: DOMRect, coords?: PdfBox[]) {
  state = {
    mode: 'create',
    text,
    position: rectToPosition(rect),
    coords: coords && coords.length > 0 ? coords : null,
  };
  render();
}

function showPromotePopover(highlight: Highlight, rect: DOMRect) {
  state = {
    mode: 'promote',
    highlight,
    position: rectToPosition(rect),
  };
  render();
}

function showEditPopover(schemaId: string, classId: string, instanceId: string, rect: DOMRect) {
  state = {
    mode: 'edit',
    schemaId,
    classId,
    instanceId,
    position: rectToPosition(rect),
  };
  render();
}

function hidePopover() {
  state = null;
  render();
}

declare global {
  interface Window {
    TractorBeamPopover: {
      show: (text: string, rect: DOMRect, coords?: PdfBox[]) => void;
      showPromote: (highlight: Highlight, rect: DOMRect) => void;
      showEdit: (schemaId: string, classId: string, instanceId: string, rect: DOMRect) => void;
      hide: () => void;
    };
  }
}

function init() {
  const style = document.createElement('style');
  style.textContent = cssText;
  document.head.appendChild(style);

  container = document.createElement('div');
  container.id = 'tractor-beam-popover-root';
  document.body.appendChild(container);

  root = createRoot(container);

  window.TractorBeamPopover = {
    show: showPopover,
    showPromote: showPromotePopover,
    showEdit: showEditPopover,
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
