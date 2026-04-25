import React from 'react'

function renderInline(text: string): React.ReactNode[] {
  // Handle **bold** markers
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  )
}

export function MarkdownText({ content }: { content: string }) {
  const lines = content.split('\n')
  const result: React.ReactNode[] = []
  let bullets: string[] = []

  const flushBullets = (key: string) => {
    if (bullets.length === 0) return
    result.push(
      <ul key={key} className="list-disc pl-5 space-y-0.5 my-1">
        {bullets.map((b, j) => <li key={j}>{renderInline(b)}</li>)}
      </ul>
    )
    bullets = []
  }

  lines.forEach((line, i) => {
    const bulletMatch = line.match(/^-\s+(.*)/)
    if (bulletMatch) {
      bullets.push(bulletMatch[1])
    } else {
      flushBullets(`b${i}`)
      if (line.trim() === '') {
        if (result.length > 0) result.push(<div key={`sp${i}`} className="h-1" />)
      } else {
        result.push(
          <p key={i} className="leading-relaxed">
            {renderInline(line)}
          </p>
        )
      }
    }
  })
  flushBullets('bend')

  return <div className="space-y-0.5 text-sm">{result}</div>
}
