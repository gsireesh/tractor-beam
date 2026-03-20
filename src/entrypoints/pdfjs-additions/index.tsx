import { initPopover } from './popover';
import { initHighlights } from './highlights';
import { initTextExtraction } from './text-extraction';

initPopover();
initHighlights();
initTextExtraction();

export default defineUnlistedScript(() => {
  // Required by WXT for unlisted scripts
});
