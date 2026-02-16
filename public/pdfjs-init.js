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
   * Show the selection popover using the React component
   */
  function showSelectionPopover(text, rect) {
    if (window.TractorBeamPopover) {
      window.TractorBeamPopover.show(text, rect);
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

        // Show the popover anchored to the selection
        showSelectionPopover(selectedText, rect);

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

    // Listen for configuration requests from the extension
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
    });
  });
})();