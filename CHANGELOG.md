# Changelog

All notable changes to this project are documented here.

## 0.4.0 - 2026-07-07

### Highlight filtering

- Renamed the "Navigate Highlights" panel to **Highlights** and turned it into a robust 
  filtering interface.
- A single shared filter predicate now drives the list, viewer, and minimap together, so 
  filtering applies to everywhere annotations are visualized/presented.
- Filter dimensions: class, page range, table-of-contents section, source, and text.
- Per-card section chips, click-to-filter page badges, standardized `(N)` counts, and a live count in the tab title.
- Per-schema pinned filters with opt-in persistence.

### Scoped AI highlighting

- "Highlight with AI" can now be scoped to a single page, a page range, or a table-of-contents section instead of the whole document.
- Table-of-contents component split out with per-section selection; scope collapses to a single page set internally.
- Reworked the split-button UI so the annotate action is primary.

### Schema history and run snapshots

- Added schema bookmarks and a schema history view, with the ability to restore to any past point.
- Model runs and exports now snapshot the schema and drop a visual marker in the history.
- Human-readable ("Docker-style") names for runs and schema versions; model information is stored on each run and shown on its card.

### ML run reliability and error handling

- ML runs now have real terminal states (done / error / cancelled) instead of hanging silently.
- Run controls are gated on model readiness; readiness is structural-only (the eager connection probe was dropped after an interim "checking…" state).
- Fail-fast behavior: offline pre-check and a circuit breaker short-circuit doomed runs, and per-block failures are surfaced instead of swallowed.
- OpenAI-compatible fixes: use `max_completion_tokens`, default the base URL to OpenAI proper, heal empty stored base URLs, and remove per-model generation params (effort, temperature, top_p, max_tokens).

### Minimap

- New annotation minimap with preview highlights and squiggly highlight rendering.

### Fixes

- The delete-instance popover no longer crashes the sidebar (re-portaled to avoid a `removeChild` error).
- Promoting an instance from the sidebar no longer deletes it.
- Tabs own their own message requests, so multiple viewer tabs no longer store each other's annotations.
- Reworked XY-cut to handle more papers; improved transcript spacing.

### UI polish

- Bundled IBM Plex Sans as the default UI font.
- New classes steal focus on their title to prompt editing; Enter selects in the combobox; clearer "add highlighter" button text; renamed "delete class" to "delete highlighter".

### Testing, CI, and tooling

- Introduced the Vitest suite (component, skeleton, and schema-reducer tests) with real-PDF fixtures for XY-cut.
- Added a CI pipeline (collapsed typecheck and test steps; zip artifact only on push to `main`).
- Added Chrome DevTools MCP and project-wide agent instructions.
