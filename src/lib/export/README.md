# PowerPoint JSON Export

This folder is a copied, portable export module. The original project logic in `src/` and `scripts/` was not moved or deleted.

## Main Entry Points

```ts
import {
  generatePowerPointFromJson,
} from './export/exporter.ts'
import compactJson from './src/json/file.compact.json' with { type: 'json' }

await generatePowerPointFromJson(compactJson, {
  outputPath: './out/product-architecture.pptx',
})
```

`generatePowerPointFromJson(json, options)` accepts either a parsed JSON object or a JSON string. It normalizes the JSON into a `NormalizedPresentation`, builds a native PowerPoint deck, writes the `.pptx`, and returns the output path, normalized presentation, and any warnings.

## Included Copies

- `PowerpointGenerator.ts`: native JSON normalizer and PowerPoint generation logic
- `exporter.ts`: facade with the JSON generation entry point
- `generate-pptx-from-json.ts`: copied CLI helper
- `condense-slide-json.ts`: copied compact JSON converter

The only external runtime dependency is `pptxgenjs`.
