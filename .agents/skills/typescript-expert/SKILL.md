---
name: typescript-expert
description: Design, implement, refactor, debug, and verify TypeScript in tts-mermaid across strict browser code, shared slide contracts, PowerPoint normalization/import/export, and Node CLIs. Use for .ts/.tsx contract work, unsafe JSON or external-input boundaries, type errors, module/runtime separation, or complex discriminated unions; pair with the React skill for UI behavior and the Express skill for server APIs.
---

# tts-mermaid TypeScript expert

Use TypeScript to make invalid slide, workflow, and runtime states difficult to represent while
preserving the repository's existing architecture and naming conventions.

This skill adapts the useful parts of the referenced community `typescript-expert` skill—strict
types, runtime validation, explicit architecture, secure configuration, tests, and measured
performance—to this repository. It deliberately does not impose generic kebab-case filenames,
mandatory JSDoc, function-length limits, or nonexistent lint/type-check scripts.

## Establish the real compilation context

1. Read the root `AGENTS.md`, run `git status --short`, and inspect the nearest implementation and
   tests.
2. Identify the runtime before choosing types or imports:
   - `tsconfig.app.json`: browser/shared source, ES2022, DOM, bundler resolution.
   - `tsconfig.node.json`: Vite configuration, ES2023, Node types.
   - `scripts/**` and `src/lib/import/**`: Node execution through `tsx`, but scripts are not
     currently included by the project-reference typecheck.
3. Inspect `package.json` and the lockfile before using library- or TypeScript-version-specific
   behavior. The current compiler is TypeScript 5.9 in strict, no-emit mode.
4. Trace a changed contract to all producers, validators/normalizers, consumers, serializers, and
   tests before editing it.

## Keep runtime graphs honest

- Use ESM imports and the existing bundler resolution. Do not introduce CommonJS helpers without a
  demonstrated external compatibility requirement.
- Browser-reachable modules must not import `node:*`, `process`, filesystem-backed configuration,
  or `src/lib/import/**`.
- Shared model and normalization code should remain deterministic and free of React, DOM, network,
  filesystem, and environment access.
- Use `import type` when an import is type-only. Do not rely on type erasure to excuse a runtime
  dependency cycle.
- Keep direct runtime imports declared in `package.json`; do not intentionally depend on a
  transitive package.
- Diagnose resolution issues with the actual TypeScript config and `--traceResolution` only when
  ordinary inspection is insufficient. Do not alter module settings until the failing runtime and
  package export are understood.

## Type design

- Prefer domain names and discriminants over generic bags of optional fields.
- Use discriminated unions for slide elements, interaction states, async workflows, and result/error
  variants. Narrow with the discriminant and use exhaustive `never` checks when a missed variant
  would be a correctness bug.
- Reuse `JsonValue`/`JsonObject` only at loose JSON boundaries. Convert to a normalized or
  task-specific type before business logic and rendering.
- Use `unknown` for untrusted values and narrow it. Avoid `any`, double casts through `unknown`,
  broad index signatures, `@ts-ignore`, and unexplained non-null assertions.
- Prefer `satisfies` when checking an object without widening away useful literals, and `as const`
  for schema/lookup literals whose exact values matter.
- Use utility types when they express a meaningful relationship to a source contract. Define an
  explicit named type when a dense stack of `Pick`, `Omit`, conditional, or mapped types hides the
  domain meaning.
- Use branded/opaque IDs or unit-specific aliases only when the code actually mixes values that are
  structurally identical and dangerous to interchange. Do not add type ceremony without a real
  invariant.
- Preserve readonly inputs and return new arrays/objects for edits. Copy state-owned `Map`/`Set`
  values before mutation.

## Runtime validation and parsing

Type annotations disappear at runtime. Validate every external boundary:

- pasted or imported JSON;
- OpenAI structured output;
- uploaded file metadata and bytes;
- PPTX ZIP entries and XML-derived values;
- CLI arguments and filesystem paths;
- future Express params, query, headers, and bodies.

