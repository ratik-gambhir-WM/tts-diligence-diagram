# PowerPoint JSON Export

This folder is a copied, portable export module. The original project logic in `src/` and `scripts/` was not moved or deleted.

## Main Entry Points

```ts
import {
  generatePowerPointFromJson,
  generatePowerPointFromPresentation,
} from './export/index.ts'
import compactJson from './src/json/file.compact.json' with { type: 'json' }

await generatePowerPointFromJson(compactJson, {
  outputPath: './out/product-architecture.pptx',
})

await generatePowerPointFromPresentation(normalizedPresentation, {
  outputPath: './out/product-architecture-copy.pptx',
})
```

`generatePowerPointFromJson(json, options)` accepts either a parsed JSON object or a JSON string. It normalizes the JSON into a `NormalizedPresentation`, builds a native PowerPoint deck, writes the `.pptx`, and returns the output path, normalized presentation, and any warnings.

`generatePowerPointFromPresentation(presentation, options)` accepts an existing `NormalizedPresentation`, builds a native PowerPoint deck, writes the `.pptx`, and returns the output path and presentation.

## Included Copies

- `pptx.ts`: native JSON normalizer and PowerPoint generation logic
- `PowerpointSimulator.ts`: extracted PowerPoint slide payload normalizer
- `index.ts`: facade with JSON and `NormalizedPresentation` generation entry points
- `generate-pptx-from-json.ts`: copied CLI helper
- `condense-slide-json.ts`: copied compact JSON converter

The only external runtime dependency is `pptxgenjs`.
