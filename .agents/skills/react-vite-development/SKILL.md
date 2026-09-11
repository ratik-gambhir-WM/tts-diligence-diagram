---
name: react-vite-development
description: Develop, refactor, debug, review, and verify diligence-studio's React 19 and Vite 7 browser application, including routes, components, hooks, Tailwind/CSS, file workflows, the editable SVG canvas, and browser-side OpenAI and PowerPoint export behavior. Use for TSX or browser UI work; do not use as the primary guide for Node-only PowerPoint import scripts or a standalone Express server.
---

# diligence-studio React + Vite development

Build the smallest coherent browser change while preserving the slide-data contract, accessible
interaction behavior, and user-owned work.

## Read before editing

1. Read the root `AGENTS.md` and run `git status --short`.
2. Read `web/package.json`, the root `package-lock.json`, `web/vite.config.ts`,
   `web/tsconfig.app.json`, and `web/vitest.config.ts` when the task touches their concerns.
3. Trace the changed route from `web/src/App.tsx` through its page, components/hooks, library calls,
   and nearby tests.
4. For canvas work, trace `buildSlideCanvasModel` -> `SvgSlideCanvas` -> the relevant interaction or
   viewport hook -> immutable edit application.
5. Confirm live dependency versions rather than relying on generic React or router examples.

## Preserve the browser boundary

- The browser graph begins at `web/src/main.tsx`. Never import `node:*`, the OOXML importer, filesystem
  paths, or process-global configuration into it.
- Keep Node PowerPoint parsing under `server/src/lib/import/` and `server/scripts/`.
- Treat all `VITE_*` configuration as public. The current direct OpenAI client and
  `dangerouslyAllowBrowser` option are development-only; never add another secret to the bundle.
- Uploaded files, pasted JSON, template JSON, model output, PPTX files, and File System Access
  handles are untrusted. Validate before acting and show sanitized errors.
- Revoke object URLs and release listeners/resources when ownership ends. Avoid retaining duplicate
  base64 copies of large attachments longer than necessary.

## State ownership and React behavior

- Keep state at the narrowest owner. `App.tsx` should own a value only when it spans routes or
  coordinates an app-level workflow.
- Use a focused hook or reducer when several values form one state machine. Prefer a discriminated
  state to booleans that permit impossible combinations.
- Derive render values with ordinary expressions or `useMemo` only when computation or referential
  stability justifies it. Do not use effects to mirror props or derive state.
- Effects synchronize external systems. They must be repeatable under development behavior, list
  complete dependencies, and clean up timers, subscriptions, requests, and resources.
- Guard async completion against stale requests or route changes when overlapping work is possible.
  Disable duplicate model calls and exports while one is pending.
- Preserve the current route/session behavior intentionally. The session-stored email is not auth;
  do not build security assumptions on it.
- Avoid oversized page components when a coherent stateful workflow, pure helper, or display
  component can be extracted. Do not fragment a simple flow into pass-through abstractions.

## Canvas interaction rules

- Treat the canvas input as immutable. Flow edits through `onChange` and the slide-edit helpers;
  never mutate the template JSON, normalized element, `Map`, or `Set` owned by state.
- Preserve stable element keys/IDs and element order. Selection, focus, text editing, line endpoints,
  resizing, dragging, pan, zoom, and multi-selection depend on stable identity and coordinates.
- Convert pointer coordinates through the established SVG transform helpers. Do not mix viewport
  pixels with slide coordinates.
- Keep pointer capture/cancel behavior and keyboard behavior coherent. Test cancellation as well as
  successful completion of an interaction.
- Unsupported shapes should remain visible and diagnosable without leaking document content or
  crashing the whole slide.
- Maintain readable focus styling, accessible SVG naming/instructions, and non-pointer operation.

## UI and accessibility

- Reuse `web/src/components/`, existing page shells/navigation, Tailwind 4 conventions, and the
  established canvas CSS before adding another styling system.
- Prefer native buttons, inputs, labels, and dialogs. Preserve accessible names, focus order,
  keyboard interaction, and focus restoration.
- Pending work needs visible feedback and disabled controls. Errors should explain recovery without
  exposing keys, raw provider responses, absolute paths, XML, or source-document contents.
- Keep reduced-motion behavior for route transitions and avoid animation as the only state signal.
- Verify responsive behavior at the dense canvas toolbar and upload/picker layouts, not only at a
  desktop width.
- Do not use `dangerouslySetInnerHTML` for uploaded, model-generated, Markdown, XML, or JSON content
  without an explicit sanitizer and threat-model review.

## Data and async workflows

- Keep OpenAI request construction in the current adapter boundary rather than scattering SDK calls
  across components.
- Keep PowerPoint generation behind `web/src/lib/export/exporter.ts`; pages coordinate UX and should not
  duplicate normalization or ZIP manipulation.
- Parse JSON once at a boundary, narrow it through normalization/validation, and render the typed
  model. A TypeScript cast is not runtime validation.
- Model loading, empty, unsupported-file, provider-error, invalid-output, export-error, and success
  states where the workflow can reach them.
- Do not log model selections, filenames, prompts, attachment metadata, generated content, or user
  email as a casual debugging aid.

## Testing

- Use Vitest, jsdom, Testing Library, and user-event in the patterns already present.
- Test behavior observable by a user or caller. Avoid snapshots of large SVG/PPTX structures when a
  focused invariant is clearer.
- For hooks and async pages, cover success, validation failure, rejected work, disabled/pending
  behavior, and stale/cancel behavior when applicable.
- For canvas changes, cover the pure geometry/edit rule first, then the smallest interaction test
  that proves keyboard/pointer integration.
- Mock OpenAI and file-writing boundaries for routine UI tests. Do not make tests depend on network,
  API keys, local Office software, or valuable user files.

## Verification ladder

Run from the repository root:

```sh
npm run test --workspace @diligence-studio/web -- src/path/to/affected.test.ts
npm run typecheck
npm test
npm run build
```

`npm run build` is Vite bundling only; keep the separate TypeScript check. There is no lint script.
Do not invent one or broadly format the repository.

For meaningful UI work, run `npm run dev` and inspect the changed route, browser console, primary
workflow, pending/error/success states, keyboard/focus behavior, reduced motion, and relevant
viewports. Report exact checks, skipped manual inspection, and remaining uncertainty.
