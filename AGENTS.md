# tts-mermaid agent guide

This file governs the entire repository. Read it before changing code, then read the
project-local skill that matches the task.

tts-mermaid is a development-stage React application for turning technical source material and
slide JSON into editable architecture diagrams and PowerPoint output. The same repository also
contains Node-only TypeScript CLIs for PowerPoint OOXML import and conversion. There is no Express
server today. Preserve that distinction and preserve any user-owned working-tree changes.

## Instruction and source-of-truth order

When guidance disagrees, use this order:

1. The current user request.
2. The nearest `AGENTS.md` for the file being changed, if a nested guide is added later.
3. This root `AGENTS.md`.
4. Current code, `package.json`, `package-lock.json`, TypeScript configs, and tests.
5. Files under `research/` and `plan/` as design inputs, not implemented product contracts.
6. Files under `mock-data/` as fixtures and prompt context, not production truth.

Code and executable tests are the final authority. Do not infer behavior from the repository name
or from stale generated JSON and image artifacts.

## Start every task this way

1. Run `git status --short` from the repository root. Re-run it before handoff.
2. Identify every runtime the change touches: browser, shared/pure TypeScript, Node CLI, or a
   newly requested Express server.
3. Load the applicable project skill:
   - React, TSX, routing, hooks, CSS, accessibility, or browser behavior:
     [`.agents/skills/react-vite-development/SKILL.md`](.agents/skills/react-vite-development/SKILL.md)
   - TypeScript contracts, parsing, normalization, import/export, CLI code, or type errors:
     [`.agents/skills/typescript-expert/SKILL.md`](.agents/skills/typescript-expert/SKILL.md)
   - Adding or changing an Express API:
     [`.agents/skills/express-development/SKILL.md`](.agents/skills/express-development/SKILL.md)
4. Inspect the relevant manifest/config, entrypoint, nearby implementation, and nearby tests.
5. State the behavior and contracts that must remain stable before editing.
6. Make the smallest coherent change and verify it with repository-native commands.

Never assume an empty working tree. Existing tracked edits, deletions, and untracked files belong
to the user unless the task explicitly says otherwise. Do not discard, overwrite, broadly format,
or reorganize unrelated work.

## Repository map

| Path | Role | Runtime |
| --- | --- | --- |
| `src/main.tsx` | Browser bootstrap and router mounting | Browser |
| `src/App.tsx` | Route composition and top-level workflow state | Browser |
| `src/pages/` | Route-level UI and workflow orchestration | Browser |
| `src/components/` | Reusable presentation primitives | Browser |
| `src/hooks/` | Browser workflow state such as uploaded attachments | Browser |
| `src/lib/OpenAI.ts` | Current direct Responses API browser adapter | Browser, development-only trust model |
| `src/lib/slide-canvas/` | Pure slide model, edits, geometry, and text-run behavior | Shared/pure |
| `src/lib/slide-svg/` | Interactive SVG rendering, selection, editing, pan, and zoom | Browser |
| `src/lib/shared/` | PowerPoint contracts, normalization, layering, and utilities | Shared/pure by default |
| `src/lib/export/` | JSON normalization and browser-compatible PPTX generation/editing | Browser/shared |
| `src/lib/import/` | OOXML extraction and compact JSON writing | Node only |
| `src/types/` | OpenAI output contracts and JSON schemas | Shared/browser |
| `src/prompts/` | Prompt instructions imported as raw build assets | Browser bundle |
| `scripts/` | TypeScript command-line tools and CLI integration tests | Node only |
| `mock-data/` | Development fixtures, examples, and retained prompt context | Data only |
| `assets/`, `arch-images/`, `src/*-assets/` | Source images and bundled presentation assets | Static assets |

The repository has one npm package and one lockfile. There is no workspace orchestrator, Express
dependency, server entrypoint, ESLint/Prettier config, CI workflow, or deployment manifest. Do not
invent commands or document infrastructure that does not exist.

## Runtime boundaries

### Browser versus Node

- Browser code is reachable from `src/main.tsx`. It must not import `node:*`, filesystem paths,
  process-global configuration, or `src/lib/import/**`.
- Node CLIs may import the OOXML importer and other pure/shared modules. Keep browser globals out of
  their execution path unless a function explicitly guards and abstracts them.
