# PowerPoint import and export APIs

This Node-only server reuses `src/lib/import/PowerpointImporter.ts`; it does not change or enter the
React/Vite module graph. Uploaded `.pptx` files are OOXML ZIP packages. Their compact canvas JSON is
stored in SQLite. Imported image bytes are stored separately from the JSON as BLOB assets.

The server uses Node's built-in SQLite module and therefore requires Node.js 22.5 or newer.

## Run

```sh
npm run server:dev
```

Configuration is read once at startup:

- `PORT` defaults to `3001`.
- `SQLITE_DB_PATH` defaults to `data/templates.sqlite`.
- `MAX_PPTX_UPLOAD_BYTES` defaults to `26214400` (25 MiB).
- `MAX_EXPORT_JSON_BYTES` defaults to `52428800` (50 MiB).

## API

Import a deck by sending its binary `.pptx` body:

```sh
curl --request POST http://localhost:3001/import \
  --header 'Content-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation' \
  --data-binary @deck.pptx
```

The `201` response body is canvas JSON with a single top-level `presentation` property. It
is the same JSON contract accepted by `POST /export`. Image `src` values are complete
`data:image/...;base64,...` URIs. The generated ID is returned in both the `Location` and
`X-Template-Id` headers, and `X-PowerPoint-Warning-Count` reports non-fatal import warnings.

`GET /import/:templateId` returns that same canvas JSON body. It joins the stored template to all
of its assets and hydrates each image `src` from its BLOB. Image bytes also remain directly
available from `/import/:templateId/assets/:assetId`.

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

SQLite uses two strict tables. `templates` stores `template_id TEXT PRIMARY KEY` and a
JSON-validated `template_json TEXT`. `template_assets` stores each image as an `asset_data BLOB`
under an `asset_id TEXT PRIMARY KEY`, with `template_id` as a foreign key back to `templates`.
Template and asset inserts are committed in one transaction. Existing templates that still contain
embedded base64 images are migrated transactionally when they are first retrieved.