Apply validation in layers:

1. Check container shape and required discriminants.
2. Parse/coerce only explicitly supported representations.
3. Check numeric finiteness, dimensions, ranges, IDs, enums, and cross-field invariants.
4. Normalize defaults and legacy variants in one place.
5. Return structured issues when callers can recover; throw a sanitized error when the operation
   cannot proceed.

Do not write `JSON.parse(value) as SomeType` and treat the cast as proof. The existing
normalization result and `ValidationIssue` pattern are preferred for slide data. When a new schema
validator dependency would help, add it only as part of an authorized dependency change and keep
the inferred static type aligned with the runtime schema.

## Slide and PowerPoint contracts

- `NormalizedPresentation` is the internal source of truth for rendering/export. Raw native and
  extracted shapes should converge there.
- Preserve the discriminants and distinct geometry of text, shape, line, and image elements.
- Treat pixels, inches, EMUs, slide coordinates, zoom factors, opacity, and rotation as different
  concepts even when they are all `number`. Centralize conversions and rounding policy.
- Preserve element order and stable IDs. Layering, selection, editing, and PowerPoint fidelity rely
  on them.
- Keep text runs and aggregate text consistent according to the existing normalization/edit rules.
  Do not update one representation while silently leaving the other stale.
- Schema changes to `SlidePromptOutput` require coordinated edits to the TypeScript type, JSON
  schema, runtime validation/normalization, prompts if relevant, all consumers, and focused tests.
- Parser/exporter changes need malformed-input tests and a round-trip invariant, not compilation
  alone.

## Async, errors, and resources

- Catch only where code can add context, translate to a domain/UI error, recover, or release a
  resource. Do not wrap every `await` mechanically.
- Narrow caught values with `instanceof Error` or the repository's `ThrownValue` convention.
- Preserve useful internal causes without surfacing secrets, raw provider bodies, document content,
  XML, or absolute paths to users.
- Use `Promise.all` only for independent work with acceptable concurrency and failure semantics.
  Bound work when file count/size or model/API calls can amplify memory, cost, or load.
- Tie cancellation to the owner of network or long-running work when practical. Ignore stale async
  completion after the owning workflow has moved on.
- Close writable handles in `finally`, revoke browser object URLs, and use disposable directories
  for filesystem tests.

## Performance and compiler complexity

- Measure a real bottleneck before optimizing. For type-check slowness, use compiler diagnostics or
  a generated trace and inspect the responsible types rather than weakening strictness globally.
- Avoid recursive conditional types over unconstrained input, enormous unions, and deeply composed
  mapped types when a simpler named intermediate preserves the same contract.
- Avoid repeated JSON stringify/parse and repeated base64 copies of large files in hot paths.
- Keep render-time geometry pure and memoize only computations or identities that materially affect
  interaction behavior.
- For OOXML, stream or bound work where the chosen library permits; at minimum enforce limits before
  expanding untrusted archives in a server context.

## Tests and verification

Test the narrowest invariant at the layer that owns it:

- types/schema: allowed and forbidden variants;
- normalizer: malformed values, legacy inputs, issues, and stable normalized output;
- geometry/edit: pure deterministic transformations and immutability;
- import/export: fixtures, ordering, text, media/crop, and round-trip behavior;
- CLI: argument validation, exit behavior, and temporary filesystem output;
- React: user-observable behavior through Testing Library.

Run from the repository root:

```sh
npm test -- path/to/affected.test.ts
npm exec tsc -- -b
npm test
npm run build
```

For PowerPoint work, include the relevant normalizer/canvas tests and
`npm test -- scripts/parse-pptx.test.ts`. Because `scripts/**` is outside the current project
references, run a safe CLI smoke test with disposable files when the changed path is not fully
exercised by Vitest.

There is no lint script, and Vite build does not replace TypeScript checking. Report exact checks,
skipped runtime/round-trip verification, and remaining uncertainty.