- `src/lib/shared/` should remain deterministic and environment-neutral. Do not add DOM, React,
  filesystem, network, or environment access to a shared model/helper for convenience.
- `src/lib/export/` intentionally supports browser file download and File System Access handles.
  Preserve its runtime guards and do not assume those APIs exist in every browser.
- If Express is introduced, put server-only code behind an explicit server entrypoint and a
  dedicated TypeScript config. Never make server code reachable from the Vite module graph.

### Slide data pipeline

The maintained flow is:

```text
template / pasted JSON / OpenAI JSON
  -> normalizePresentationSpec
  -> NormalizedPresentation
  -> slide-canvas model + immutable edits
  -> SVG renderer and/or PowerPoint renderer

.pptx OOXML (Node only)
  -> extracted slide records
  -> normalizePresentationSpec
  -> compact canvas JSON
  -> round-trip normalization check
  -> JSON output
```

- `JsonValue` is the loose boundary type; a cast does not validate runtime JSON.
- `NormalizedPresentation` and its discriminated element union are the internal rendering
  contract. Prefer extending normalization once over teaching every consumer a new raw shape.
- Preserve element IDs, element order, slide dimensions, coordinate units, text runs, layering,
  opacity, transforms, crop metadata, arrows, and branding flags unless the task changes them.
- Import/export changes require a round-trip mindset: JSON -> model -> PPTX and PPTX -> JSON ->
  model must not silently lose unrelated information.
- Treat PPTX/ZIP/XML, pasted JSON, uploaded files, model output, and file handles as untrusted input.
  Validate sizes, structure, numeric finiteness/ranges, filenames, and supported variants at the
  boundary that first understands them.

### OpenAI and secrets

- Every `VITE_*` value is embedded in public browser JavaScript. It can never be treated as a
  secret.
- The current `vite.config.ts` aliases server-looking OpenAI environment names into
  `VITE_OPENAI_API_KEY`, and `src/lib/OpenAI.ts` uses `dangerouslyAllowBrowser`. This is a
  development-only trust model, not a production security pattern. Do not describe it as secure,
  log the key, or expand it to additional secrets.
- A production API-key flow belongs behind a server boundary. When a requested Express change
  creates that boundary, keep the key server-side and expose a narrow, validated application
  endpoint rather than a generic OpenAI proxy.
- Prompt files, uploaded diligence documents, filenames, and generated diagrams may be sensitive.
  Do not print their contents in logs, fixtures, screenshots, or error messages.

### Session and authorization

- The email stored in `sessionStorage` is navigation/session UI only. It is not authentication,
  authorization, identity proof, or a tenant boundary.
- Route redirects are client behavior, not access control. Any future server must authenticate and
  authorize independently of caller-supplied email or browser state.

## React and UI rules

- Use npm and preserve `package-lock.json`; do not mix package managers.
- Confirm live versions in the manifest and lockfile before using version-specific APIs. The
  current install is React 19, React Router 7, Vite 7, Tailwind 4, Motion 12, and Vitest 4.
- Keep top-level workflow ownership in `App.tsx` only while the state genuinely spans routes.
  Keep local UI state in the smallest page, component, or hook that owns it.
- Derive render values instead of synchronizing duplicate state with effects. Effects are for
  external synchronization and must clean up subscriptions, timers, object URLs, and requests.
- Async actions must represent disabled/pending, success, error, retry, and stale/cancelled behavior
  as relevant. Prevent duplicate model calls and duplicate exports.
- Reuse existing components, Tailwind conventions, CSS classes, colors, and slide-canvas primitives
  before introducing another abstraction or styling system.
- Preserve semantic controls, labels, keyboard operation, visible focus, status/error feedback,
  reduced-motion behavior, and responsive layouts.
- The SVG canvas is keyboard and pointer software, not a static picture. Changes to selection,
  dragging, resizing, text editing, pan, zoom, or focus require tests for interaction state and
  hands-on browser inspection when practical.

## TypeScript rules

- Keep both TypeScript configs strict. Avoid `any`, `@ts-ignore`, unexplained non-null assertions,
  broad casts, and suppression comments.
- Prefer `unknown` plus narrowing for untrusted values and discriminated unions for element types,
  async states, and editing states.
