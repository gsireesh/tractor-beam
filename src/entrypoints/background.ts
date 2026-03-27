import { getPdfViewerUrl, isPdfUrl } from '@/lib/pdf-utils';
import { BackgroundState, VisualBlock, PdfBox } from '@/lib/definitions';
import type {
  ExtensionMessage,
  PdfTextExtractedMessage,
  VisualBlocksResponseMessage,
} from '@/lib/messaging/message_definitions';
import { sendTabMessage } from '@/lib/messaging/send';

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
  const backgroundState: BackgroundState = {
    activeSchema: null,
  };

  // Track the PDF viewer tab (needed for ML pipeline visual block extraction)
  let pdfViewerTabId: number | null = null;

  /**
   * Forward a message to the offscreen document for ML processing.
   * Ensures the offscreen document exists first.
   */
  async function forwardToOffscreen(message: ExtensionMessage) {
    await ensureOffscreenDocument();
    chrome.runtime.sendMessage(message).catch((err) => {
      console.error('[background] Failed to forward to offscreen:', err);
    });
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
      // Redirect to PDF viewer (drawer opens automatically in-page)
      const viewerUrl = getPdfViewerUrl(tab.url!);
      console.log('[background] Redirecting to:', viewerUrl);
      await browser.tabs.update(tab.id, { url: viewerUrl });

      // kick off offscreen document for ML annotation
      console.log('[background] Initializing offscreen document...');
      await ensureOffscreenDocument();
      console.log('[background] Offscreen document initialized.');
    }
  });

  // Handle messages from the PDF viewer, drawer, and offscreen document
  browser.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
    switch (message.type) {
      case 'pdfViewerReady':
        console.log('[background] PDF viewer ready:', message.pdfUrl);
        pdfViewerTabId = sender.tab?.id ?? null;
        break;

      case 'pdfPageChanged':
        console.log('[background] PDF page changed:', message.pageNumber);
        break;

      case 'pdfTextSelected':
        console.log('[background] PDF text selected:', message.text);
        break;

      case 'getPdfViewerConfig':
        sendResponse({});
        return true;

      case 'setActiveSchema':
        backgroundState.activeSchema = message.schema;
        break;

      case 'getActiveSchema':
        console.log(`Get ActiveSchema request! ActiveSchema: ${backgroundState.activeSchema?.name}`);
        sendResponse({
          ...backgroundState.activeSchema
        });
        return true;

      // ─── PDF text extraction: relay to viewer tab ───
      case 'extractPdfText':
        if (pdfViewerTabId) {
          sendTabMessage<PdfTextExtractedMessage>(pdfViewerTabId, { type: 'extractPdfText' })
            .then((result) => sendResponse(result))
            .catch((err) => sendResponse({ error: err.message }));
          return true;
        }
        sendResponse({ error: 'No PDF viewer tab active' });
        return true;

      // ─── Visual blocks: relay request to PDF viewer tab ───
      case 'requestVisualBlocks':
        if (pdfViewerTabId) {
          sendTabMessage<VisualBlocksResponseMessage>(pdfViewerTabId, {
            type: 'requestVisualBlocks',
            requestId: message.requestId,
          })
            .then((result) => sendResponse(result))
            .catch((err) => sendResponse({ error: err.message }));
          return true;
        }
        sendResponse({ error: 'No PDF viewer tab active' });
        return true;

      // ─── Annotation pipeline: fetch blocks, then forward to offscreen ───
      case 'runAnnotationPipeline':
        if (pdfViewerTabId) {
          sendTabMessage<VisualBlocksResponseMessage>(pdfViewerTabId, {
            type: 'requestVisualBlocks',
            requestId: message.requestId,
          })
            .then((blocksResponse) => {
              const blocks = blocksResponse.blocks ?? [];
              console.log(`[background] Got ${blocks.length} visual blocks, forwarding to offscreen`);

              forwardToOffscreen({
                ...message,
                blocks,
              } as ExtensionMessage);
            })
            .catch((err) => {
              console.error('[background] Failed to get visual blocks:', err);
              chrome.runtime.sendMessage({
                type: 'mlTaskError',
                requestId: message.requestId,
                error: `Failed to get visual blocks: ${err.message}`,
              }).catch(() => {});
            });
        } else {
          chrome.runtime.sendMessage({
            type: 'mlTaskError',
            requestId: message.requestId,
            error: 'No PDF viewer tab active',
          }).catch(() => {});
        }
        break;

      // ─── ML tasks: forward to offscreen document ───
      case 'cancelAnnotationPipeline':
        forwardToOffscreen(message);
        break;

      case 'runWebLlmTask':
      case 'runTransformersTask':
      case 'getModelStatus':
        forwardToOffscreen(message);
        break;

      // ─── ML results: broadcast from offscreen, picked up by drawer ───
      case 'mlTaskResult':
      case 'mlTaskError':
      case 'mlProgress':
      case 'modelStatusReport':
      case 'annotationResults':
        // These are broadcast via runtime.sendMessage and picked up by
        // the in-page drawer — no routing needed.
        break;
    }
  });
});
