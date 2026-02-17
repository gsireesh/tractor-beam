import { getPdfViewerUrl, isPdfUrl } from '@/lib/pdf-utils';
import {BackgroundState, Schema} from "@/lib/definitions.ts";

export default defineBackground(() => {
  // Disable automatic sidepanel opening so we can handle clicks manually
  browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
  const backgroundState: BackgroundState = {
    activeSchema: null,
  }

  // Handle extension action (toolbar button) click
  browser.action.onClicked.addListener(async (tab) => {
    console.log('[background] Action clicked, tab:', tab.url);

    if (!tab.id) {
      console.log('[background] No tab id');
      return;
    }

    // Check if the current tab is a PDF
    const isPdf = isPdfUrl(tab.url);
    console.log('[background] isPdfUrl result:', isPdf);

    if (isPdf) {
      console.log('[background] Opening sidepanel');
      await browser.sidePanel.open({ tabId: tab.id });
      // Redirect to PDF viewer in the same tab
      const viewerUrl = getPdfViewerUrl(tab.url!);
      console.log('[background] Redirecting to:', viewerUrl);
      await browser.tabs.update(tab.id, { url: viewerUrl });
    }
  });

  // Handle messages from the PDF viewer
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'pdfViewerReady':
        console.log('[background] PDF viewer ready:', message.pdfUrl);
        break;

      case 'pdfPageChanged':
        console.log('[background] PDF page changed:', message.pageNumber);
        break;

      case 'pdfTextSelected':
        console.log('[background] PDF text selected:', message.text);
        break;
      case 'getPdfViewerConfig':
        // Return configuration for the PDF viewer
        sendResponse({
          // Add any viewer configuration options here
        });
        return true; // Indicates async response
        break;
      case 'setActiveSchema':
        backgroundState.activeSchema = (message.schema as Schema);
        break;
      case 'getActiveSchema':
        console.log(`Get ActiveSchema request! ActiveSchema: ${backgroundState.activeSchema?.name}`);
        sendResponse({
          ...backgroundState.activeSchema
        });
        return true;
        break;
    }
  });
});
