import { getPdfViewerUrl, isPdfUrl } from '@/lib/pdf-utils';
import { BackgroundState, Schema } from '@/lib/definitions';
import type {
  ExtensionMessage,
  RenderHighlightsMessage,
  PdfTextExtractedMessage,
} from '@/lib/messaging/message_definitions';
import { sendTabMessage } from '@/lib/messaging/send';

// ─── Offscreen document lifecycle ───

async function ensureOffscreenDocument() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType],
  });
  if (contexts.length > 0) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen/index.html',
    reasons: ['WORKERS' as chrome.offscreen.Reason],
    justification: 'Run ML models for PDF analysis',
  });
}

export default defineBackground(() => {
  // Disable automatic sidepanel opening so we can handle clicks manually
  browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
  const backgroundState: BackgroundState = {
    activeSchema: null,
  };

  // Track the PDF viewer tab so we can push highlights to it
  let pdfViewerTabId: number | null = null;
  let pdfViewerUrl = '';

  /**
   * Extract all instances with coords from the active schema,
   * filtered to the current PDF, and send them to the viewer tab.
   */
  function pushHighlightsToViewer() {
    if (!pdfViewerTabId || !backgroundState.activeSchema) return;

    const instances: RenderHighlightsMessage['instances'] = [];
    for (const cls of backgroundState.activeSchema.classes) {
      for (const inst of cls.instances) {
        if (inst.coords && inst.pdfUrl === pdfViewerUrl) {
          instances.push({ id: inst.id, classId: cls.id, coords: inst.coords });
        }
      }
    }

    chrome.tabs.sendMessage(pdfViewerTabId, {
      type: 'renderHighlights',
      instances,
    } satisfies RenderHighlightsMessage).catch(() => {});
  }

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
      console.log('[background] Opening sidepanel');
      await browser.sidePanel.open({ tabId: tab.id });
      // Redirect to PDF viewer in the same tab
      const viewerUrl = getPdfViewerUrl(tab.url!);
      console.log('[background] Redirecting to:', viewerUrl);
      await browser.tabs.update(tab.id, { url: viewerUrl });
    }
  });

  // Handle messages from the PDF viewer, sidepanel, and offscreen document
  browser.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
    switch (message.type) {
      case 'pdfViewerReady':
        console.log('[background] PDF viewer ready:', message.pdfUrl);
        pdfViewerTabId = sender.tab?.id ?? null;
        pdfViewerUrl = message.pdfUrl || '';
        pushHighlightsToViewer();
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
        pushHighlightsToViewer();
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
          return true; // async response
        }
        sendResponse({ error: 'No PDF viewer tab active' });
        return true;

      // ─── ML tasks: forward to offscreen document ───
      case 'runWebLlmTask':
      case 'runTransformersTask':
      case 'getModelStatus':
        forwardToOffscreen(message);
        break;

      // ─── ML results: these flow back from offscreen, relay to listeners ───
      case 'mlTaskResult':
      case 'mlTaskError':
      case 'mlProgress':
      case 'modelStatusReport':
        // These are broadcast via runtime.sendMessage and picked up by
        // whoever is listening (sidepanel, etc.) — no routing needed.
        break;
    }
  });
});
