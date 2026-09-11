# Canvas JSON contract

The import and export endpoints exchange a canvas document with one top-level `presentation`
property. The maintained TypeScript definition is
[`PowerpointImportTypes.ts`](../../server/src/lib/import/PowerpointImportTypes.ts); this page is a
consumer-oriented summary rather than a second schema.

## Top-level shape

```json
{
  "presentation": {
    "title": "Architecture",
    "preserveElementOrder": true,
    "showBranding": false,
    "slides": [
      {
        "id": "slide-1",
        "name": "Architecture",
        "width": 1600,
        "height": 900,
        "backgroundColor": "#FFFFFF",
        "elements": []
      }
    ]
  }
}
```

`width`, `height`, and element coordinates use the canvas coordinate system. Element order is
preserved by the server and controls layering when `preserveElementOrder` is true.

## Element types

Every element has a stable `id`. The discriminated `type` values are:

- `text`: text content and optional `runs`, with `x`, `y`, `w`, `h`, fill/stroke, typography, and
  alignment properties.
- `shape`: a geometric shape with `shape`, fill/stroke, optional text and `runs`, and the same
  bounds and typography properties as applicable.
- `line`: a straight or elbow connector with endpoints, stroke, dash, and optional arrowheads.
- `image`: an image with `src`, bounds, fit mode, optional crop, alt text, opacity, rotation, and
  flips.

The server preserves IDs, order, text runs, opacity, transforms, crop metadata, arrows, and
branding flags during import/export normalization. Consumers should ignore fields they do not
need and preserve fields they do not own when round-tripping a document.

## Image sources

Imported or retrieved templates expose image data as embedded URIs such as
`data:image/png;base64,...`. The server may store those bytes separately and hydrate them when
returning a template. The direct binary asset endpoint is:

```text
GET /api/v1/import/:templateId/assets/:assetId
```

For export, image elements must resolve to embedded base64 `data:image/...` URIs. Filesystem paths
and remote URLs are not accepted by the server export API.

## Import and export differences

- Single-slide import requires exactly one source slide.
- Batch import stores each source slide as its own one-slide document.
- Export accepts one or more normalized slides and produces a PowerPoint deck.
- The server repairs non-positive slide or element dimensions during import before persisting the
  document.
- Import warnings are exposed through import response headers and the batch `warnings` array;
  export warnings are exposed through `X-PowerPoint-Warning-Count`.
