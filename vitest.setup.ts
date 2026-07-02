// Runs before each test file (in that file's environment).
// 1. Adds jest-dom matchers: toBeInTheDocument(), toHaveValue(), toBeDisabled(), …
import '@testing-library/jest-dom/vitest';
// 2. Unmount React trees after every test so component tests don't leak DOM into
//    one another. (No-op for node-env logic tests, which mount nothing.)
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// 3. Radix UI (dropdowns, selects, …) calls Pointer Capture APIs and
//    scrollIntoView, which jsdom doesn't implement — without these stubs,
//    opening a menu in a component test throws. Guarded by `typeof Element` so the
//    default node-env logic tests (which have no DOM) skip this entirely.
if (typeof Element !== 'undefined') {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
}