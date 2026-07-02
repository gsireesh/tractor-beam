import { initPopover } from './popover';
import { initHighlights } from './highlights';
import { initPdfApi } from './pdf-api';
import { initDrawer } from './drawer';

initPopover();
initHighlights();
initPdfApi();
initDrawer();

export default defineUnlistedScript(() => {
  // Required by WXT for unlisted scripts
});
