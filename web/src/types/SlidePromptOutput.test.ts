import { describe, expect, it } from 'vitest'

import {
  GENERATED_SLIDE_PROMPT_OUTPUT_FORMAT,
  SLIDE_PROMPT_OUTPUT_FORMAT,
} from './SlidePromptOutput'

describe('slide prompt output schemas', () => {
  it('forbids connector lines in the Create-flow schema', () => {
    const schema = JSON.stringify(GENERATED_SLIDE_PROMPT_OUTPUT_FORMAT)

    expect(schema).not.toContain('"line"')
    expect(schema).not.toContain('"x1"')
  })

  it('preserves current template connector properties in the template-edit schema', () => {
    const schema = JSON.stringify(SLIDE_PROMPT_OUTPUT_FORMAT)

    expect(schema).toContain('"line"')
    expect(schema).toContain('"endArrow"')
    expect(schema).toContain('"rotate"')
  })
})
