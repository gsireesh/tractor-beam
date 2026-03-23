import { getPdfViewerUrl, isPdfUrl } from '@/lib/pdf-utils';
import { BackgroundState, Schema, VisualBlock, PdfBox } from '@/lib/definitions';
import type {
  ExtensionMessage,
  RenderHighlightsMessage,
  PdfTextExtractedMessage,
  VisualBlocksResponseMessage,
  AnnotationResultsMessage,
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
  // Disable automatic sidepanel opening so we can handle clicks manually
  browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
  const backgroundState: BackgroundState = {
    activeSchema: null,
  };

  // Track the PDF viewer tab so we can push highlights to it
  let pdfViewerTabId: number | null = null;
  let pdfViewerUrl = '';

  // Accumulate ML annotation highlights across streaming blocks
  let mlHighlights: RenderHighlightsMessage['instances'] = [];

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
      instances: [...instances, ...mlHighlights],
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

      // kick off offscreen document for ML annotation
      console.log('[background] Initializing offscreen document...');
      await ensureOffscreenDocument()
      console.log("[background] Offscreen document initialized.");
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
        mlHighlights = []; // reset for new run
        if (pdfViewerTabId) {
          sendTabMessage<VisualBlocksResponseMessage>(pdfViewerTabId, {
            type: 'requestVisualBlocks',
            requestId: message.requestId,
          })
            .then((blocksResponse) => {
              const blocks = blocksResponse.blocks ?? [];
              console.log(`[background] Got ${blocks.length} visual blocks, forwarding to offscreen`);

              // Render visual block outlines on the viewer
              const blockOutlines: RenderHighlightsMessage['instances'] = blocks.map((block: VisualBlock) => {
                const boxes = block.items.map(item => item.box);
                if (boxes.length === 0) return null;
                const bbox: PdfBox = {
                  pageNumber: block.pageNumber,
                  left: Math.min(...boxes.map(b => b.left)),
                  top: Math.min(...boxes.map(b => b.top)),
                  width: Math.max(...boxes.map(b => b.left + b.width)) - Math.min(...boxes.map(b => b.left)),
                  height: Math.max(...boxes.map(b => b.top + b.height)) - Math.min(...boxes.map(b => b.top)),
                };
                return { id: `vb-${block.blockId}`, classId: '__visual-block__', coords: [bbox] };
              }).filter((x): x is NonNullable<typeof x> => x !== null);

              // Store block outlines so they persist across re-renders
              mlHighlights = blockOutlines;
              pushHighlightsToViewer();

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

      // ─── Annotation results: accumulate and render highlights on viewer ───
      case 'annotationResults':
        console.log(`[background] Received annotationResults: ${(message as AnnotationResultsMessage).annotations?.length} annotations, pdfViewerTabId=${pdfViewerTabId}`);
        if (pdfViewerTabId) {
          const newInstances = (message as AnnotationResultsMessage).annotations.map(a => ({
            id: a.id,
            classId: a.classId,
            coords: a.coords,
          }));
          mlHighlights = [...mlHighlights, ...newInstances];
          // Re-render all highlights: manual + accumulated ML
          const manualInstances: RenderHighlightsMessage['instances'] = [];
          if (backgroundState.activeSchema) {
            for (const cls of backgroundState.activeSchema.classes) {
              for (const inst of cls.instances) {
                if (inst.coords && inst.pdfUrl === pdfViewerUrl) {
                  manualInstances.push({ id: inst.id, classId: cls.id, coords: inst.coords });
                }
              }
            }
          }
          const allInstances = [...manualInstances, ...mlHighlights];
          console.log(`[background] Sending ${allInstances.length} highlights to tab ${pdfViewerTabId}`);
          chrome.tabs.sendMessage(pdfViewerTabId, {
            type: 'renderHighlights',
            instances: allInstances,
          } satisfies RenderHighlightsMessage).catch((err) => {
            console.error('[background] Failed to send highlights to tab:', err);
          });
        }
        break;

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
