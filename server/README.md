# PowerPoint import and export APIs

This package is the Node-only sibling of the React app in `../web`. It keeps its PowerPoint
implementation under `src/lib`; nothing in this package enters the React/Vite module graph.
Uploaded `.pptx` files are OOXML ZIP packages. Their
compact canvas JSON is stored in SQLite. Imported image bytes are stored separately from the JSON
as BLOB assets. Template metadata and first-slide PNG previews are stored in dedicated tables.
The checked-in diagram and commentary catalog is seeded transactionally and idempotently at startup.

The server uses Node's built-in SQLite module and therefore requires Node.js 22.5 or newer.

## Run

```sh
npx playwright install chromium
npm run server:dev
```

Configuration is read once at startup:

- `PORT` defaults to `3001`.
- `HOST` defaults to `0.0.0.0` and must be an IP address.
- `SQLITE_DB_PATH` defaults to `server/data/templates.sqlite` from the repository root.
- `MAX_PPTX_UPLOAD_BYTES` defaults to `26214400` (25 MiB).
- `MAX_EXPORT_JSON_BYTES` defaults to `52428800` (50 MiB).
- `TEMPLATE_PREVIEW_PROVIDER` defaults to `headless`. It accepts `headless`, `quicklook`, or
  `disabled`.
- `TEMPLATE_PREVIEW_RENDER_SIZE` defaults to `1600` pixels.
- `TEMPLATE_PREVIEW_RENDER_URL` defaults to
  `http://localhost:5173/_internal/template-preview`. It must point to the Vite app (or the deployed
  web app) while imports are running.
- `TEMPLATE_PREVIEW_TIMEOUT_MS` defaults to `15000`.
- `MAX_TEMPLATE_PREVIEW_BYTES` defaults to `10485760` (10 MiB).

Requests time out after 30 seconds. Compressed request bodies are rejected.

The default preview provider launches Chromium headlessly, injects normalized slide JSON before
the preview page loads, and screenshots only the read-only SVG slide surface. No browser window is
shown. The renderer blocks requests to origins other than the configured web-app origin. Run the
web app and API together during local imports; production must expose the internal preview route
at `TEMPLATE_PREVIEW_RENDER_URL`. `quicklook` remains available as an explicit compatibility
fallback on macOS, but it renders the uploaded PowerPoint rather than the normalized canvas model.

## API

Import a deck by sending its binary `.pptx` body:

```sh
curl --request POST 'http://localhost:3001/import?kind=diagram' \
  --header 'Content-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation' \
  --data-binary @deck.pptx
```

The `201` response body is canvas JSON with a single top-level `presentation` property. It
is the same JSON contract accepted by `POST /export`. Image `src` values are complete
`data:image/...;base64,...` URIs. The generated ID is returned in both the `Location` and
`X-Template-Id` headers. `X-Template-Preview-Status` is `ready` or `unavailable`, and
`X-PowerPoint-Warning-Count` reports non-fatal import warnings. Imported templates must contain
exactly one slide. The validated `kind` query is `diagram` or `commentary` and defaults to `diagram`.

Import a multi-slide deck as one independently stored template JSON per slide with
`POST /batchImport?kind=diagram|commentary`. The request body and content type are the same as
`POST /import`:

```sh
curl --request POST 'http://localhost:3001/batchImport?kind=diagram' \
  --header 'Content-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation' \
  --data-binary @deck.pptx
```

The `201` response contains `templates`, with one `templateId`, `templateJson`, and
`previewAvailable` entry for every source slide, plus an aggregate `warnings` array. Every
`templateJson` contains exactly one slide and is persisted with its own metadata, image assets,
and preview. Its presentation title is the source slide's derived name. `X-Imported-Template-Count`
reports the number stored. The complete batch is committed atomically, so a database failure does
not leave a partially imported deck. The default headless preview provider renders every slide;
the Quick Look compatibility provider can preview only the first slide and reports later previews
as unavailable rather than storing an incorrect image.

`GET /templates/:templateId` returns that same canvas JSON body. `GET /import/:templateId` is a
backward-compatible alias. Both routes join the stored template to all of its assets and hydrate
each image `src` from its BLOB. Image bytes also remain directly available from
`/import/:templateId/assets/:assetId`.

`GET /templates?kind=diagram` lists lightweight metadata in newest-first order. Each item includes
its ID, kind, title, description, slide and element counts, and a nullable `previewUrl`.
`GET /templates/:templateId/preview` returns the stored PNG without exposing local paths.
`DELETE /templates/:templateId`
removes a template and its associated image assets, returning `204` when deleted and `404` when
the template does not exist.

Send the same canvas JSON structure to create a PowerPoint file:

```sh
curl --request POST http://localhost:3001/export \
  --header 'Content-Type: application/json' \
  --data-binary @slide.json \
  --output generated-slide.pptx
```

The `200` response is a PowerPoint OOXML binary with an attachment filename derived from the
presentation title. A single-slide JSON input produces a one-slide deck; a multi-slide input
preserves all normalized slides. For server safety, image elements must contain embedded base64
`data:image/...` sources rather than filesystem paths or remote URLs.

Insert generated slides into an uploaded target deck with bounded multipart fields:

```sh
curl --request POST http://localhost:3001/export/insert \
  --form 'presentation=<slide.json' \
  --form 'insertAfterSlide=1' \
  --form 'target=@target.pptx;type=application/vnd.openxmlformats-officedocument.presentationml.presentation' \
  --output target-with-slide.pptx
```

Errors use this shape:

```json
{
  "error": {
    "code": "invalid_powerpoint",
    "message": "The uploaded file is not a supported PowerPoint OOXML presentation.",
    "requestId": "..."
  }
}
```

SQLite uses strict, versioned schema migrations. `templates` stores `template_id TEXT PRIMARY KEY` and a
JSON-validated `template_json TEXT`. `template_assets` stores each image as an `asset_data BLOB`
under an `asset_id TEXT PRIMARY KEY`, with `template_id` as a foreign key back to `templates`.
`template_metadata` owns picker metadata and built-in checksums; `template_previews` owns PNG bytes
and dimensions. Template, metadata, asset, and preview inserts are committed in one transaction.
File-backed databases use SQLite WAL
mode. Existing templates that still contain embedded base64 images or nonpositive canvas
dimensions are migrated transactionally when they are first retrieved.
