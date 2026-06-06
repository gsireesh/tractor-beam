/**
 * Request/response messaging helper with requestId-based pairing.
 *
 * Sends a message and waits for a response message whose requestId matches.
 * Works across extension contexts (background ↔ offscreen, background ↔ tab).
 */

let nextId = 0;

export function generateRequestId(): string {
  return `req_${Date.now()}_${nextId++}`;
}

/**
 * Send a message to the runtime and wait for a matched response.
 * The response is identified by a matching `requestId` field.
 *
 * @param message - Message to send (must include requestId)
 * @param timeoutMs - Timeout in ms (default 120s for model loading)
 * @returns The response message (without the type/requestId envelope)
 */
export function sendMessageWithResponse<T>(
  message: { type: string; requestId: string; [key: string]: unknown },
  timeoutMs = 120_000,
): Promise<T> {
  const { requestId } = message;

  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(listener);
      reject(new Error(`Message response timeout for requestId: ${requestId}`));
    }, timeoutMs);

    function listener(response: { requestId?: string; type?: string; [key: string]: unknown }) {
      if (response.requestId !== requestId) return;

      chrome.runtime.onMessage.removeListener(listener);
      clearTimeout(timeout);

      if (response.type === 'mlTaskError') {
        reject(new Error((response as { error: string }).error));
      } else {
        resolve(response as T);
      }
    }

    chrome.runtime.onMessage.addListener(listener);
    chrome.runtime.sendMessage(message).catch((err) => {
      chrome.runtime.onMessage.removeListener(listener);
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * Send a message to a specific tab and get the direct response via sendResponse.
 */
export function sendTabMessage<T>(
  tabId: number,
  message: { type: string; [key: string]: unknown },
): Promise<T> {
  return chrome.tabs.sendMessage(tabId, message);
}
