// Converts a Markdown-formatted AI answer into clean, structured HTML for the
// print-to-PDF export path only (on-screen ReactMarkdown rendering is untouched).

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

// Strips remaining Markdown syntax from a single line's text, preserving the visible content.
const cleanInline = (line) => {
  let out = line
  out = out.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links -> visible text
  out = out.replace(/\*\*([^*]+)\*\*/g, '$1') // bold
  out = out.replace(/__([^_]+)__/g, '$1') // bold (underscore)
  out = out.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1') // italic
  out = out.replace(/(?<!_)_([^_\n]+)_(?!_)/g, '$1') // italic (underscore)
  out = out.replace(/`([^`]+)`/g, '$1') // inline code
  out = out.replace(/^#{1,6}\s*/, '') // stray heading marker mid-text
  out = out.replace(/[*_`#]/g, '') // any leftover presentation-only symbols
  return out.trim()
}

/**
 * Parses a raw Markdown answer into blocks (headings, bullet lists, numbered
 * lists, paragraphs) and returns escaped, Markdown-free HTML for print/PDF use.
 */
export function markdownToPdfHtml(rawAnswer) {
  if (!rawAnswer) return ''

  let text = escapeHtml(String(rawAnswer)).replace(/\r\n/g, '\n')

  // Fix list markers glued directly onto the previous word with no line break,
  // e.g. "Core capabilities- **Pre-configured migration objects**".
  text = text.replace(/(\S)-\s*(?=\*\*)/g, '$1\n- ')

  const blocks = []
  let paragraphLines = []
  let currentList = null // { type: 'ul' | 'ol', items: [] }

  const flushParagraph = () => {
    if (paragraphLines.length) {
      blocks.push({ type: 'p', lines: paragraphLines })
      paragraphLines = []
    }
  }
  const flushList = () => {
    if (currentList) {
      blocks.push(currentList)
      currentList = null
    }
  }

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()

    if (!line) {
      flushParagraph()
      flushList()
      continue
    }

    // Bare horizontal rule (---, ***, ___) -> drop, not rendered
    if (/^([-*_])\1{2,}$/.test(line.replace(/\s+/g, ''))) {
      flushParagraph()
      flushList()
      continue
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      flushParagraph()
      flushList()
      blocks.push({ type: 'h', level: headingMatch[1].length, text: cleanInline(headingMatch[2]) })
      continue
    }

    const ulMatch = line.match(/^[-*+]\s+(.*)$/)
    if (ulMatch) {
      flushParagraph()
      if (!currentList || currentList.type !== 'ul') {
        flushList()
        currentList = { type: 'ul', items: [] }
      }
      currentList.items.push(cleanInline(ulMatch[1]))
      continue
    }

    const olMatch = line.match(/^\d+\.\s+(.*)$/)
    if (olMatch) {
      flushParagraph()
      if (!currentList || currentList.type !== 'ol') {
        flushList()
        currentList = { type: 'ol', items: [] }
      }
      currentList.items.push(cleanInline(olMatch[1]))
      continue
    }

    flushList()
    paragraphLines.push(cleanInline(line))
  }
  flushParagraph()
  flushList()

  return blocks
    .map((block) => {
      if (block.type === 'h') return `<div class="pdf-heading">${block.text}</div>`
      if (block.type === 'p') return `<p>${block.lines.join('<br/>')}</p>`
      if (block.type === 'ul') return `<ul>${block.items.map((item) => `<li>${item}</li>`).join('')}</ul>`
      if (block.type === 'ol') return `<ol>${block.items.map((item) => `<li>${item}</li>`).join('')}</ol>`
      return ''
    })
    .join('\n')
}
