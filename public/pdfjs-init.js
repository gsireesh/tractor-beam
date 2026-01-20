/**
 * PDF.js Viewer Initialization Script
 *
 * This script is injected into the pdf.js viewer to enable communication
 * with the browser extension.
 */

(function() {
  'use strict';

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
    });

    // Listen for text selection
    document.addEventListener('mouseup', function() {
      const selection = window.getSelection();
      const selectedText = selection ? selection.toString().trim() : '';

      if (selectedText) {
        chrome.runtime.sendMessage({
          type: 'pdfTextSelected',
          text: selectedText,
          pdfUrl: getPdfUrlFromViewer()
        }).catch(() => {});
      }
    });

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

  /**
   * Extract the PDF URL from the viewer URL query string
   */
  function getPdfUrlFromViewer() {
    const params = new URLSearchParams(window.location.search);
    return params.get('file') || '';
  }
})();
