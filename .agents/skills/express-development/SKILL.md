---
name: express-development
description: Add, design, implement, review, secure, test, and troubleshoot an Express API for tts-mermaid, especially a server-side OpenAI boundary, upload/JSON/PPTX endpoints, and browser-to-server contracts. Use when Express or HTTP server work is explicitly in scope; this repository has no Express server today, so do not treat this skill as evidence that one already exists.
---

# tts-mermaid Express development

Create a narrow, production-shaped server boundary without coupling Express to the React tree or
moving slide-domain logic into handlers.

## First determine whether a server exists

Read the root `AGENTS.md`, run `git status --short`, and inspect `package.json`, lockfile, TypeScript
configs, and deployment constraints. At the time this skill was created:

- Express is not installed.
- There is no `server/`, API contract, server TypeScript config, server script, auth system,
  persistence layer, deployment manifest, or server test harness.
- The React app calls OpenAI directly from the browser with a public Vite-injected key. That is a
  development-only trust boundary and the strongest likely reason to add a server.

Do not invent existing routes or silently add a server during unrelated UI work. When a user asks
to introduce one, default to a `server/` source boundary, an explicit server TypeScript config, and
real root package scripts unless the chosen deployment requires a separate package.

## Recommended new-server shape

Use the smallest subset justified by the feature:

```text
server/
  src/
    app.ts          # creates/configures Express; no listen side effect
    server.ts       # config, listen, signals, graceful shutdown
    config.ts       # parse and validate environment once
    routes/         # HTTP method/path/middleware composition
    handlers/       # transport validation and response adaptation
    services/       # application use cases
    integrations/   # OpenAI or other external clients
    errors.ts       # typed internal errors and HTTP mapping
  test/             # request-level and service tests
```

Keep shared wire contracts in an environment-neutral location only when both client and server
truly consume them. Shared contracts must not import Express, React, DOM, Node-only infrastructure,
or provider SDK types.

The dependency direction is:

```text
server.ts -> config -> integrations/services -> app -> routes -> handlers -> services
request -----------------------------------------------------> handler -> service -> integration
```

- `app.ts` returns a configured app for tests; it does not bind a port or read arbitrary ambient
  state throughout the module graph.
- Handlers translate HTTP to application calls. They do not contain prompt construction, ZIP/XML
  parsing, slide normalization, or provider-client setup.
- Services own use-case rules and depend on narrow injected interfaces.
- Integrations adapt SDK/network errors to internal errors and never return raw provider responses
  directly to the browser.

## Version and dependency discipline

- Confirm the installed Express major version before relying on async error propagation, route
  syntax, request types, or middleware behavior.
- Add Express and its type/test dependencies only as part of the requested server change. Use npm
  and keep lockfile churn focused.
- Prefer installed platform/library features over adding middleware packages reflexively. If a
  security or validation dependency is warranted, state what concrete risk or duplication it
  addresses.
- Keep server packages out of the Vite module graph. Verify the browser bundle does not gain
  Express, Node built-ins, server OpenAI code, or secret configuration.

## Request lifecycle and middleware order

Compose middleware deliberately:

1. request ID and minimal structured logging;
2. proxy/trust and security policy configured for the actual deployment;
3. CORS when cross-origin browser access is intentionally supported;
4. global timeout/cancellation hooks and rate/abuse controls where required;
5. parsers with explicit content types and small body limits;
6. authentication and authorization before protected work;
7. feature routers;
8. not-found handling;
9. final error middleware with the Express error-handler signature.

Do not apply a JSON parser to multipart/file routes and assume that secures them. Use a dedicated,
bounded upload path. Reject unsupported content types early.

Tie an `AbortController` to request abort/close when downstream OpenAI or expensive processing can
be cancelled. Remove listeners after completion. Never continue costly work merely because the
client disconnected unless the endpoint explicitly creates a durable background job.

## Validation and API contracts

- Treat params, query, body, headers, cookies, filenames, MIME types, uploaded bytes, model output,
  and caller identity as untrusted.
