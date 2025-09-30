import {defineBackground} from "wxt/utils/define-background";

export default defineBackground(() => {
  console.log('Hello background!', { id: browser.runtime.id });

  browser.runtime.onStartup.addListener( () => {
    console.log(`onStartup()`);
  });

  // Open side panel when extension icon is clicked
  browser.action.onClicked.addListener((tab) => {
    browser.sidePanel.open({ windowId: tab.windowId });
  });
});

