# TTS Mermaid

## PPTXGenJS microservice

The project includes a single server endpoint:

```text
POST /api/pptxgenjs
```

Start it with:

```bash
OPENAI_API_KEY=... npm run api
```

The endpoint accepts browser-compatible `multipart/form-data` only. Upload each diligence source as a file field; do not send files as base64 JSON.

In Bruno, choose **Body → Multipart Form**, add one or more file fields named `files`, then add optional text fields:

```text
files       = technical-notes.md   (File)
mode        = create               (Text)
prompt      = Emphasize customer-facing applications and data flows. (Text)
```

For template editing, send `"mode": "update"` and either `templateId` (for example, `microservice-architecture`) or a caller-supplied `templateJson`. The accepted material extensions match the UI: DOCX, PDF, PPT/PPTX, PNG/JPG, Markdown, TXT, and RTF.

The successful response contains `pptxJson`, a JSON string produced from the `PptxGenJS` instance, along with the normalized `presentation`, `fileName`, and any non-fatal `issues`:

```json
{
  "fileName": "generated-architecture.pptx",
  "pptxJson": "{\"_version\":\"4.0.1\",...}",
  "presentation": { "meta": {}, "slides": [] },
  "issues": []
}
```

The server reads `OPENAI_API_KEY` and `OPENAI_MODEL` only from server environment variables. It listens on port `8787` by default; set `PPTXGENJS_PORT` to override it.
