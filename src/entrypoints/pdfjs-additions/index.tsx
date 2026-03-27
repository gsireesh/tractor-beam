import { initPopover } from './popover';
import { initHighlights } from './highlights';
import { initTextExtraction } from './text-extraction';
import { initDrawer } from './drawer';

initPopover();
initHighlights();
initTextExtraction();
initDrawer();

export default defineUnlistedScript(() => {
  // Required by WXT for unlisted scripts
});