- Validate at runtime before casting. Reject unknown or oversized structures rather than spreading
  them into provider options or slide JSON.
- Keep DTOs provider-neutral. A browser endpoint should express the application's operation, not
  expose arbitrary model names, system prompts, tools, URLs, or raw OpenAI request bodies unless
  that flexibility is an intentional authorized product feature.
- Use explicit status codes: validation failure, unauthenticated, forbidden, not found, conflict,
  too large, unsupported media, rate limited, timeout/cancelled, dependency failure, and internal
  failure are not interchangeable.
- Return one small documented error envelope with a stable machine code, safe message, and request
  ID. Do not return stack traces, environment details, absolute paths, raw XML, SQL, prompts,
  provider bodies, or document contents.
- Add contract tests for JSON casing, multipart field names, limits, binary responses, and error
  behavior. Compilation alone does not prove client/server compatibility.

## OpenAI boundary

- Read the API key only in validated server configuration. Never pass it to React, `VITE_*`,
  browser storage, response bodies, or logs.
- Build the allowed prompt/instructions and structured-output schema on the server. Accept only the
  user-controlled fields the application needs.
- Apply file count/type/size limits before encoding or forwarding attachments. Account for base64
  expansion, total request memory, provider limits, cost, and sensitive-data handling.
- Set request timeouts, forward cancellation, bound retries, and retry only operations known to be
  safe. Do not multiply billable requests through generic retry middleware.
- Normalize provider failures into application errors. Log safe operational metadata such as
  request ID and error class, not keys, prompts, filenames, emails, or response content.
- Mock the provider in tests. A live integration check requires explicit intent, non-sensitive test
  data, configured spending, and a clear stopping condition.

## Security and operations

- Validate configuration once at startup and fail fast with key names, never key values.
- Configure `trust proxy` only for the real proxy topology; incorrect trust changes client IP and
  secure-cookie behavior.
- Use an origin allowlist for credentialed CORS. Never combine reflected arbitrary origins with
  credentials.
- Set secure cookie attributes when cookies are introduced. Do not confuse the current browser email
  session with authentication.
- Authentication establishes identity; authorization checks the requested resource/action. Enforce
  both server-side for every protected route.
- Bound JSON, URL-encoded, multipart, decompression, ZIP/XML, concurrency, and response sizes. ZIP
  bombs and XML expansion are server risks even if local CLI inputs were previously trusted.
- Avoid synchronous filesystem, compression, hashing, PowerPoint generation, and heavy parsing on
  the request event loop. Use bounded worker/offload patterns or an explicit job design.
- On shutdown, stop accepting new requests, allow a bounded drain, cancel remaining work, and close
  resources. Tests should not leave open servers, timers, or sockets.

## Testing strategy

Build `app.ts` with injected fake services and test it without listening on a fixed port.

Cover:

- happy path and exact response contract;
- malformed/missing/unknown input and content type;
- body/file count and size limits;
- unauthenticated and unauthorized requests once identity exists;
- service/provider timeout, cancellation, rejection, and sanitized 5xx mapping;
- duplicate/idempotent behavior when an operation can be retried;
- client disconnect cleanup for expensive downstream work;
- configuration validation and secret redaction;
- graceful shutdown at the process boundary where practical.

Use temporary directories and synthetic PPTX/JSON fixtures. Never use a real `.env`, live OpenAI,
valuable decks, or user output directories in routine tests.

## Verification gate

When Express is introduced, add named package scripts for server development, typechecking, and
tests, then document and run the real commands. A proportional gate includes:

1. focused service and request tests;
2. server TypeScript checking;
3. the complete server suite;
4. existing `npm exec tsc -- -b` and `npm test` checks;
5. `npm run build` plus inspection that server modules/secrets are absent from `dist`;
6. a disposable local HTTP smoke test only when it adds evidence beyond request-level tests.

There is currently no server command to run. Never claim an Express check passed until the change
actually creates and executes it. Report exact checks, skipped integration/security verification,
and remaining deployment assumptions.
