/**
 * PDF.js Viewer Initialization Script
 *
 * Thin orchestrator that loads the bundled pdfjs-additions script
 * and wires pdf.js events to window.TractorBeam* APIs.
 */

(function () {
  'use strict';

  /**
   * Dynamically load the pdfjs-additions.js bundled module
   */
  function loadAdditions() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = '/pdfjs-additions.js';
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
   */
  function selectionToPdfBoxes(range) {
    const rects = range.getClientRects();
    const boxes = [];

    for (const rect of rects) {
      const el = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      const pageEl = el?.closest('.page[data-page-number]');
      if (!pageEl) continue;

      const pageNumber = parseInt(pageEl.getAttribute('data-page-number'), 10);
      const pageRect = pageEl.getBoundingClientRect();
      const borderLeft = pageEl.clientLeft || 0;
      const borderTop = pageEl.clientTop || 0;

      const contentWidth = pageEl.clientWidth;
      const contentHeight = pageEl.clientHeight;

      boxes.push({
        pageNumber,
        left: (rect.left - pageRect.left - borderLeft) / contentWidth,
        top: (rect.top - pageRect.top - borderTop) / contentHeight,
        width: rect.width / contentWidth,
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

  // Load the bundled additions module
  loadAdditions()
    .then(() => console.log('[pdfjs-init] pdfjs-additions.js loaded'))
    .catch((err) => console.error('[pdfjs-init] Failed to load pdfjs-additions.js:', err));

  // Wait for the PDF viewer to be loaded
  document.addEventListener('webviewerloaded', async function () {
    const PDFViewerApplication = window.PDFViewerApplication;

    if (!PDFViewerApplication) {
      console.error('[pdfjs-init] PDFViewerApplication not found');
      return;
    }

    await PDFViewerApplication.initializedPromise;

    console.log('[pdfjs-init] PDF viewer initialized');

    // Notify the extension that the viewer is ready
    try {
      await chrome.runtime.sendMessage({
        type: 'pdfViewerReady',
        url: window.location.href,
        pdfUrl: getPdfUrlFromViewer(),
      });
    } catch (err) {
      console.log('[pdfjs-init] Could not send pdfViewerReady message:', err.message);
    }

    // Re-render highlights when a page finishes rendering
    PDFViewerApplication.eventBus.on('pagerendered', function (evt) {
      if (window.TractorBeamHighlights) {
        window.TractorBeamHighlights.renderPage(evt.pageNumber);
      }
    });

    // Clear stale highlight containers on scale change
    PDFViewerApplication.eventBus.on('scalechanging', function () {
      if (window.TractorBeamHighlights) {
        window.TractorBeamHighlights.clearContainers();
      }
    });

    // Listen for page changes
    PDFViewerApplication.eventBus.on('pagechanging', function (evt) {
      chrome.runtime
        .sendMessage({
          type: 'pdfPageChanged',
          pageNumber: evt.pageNumber,
          pdfUrl: getPdfUrlFromViewer(),
        })
        .catch(() => {});

      hideSelectionPopover();
    });

    // Listen for text selection
    document.addEventListener('mouseup', function (e) {
      const popoverRoot = document.getElementById('tractor-beam-popover-root');
      if (popoverRoot && popoverRoot.contains(e.target)) {
        return;
      }
      const drawerRoot = document.getElementById('tractor-beam-drawer-root');
      if (drawerRoot && drawerRoot.contains(e.target)) {
        return;
      }

      const selection = window.getSelection();
      const selectedText = selection ? selection.toString().trim() : '';

      if (selectedText && selectedText.length > 0 && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const coords = selectionToPdfBoxes(range);

        showSelectionPopover(selectedText, rect, coords);
      } else {
        hideSelectionPopover();
      }
    });

    // Hide popover on scroll
    const viewerContainer = document.getElementById('viewerContainer');
    if (viewerContainer) {
      viewerContainer.addEventListener('scroll', hideSelectionPopover);
    }

    // Listen for messages from the extension
    chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
      if (message.type === 'getPdfInfo') {
        sendResponse({
          url: getPdfUrlFromViewer(),
          pageNumber: PDFViewerApplication.page,
          numPages: PDFViewerApplication.pagesCount,
          title: PDFViewerApplication.documentInfo?.Title || '',
        });
        return true;
      }

      if (message.type === 'extractPdfText') {
        if (window.TractorBeamPdf) {
          window.TractorBeamPdf.extractFullText(PDFViewerApplication)
            .then(function (pages) {
              sendResponse({ type: 'pdfTextExtracted', pages: pages });
            })
            .catch(function (err) {
              sendResponse({ type: 'pdfTextExtracted', pages: [], error: err.message });
            });
          return true;
        }
      }
    });
  });
})();
