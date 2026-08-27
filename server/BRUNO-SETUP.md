# Bruno setup

## 1. Start the microservice

From the project directory:

```bash
OPENAI_API_KEY="your-openai-key" npm run api
```

The endpoint is available at:

```text
http://localhost:8787/api/pptxgenjs
```

If port `8787` is busy:

```bash
PPTXGENJS_PORT=8788 OPENAI_API_KEY="your-openai-key" npm run api
```

## 2. Create the Bruno request

1. Create a new HTTP request.
2. Set the method to `POST`.
3. Set the URL to `http://localhost:8787/api/pptxgenjs`.
4. Open **Body → Multipart Form**.
5. Add a file field named `files` and choose a supported file.
6. Add a text field named `mode` with value `create`.
7. Optionally add a text field named `prompt`.
8. Send the request.

Supported files include PDF, DOCX, PPT/PPTX, PNG/JPG, Markdown, TXT, and RTF. Add additional `files` rows for multiple uploads.

Do not manually set the `Content-Type` header; Bruno generates the multipart boundary.

## 3. Test an existing template

Use these text fields instead:

```text
mode       = update
templateId = microservice-architecture
```

## 4. Check the response

A successful response includes:

```json
{
  "fileName": "generated-presentation.pptx",
  "pptxJson": "{\"_version\":\"4.0.1\",...}",
  "presentation": {},
  "issues": []
}
```

`pptxJson` is the serialized PPTXGenJS object.

If Markdown fails, restart the microservice and upload it as a **File** field, not a text field.