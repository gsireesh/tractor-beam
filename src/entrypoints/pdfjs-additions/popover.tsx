/**
 * Popover mount point — switches among CreateInstancePopover / PromoteInstancePopover /
 * EditInstancePopover based on the calling mode. Exposes window.TractorBeamPopover API.
 */

import { createRoot, Root } from 'react-dom/client';
import { CreateInstancePopover } from '@/components/popovers/CreateInstancePopover';
import { PromoteInstancePopover } from '@/components/popovers/PromoteInstancePopover';
import { EditInstancePopover } from '@/components/popovers/EditInstancePopover';
import { Highlight, PdfBox } from '@/lib/definitions';
import { syncTheme } from '@/lib/theme';
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
  container.className = 'tractor-beam-themed';
  document.body.appendChild(container);
  syncTheme(container);

  // The popover mounts into a nested element, NOT `container` itself. `container`
  // (#tractor-beam-popover-root) is ALSO the portal target for menus/comboboxes
  // rendered by the *drawer's* separate React root. A React root assumes it owns
  // its container's entire child list, so if this root owned `container`, its
  // render()/render(null) on show/hide would reconcile — and remove — the drawer
  // root's portaled nodes, and vice versa: two roots removing each other's
  // children is the "removeChild: node is not a child of this node" crash. Owning
  // only `appEl` keeps this root's reconciliation off the shared child list; the
  // portals live as sibling children of `appEl` under the same themed container.
  const appEl = document.createElement('div');
  container.appendChild(appEl);
  root = createRoot(appEl);

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
