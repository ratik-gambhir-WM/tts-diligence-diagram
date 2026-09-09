type MarkdownRendererProps = {
  markdown: string
}

type MarkdownBlock =
  | { text: string; type: 'h2' }
  | { text: string; type: 'p' }
  | { items: string[]; type: 'ol' }
  | { items: string[]; type: 'ul' }

export function MarkdownRenderer({ markdown }: MarkdownRendererProps) {
  const blocks = parseMarkdownBlocks(markdown)

  return (
    <div className="markdown-renderer">
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'h2':
            return (
              <h3 key={index} className="markdown-renderer-heading">
                {renderInlineMarkdown(block.text)}
              </h3>
            )
          case 'ol':
            return (
              <ol key={index} className="markdown-renderer-list markdown-renderer-list-ordered">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
                ))}
              </ol>
            )
          case 'ul':
            return (
              <ul key={index} className="markdown-renderer-list markdown-renderer-list-unordered">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
                ))}
              </ul>
            )
          case 'p':
            return <p key={index}>{renderInlineMarkdown(block.text)}</p>
        }
      })}
    </div>
  )
}

function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = []
  let listItems: string[] = []
  let listType: 'ol' | 'ul' | null = null

  function flushList() {
    if (!listType || listItems.length === 0) {
      return
    }

    blocks.push({ items: listItems, type: listType })
    listItems = []
    listType = null
  }

  for (const line of markdown.trim().split('\n')) {
    const trimmedLine = line.trim()

    if (!trimmedLine) {
      flushList()
      continue
    }

    if (trimmedLine.startsWith('## ')) {
      flushList()
      blocks.push({ text: trimmedLine.replace(/^##\s+/, ''), type: 'h2' })
      continue
    }

    const orderedListMatch = trimmedLine.match(/^\d+\.\s+(.*)$/)

    if (orderedListMatch) {
      if (listType !== 'ol') {
        flushList()
        listType = 'ol'
      }

      listItems.push(orderedListMatch[1])
      continue
    }

    if (trimmedLine.startsWith('- ')) {
      if (listType !== 'ul') {
        flushList()
        listType = 'ul'
      }

      listItems.push(trimmedLine.slice(2))
      continue
    }

    flushList()
    blocks.push({ text: trimmedLine, type: 'p' })
  }

  flushList()

  return blocks
}

function renderInlineMarkdown(text: string) {
  const tokenPattern = /(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*)/g

  return text.split(tokenPattern).map((part, index) => {
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)

    if (linkMatch) {
      return (
        <a
          key={index}
          className="markdown-renderer-link"
          href={linkMatch[2]}
          rel="noreferrer"
          target="_blank"
        >
          {linkMatch[1]}
        </a>
      )
    }

    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={index} className="markdown-renderer-code">
          {part.slice(1, -1)}
        </code>
      )
    }

    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="markdown-renderer-strong">
          {part.slice(2, -2)}
        </strong>
      )
    }

    return part
  })
}
