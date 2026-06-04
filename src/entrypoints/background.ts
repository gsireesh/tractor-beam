import { getPdfViewerUrl, isPdfUrl } from '@/lib/pdf-utils';
import type { ExtensionMessage } from '@/lib/messaging/message_definitions';

// ─── Offscreen document lifecycle ───

async function ensureOffscreenDocument() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType],
  });
  if (contexts.length > 0) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['WORKERS' as chrome.offscreen.Reason],
    justification: 'Run ML models for PDF analysis',
  });
}

export default defineBackground(() => {
  // Handle extension action (toolbar button) click
  browser.action.onClicked.addListener(async (tab) => {
    console.log('[background] Action clicked, tab:', tab.url);

    if (!tab.id) {
      console.log('[background] No tab id');
      return;
    }

    const isPdf = isPdfUrl(tab.url);
    console.log('[background] isPdfUrl result:', isPdf);

    if (isPdf) {
      const viewerUrl = getPdfViewerUrl(tab.url!);
      console.log('[background] Redirecting to:', viewerUrl);
      await browser.tabs.update(tab.id, { url: viewerUrl });

      // Pre-warm the offscreen document so the model can start loading
      console.log('[background] Initializing offscreen document...');
      await ensureOffscreenDocument();
      console.log('[background] Offscreen document initialized.');
    }
  });

  // Handle messages — the background is now a thin lifecycle manager.
  // The drawer orchestrates the annotation pipeline directly.
  browser.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    switch (message.type) {
      case 'ensureOffscreen':
        ensureOffscreenDocument()
          .then(() => sendResponse(true))
          .catch((err) => sendResponse({ error: (err as Error).message }));
        return true; // async response

      case 'openSchemaManager':
        browser.tabs.create({
          url: browser.runtime.getURL(
            `/schema-manager.html?schemaId=${encodeURIComponent(message.schemaId)}`,
          ),
        });
        break;

      case 'pdfViewerReady':
        console.log('[background] PDF viewer ready:', message.pdfUrl);
        break;

      case 'getPdfViewerConfig':
        sendResponse({});
        return true;

      // ─── Messages broadcast by offscreen, picked up by the drawer ───
      // The background doesn't need to act on these — they pass through
      // to all extension contexts via runtime.sendMessage broadcast.
      case 'runAnnotationPipeline':
      case 'cancelAnnotationPipeline':
      case 'mlTaskResult':
      case 'mlTaskError':
      case 'mlProgress':
      case 'modelStatusReport':
      case 'annotationResults':
        break;
    }
  });
});
