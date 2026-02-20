/**
 * PDF.js Viewer Initialization Script
 *
 * This is the single injection point into the PDF viewer.
 * It handles all extension integration and dynamically loads the React popover.
 */

(function() {
  'use strict';

  /**
   * Dynamically load the viewer-popover.js React component
   */
  function loadViewerPopover() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = '/viewer-popover.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Extract the PDF URL from the viewer URL query string
   */
  function getPdfUrlFromViewer() {
    const params = new URLSearchParams(window.location.search);
    return params.get('file') || '';
  }

  /**
   * Convert a selection Range into scale-independent PdfBox[] coords.
   * Each client rect becomes one PdfBox with page-relative coordinates.
   */
  function selectionToPdfBoxes(range) {
    const rects = range.getClientRects();
    const boxes = [];

    for (const rect of rects) {
      // Find the .page element containing this rect's midpoint
      const el = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      const pageEl = el?.closest('.page[data-page-number]');
      if (!pageEl) continue;

      const pageNumber = parseInt(pageEl.getAttribute('data-page-number'), 10);
      const pageRect = pageEl.getBoundingClientRect();
      // Subtract border (clientLeft/clientTop) so coords are relative to the padding box,
      // which is where absolutely-positioned children are placed.
      const borderLeft = pageEl.clientLeft || 0;
      const borderTop = pageEl.clientTop || 0;

      // Store as fractions (0–1) of the page content area so coordinates
      // are scale-independent — no rounding drift on zoom.
      const contentWidth = pageEl.clientWidth;
      const contentHeight = pageEl.clientHeight;

      boxes.push({
        pageNumber,
        left:   (rect.left - pageRect.left - borderLeft) / contentWidth,
        top:    (rect.top  - pageRect.top  - borderTop)  / contentHeight,
        width:  rect.width  / contentWidth,
        height: rect.height / contentHeight,
      });
    }
    return boxes;
  }

  /**
   * Show the selection popover using the React component
   */
  function showSelectionPopover(text, rect, coords) {
    if (window.TractorBeamPopover) {
      window.TractorBeamPopover.show(text, rect, coords);
    } else {
      console.warn('[pdfjs-init] TractorBeamPopover not loaded');
    }
  }

  /**
   * Hide the selection popover
   */
  function hideSelectionPopover() {
    if (window.TractorBeamPopover) {
      window.TractorBeamPopover.hide();
    }
  }

  // --- Highlight rendering ---

  // Stored highlights: array of { id, classId, coords: PdfBox[] }
  window._tractorBeamHighlights = [];


  function hashId(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

  const colorArray = [
  'rgba(255, 182, 193, 0.3)', // pink
  'rgba(255, 218, 185, 0.3)', // peach
  'rgba(255, 255, 186, 0.3)', // yellow
  'rgba(186, 255, 201, 0.3)', // mint
  'rgba(186, 225, 255, 0.3)', // sky blue
  'rgba(216, 191, 255, 0.3)', // lavender
  'rgba(255, 200, 221, 0.3)', // rose
  'rgba(200, 255, 240, 0.3)', // aqua
  'rgba(255, 228, 196, 0.3)', // bisque
  'rgba(230, 230, 250, 0.3)', // periwinkle
];
  function getHighlightColor(classId) {
    const idx = hashId(classId) % colorArray.length;
    return colorArray[idx];
  }

  /**
   * Render highlight overlays for a given page number at the current scale.
   */
  function renderHighlightsOnPage(pageNumber) {
    const pageEl = document.querySelector(`.page[data-page-number="${pageNumber}"]`);
    if (!pageEl) return;

    // Find or create the highlight container
    let container = pageEl.querySelector('.tractor-beam-highlights');
    if (!container) {
      container = document.createElement('div');
      container.className = 'tractor-beam-highlights';
      container.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;';
      pageEl.style.position = 'relative';
      pageEl.appendChild(container);
    }

    // Clear existing highlights on this page
    container.innerHTML = '';

    const highlights = window._tractorBeamHighlights || [];
    for (const hl of highlights) {
      if (!hl.coords) continue;
      const color = getHighlightColor(hl.classId);
      for (const box of hl.coords) {
        if (box.pageNumber !== pageNumber) continue;
        const div = document.createElement('div');
        div.style.cssText = `position:absolute;left:${box.left * 100}%;top:${box.top * 100}%;width:${box.width * 100}%;height:${box.height * 100}%;background:${color};border-radius:2px;mix-blend-mode:multiply;`;
        container.appendChild(div);
      }
    }
  }

  /**
   * Re-render all highlights across all visible pages.
   */
  function renderAllHighlights() {
    const pages = document.querySelectorAll('.page[data-page-number]');
    for (const pageEl of pages) {
      const pageNumber = parseInt(pageEl.getAttribute('data-page-number'), 10);
      renderHighlightsOnPage(pageNumber);
    }
  }

  // Load the React popover component
  loadViewerPopover()
    .then(() => console.log('[pdfjs-init] viewer-popover.js loaded'))
    .catch((err) => console.error('[pdfjs-init] Failed to load viewer-popover.js:', err));

  // Wait for the PDF viewer to be loaded
  document.addEventListener('webviewerloaded', async function() {
    const PDFViewerApplication = window.PDFViewerApplication;

    if (!PDFViewerApplication) {
      console.error('[pdfjs-init] PDFViewerApplication not found');
      return;
    }

    // Wait for the viewer to fully initialize
    await PDFViewerApplication.initializedPromise;

    console.log('[pdfjs-init] PDF viewer initialized');

    // Notify the extension that the viewer is ready
    try {
      await chrome.runtime.sendMessage({
        type: 'pdfViewerReady',
        url: window.location.href,
        pdfUrl: getPdfUrlFromViewer()
      });
    } catch (err) {
      console.log('[pdfjs-init] Could not send pdfViewerReady message:', err.message);
    }

    // Re-render highlights when a page finishes rendering
    PDFViewerApplication.eventBus.on('pagerendered', function(evt) {
      renderHighlightsOnPage(evt.pageNumber);
    });

    // Clear stale highlight containers on scale change (they get recreated on pagerendered)
    PDFViewerApplication.eventBus.on('scalechanging', function() {
      const containers = document.querySelectorAll('.tractor-beam-highlights');
      for (const c of containers) c.innerHTML = '';
    });

    // Listen for page changes
    PDFViewerApplication.eventBus.on('pagechanging', function(evt) {
      chrome.runtime.sendMessage({
        type: 'pdfPageChanged',
        pageNumber: evt.pageNumber,
        pdfUrl: getPdfUrlFromViewer()
      }).catch(() => {});

      // Hide popover on page change
      hideSelectionPopover();
    });

    // Listen for text selection
    document.addEventListener('mouseup', function(e) {
      // Don't process if clicking inside the popover
      const popoverRoot = document.getElementById('tractor-beam-popover-root');
      if (popoverRoot && popoverRoot.contains(e.target)) {
        return;
      }

      const selection = window.getSelection();
      const selectedText = selection ? selection.toString().trim() : '';

      if (selectedText && selectedText.length > 0 && selection.rangeCount > 0) {
        // Get the bounding rect of the selection
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const coords = selectionToPdfBoxes(range);

        // Show the popover anchored to the selection
        showSelectionPopover(selectedText, rect, coords);

        // Also notify the extension
        chrome.runtime.sendMessage({
          type: 'pdfTextSelected',
          text: selectedText,
          pdfUrl: getPdfUrlFromViewer()
        }).catch(() => {});
      } else {
        // Hide popover if no text selected
        hideSelectionPopover();
      }
    });

    // Hide popover on scroll
    const viewerContainer = document.getElementById('viewerContainer');
    if (viewerContainer) {
      viewerContainer.addEventListener('scroll', hideSelectionPopover);
    }

    // Listen for messages from the extension
    chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
      if (message.type === 'getPdfInfo') {
        sendResponse({
          url: getPdfUrlFromViewer(),
          pageNumber: PDFViewerApplication.page,
          numPages: PDFViewerApplication.pagesCount,
          title: PDFViewerApplication.documentInfo?.Title || ''
        });
        return true;
      }

      if (message.type === 'renderHighlights') {
        window._tractorBeamHighlights = message.instances || [];
        renderAllHighlights();
      }
    });
  });
})();