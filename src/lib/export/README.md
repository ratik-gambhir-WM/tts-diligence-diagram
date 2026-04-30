# PowerPoint JSON Export

This folder is a copied, portable export module. The original project logic in `src/` and `scripts/` was not moved or deleted.

## Main Function

```ts
import { generatePowerPointFromJson } from './export/index.ts'
import compactJson from './src/json/file.compact.json' with { type: 'json' }

await generatePowerPointFromJson(compactJson, {
  outputPath: './out/product-architecture.pptx',
})
```

`generatePowerPointFromJson(json, options)` accepts either a parsed JSON object or a JSON string. It normalizes the JSON, builds a native PowerPoint deck, writes the `.pptx`, and returns the output path, normalized presentation, and any warnings.

## Included Copies

- `pptx.ts`: copied normalizer and PowerPoint generation logic
- `index.ts`: single-function facade for generating a PowerPoint from JSON
- `generate-pptx-from-json.ts`: copied CLI helper
- `condense-slide-json.ts`: copied compact JSON converter

The only external runtime dependency is `pptxgenjs`.
