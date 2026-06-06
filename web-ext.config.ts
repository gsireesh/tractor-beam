import { defineWebExtConfig } from 'wxt';

export default defineWebExtConfig({
  chromiumArgs: [
    '--user-data-dir=/Users/sireeshgururaja/.wxt/tractor-beam',
    '--remote-debugging-port=9229',
  ],
});