- Match the repository's existing filename conventions. Components and PowerPoint modules use
  PascalCase; hooks and focused utilities use camelCase. Do not impose a repository-wide rename.
- Keep schemas and TypeScript contracts aligned. When OpenAI output or slide JSON changes, update
  the schema, the type, validation/normalization, consumers, and tests together.
- Preserve immutability at React and slide-editing boundaries. Do not mutate props, template JSON,
  normalized slides, or state-owned `Set`/`Map` objects in place.
- Scripts under `scripts/` are not included by the current project-reference typecheck. Verify
  changed scripts through focused Vitest coverage and a safe disposable CLI run when warranted.
- Add a dependency only when it materially improves the requested outcome and no installed tool
  fits. Direct imports should be declared dependencies; do not rely intentionally on transitive
  packages.

## Express rules

There is no Express application in the current repository. Do not claim routes, middleware,
server tests, or deployment behavior exist.

If a task explicitly adds Express:

- keep it in a `server/` boundary with an app factory separate from the process listener;
- add an explicit server TypeScript config and package scripts rather than routing it through Vite;
- validate configuration once at startup and keep secrets out of client-readable values;
- use narrow route -> application/service -> integration dependencies;
- validate params, query, headers, and body at runtime, set body limits, and return a consistent
  sanitized error shape;
- make authentication, authorization, CORS, proxy trust, rate limits, timeouts, cancellation, and
  graceful shutdown explicit rather than relying on defaults;
- test the app factory without binding a real port, and use fake OpenAI/file collaborators rather
  than live services.

The Express skill contains the detailed server workflow.

## Generated, local, and sensitive files

Do not hand-edit or commit local/generated output unless the task explicitly requires it:

- `node_modules/`, `dist/`, `coverage/`, `.vite/`, `*.tsbuildinfo`
- `.env`, `.env.*` except documented example files
- logs, temporary PPTX/ZIP extraction directories, and one-off generated decks/JSON

Do not read or modify a real `.env` merely to diagnose configuration. Inspect the declared
environment names in code or an example schema, and ask for only the missing value if runtime
verification truly needs it.

Source template JSON and checked-in images are not automatically generated junk. Resolve their
callers and purpose before moving, replacing, or deleting them.

## Verification matrix

Read the real scripts before running commands. Start focused, then broaden in proportion to risk.

### React, shared TypeScript, and browser export

```sh
npm test -- src/path/to/affected.test.ts
npm exec tsc -- -b
npm test
npm run build
```

- `npm run build` runs Vite only; it is not a substitute for the TypeScript build check.
- There is no lint command. Do not invent or report `npm run lint`.
- For meaningful UI work, run `npm run dev` and inspect the changed route, console, primary async
  states, keyboard/focus behavior, and relevant viewport sizes.
- OpenAI runtime testing may consume data and money. Use mocks for routine verification; call the
  live API only when explicitly required and configured with non-sensitive test inputs.

### PowerPoint import/export and Node CLIs

```sh
npm test -- scripts/parse-pptx.test.ts
npm test -- src/lib/shared/PowerpointNormalizer.test.ts
npm test
npm exec tsc -- -b
npm run build
```

Run a CLI smoke test only with a disposable input and explicit temporary output. `pptx:to-json`
writes files, and other scripts may create assets beside their output. Never aim a verification run
at valuable source decks or user output directories.

### Express, if it is added

Add focused route/service tests and real package scripts in the same change. The minimum broad gate
should include server typechecking, server tests, existing client tests, and the Vite build. Do not
document a command until it exists and has been run.

### Documentation and agent skills

- Confirm every documented path and command exists.
- Validate each changed skill with the available skill validator.
- Run `git diff --check`, inspect `git diff`, and re-run `git status --short`.

## Definition of done

A change is ready only when:

- the requested behavior is complete in every affected runtime;
- browser, Node, slide-contract, OpenAI, and future-server boundaries still hold;
- relevant focused tests and proportional broad checks pass;
- meaningful UI behavior was inspected when practical;
- no real secrets, sensitive document contents, debug logging, generated output, or accidental
  lockfile churn entered the diff;
- `git diff --check` is clean and final status was reviewed;
- the handoff reports exact commands/outcomes, skipped checks and why, remaining uncertainty, and
  pre-existing failures separately.
