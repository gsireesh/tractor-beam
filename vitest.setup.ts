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