/// <reference types="vite/client" />
// Gives files in .ladle/ (which live outside src/) the same Vite ambient
// types src/vite-env.d.ts provides — notably `declare module '*.css'`, so
// side-effect CSS imports here resolve under the IDE's language service.