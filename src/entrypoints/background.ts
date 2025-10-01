export default defineBackground(() => {
  console.log('Hello background!', { id: browser.runtime.id });

  // Set side panel to open on action click
  browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

});

