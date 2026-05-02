import { useState } from 'react'
import type { FeedItem } from './images'
import { generateSummary, type GenerateSummaryResult } from '../api/agent'

type Props = {
  kept: FeedItem[]
  onReset: () => void
  onProceed: (kept: FeedItem[], summary: GenerateSummaryResult) => void
}

function todayStr(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export default function Results({ kept, onReset, onProceed }: Props) {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleProceed = async () => {
    setGenerating(true)
    setError(null)
    try {
      const summary = await generateSummary({
        date: todayStr(),
        user_id: 'user_junior',
      })
      onProceed(kept, summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setGenerating(false)
    }
  }

  return (
    <div className="results">
      <h2>
        保留 <span className="tabular-nums">{kept.length}</span> 条
      </h2>

      {kept.length === 0 ? (
        <div className="empty">没有保留任何内容</div>
      ) : (
        <div className="grid">
          {kept.map((k) =>
            k.kind === 'image' ? (
              <img key={k.id} src={k.url} alt={k.name} />
            ) : (
              <div key={k.id} className="thumb-social">
                <div className="thumb-social-src">朋友圈</div>
                <div className="thumb-social-text">{k.text}</div>
              </div>
            ),
          )}
        </div>
      )}

      {error && (
        <div
          style={{
            margin: '12px 0',
            padding: '10px 12px',
            background: '#fdf2f2',
            border: '1px solid #f5c2c7',
            borderRadius: 8,
            color: '#b02a37',
            fontSize: 13,
          }}
        >
          AI 生成失败：{error}
        </div>
      )}

      <button className="submit secondary" onClick={onReset} disabled={generating}>
        重新筛选
      </button>
      <button
        className="submit primary"
        onClick={handleProceed}
        disabled={kept.length === 0 || generating}
      >
        {generating ? 'AI 正在写今天的小作文…' : '进入下一步：预览发送 →'}
      </button>
    </div>
  )
}
