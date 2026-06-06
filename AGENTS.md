## Building and testing

This project uses `pnpm` for building and testing.

- Install deps: `pnpm install`
- Start chrome with a loaded copy of the extension: `pnpm run dev`

## Project Principles

- This project is primarily in React, even though there is some vanilla HTML/JS because of the
  vendored in pdf.js library. Where possible, prefer using React, and keep the contact between
  the vendored library and the react code to a minimum interface, ideally specified in
  `public/pdfjs-init.js`.
- We are using tailwind for CSS styling, so use tailwind class-based CSS rather than writing
  separate CSS wherever possible.
