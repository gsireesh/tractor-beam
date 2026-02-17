import { createRoot, Root } from 'react-dom/client';
import { SelectionPopover } from '@/components/SelectionPopover';
import cssText from './popover-styles.css?inline';

// This script is loaded in the PDF viewer to render the selection popover

let root: Root | null = null;
let container: HTMLDivElement | null = null;

interface PopoverState {
  visible: boolean;
  text: string;
  position: { top: number; left: number; bottom: number };
}

let state: PopoverState = {
  visible: false,
  text: '',
  position: { top: 0, left: 0, bottom: 0 },
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
      onClose={hidePopover}
      onAddInstance={(text, schemaId,  classId) => {
        chrome.runtime.sendMessage({
          type: 'addInstance',
          text,
          schemaId,
          classId,
          pdfUrl: new URLSearchParams(window.location.search).get('file') || '',
        }).catch(() => {});
        hidePopover();
      }}
    />
  );
}

function showPopover(text: string, rect: DOMRect) {
  state = {
    visible: true,
    text,
    position: {
      top: rect.top,
      left: rect.left,
      bottom: rect.bottom,
    },
  };
  render();
}

function hidePopover() {
  state = { ...state, visible: false };
  render();
}

function init() {
  // Inject Tailwind styles
  const style = document.createElement('style');
  style.textContent = cssText;
  document.head.appendChild(style);

  // Create container
  container = document.createElement('div');
  container.id = 'tractor-beam-popover-root';
  document.body.appendChild(container);

  // Create React root
  root = createRoot(container);

  // Expose functions globally for pdfjs-init.js to call
  (window as any).TractorBeamPopover = {
    show: showPopover,
    hide: hidePopover,
  };

  console.log('[viewer-popover] Initialized');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export default defineUnlistedScript(() => {
  // Required by WXT for unlisted scripts
});