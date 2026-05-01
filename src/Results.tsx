import { useState } from 'react'
import type { ImageItem } from './images'

type Props = {
  kept: ImageItem[]
  onReset: () => void
}

type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'ok' } | { kind: 'err'; msg: string }

export default function Results({ kept, onReset }: Props) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const submit = async () => {
    setStatus({ kind: 'sending' })
    try {
      const url = import.meta.env.VITE_SUBMIT_URL
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kept: kept.map((k) => ({ id: k.id, name: k.name, url: k.url })),
          count: kept.length,
          submittedAt: new Date().toISOString(),
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setStatus({ kind: 'ok' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setStatus({ kind: 'err', msg })
    }
  }

  return (
    <div className="results">
      <h2>保留 {kept.length} 张</h2>

      {kept.length === 0 ? (
        <div className="empty">没有保留任何照片</div>
      ) : (
        <div className="grid">
          {kept.map((k) => (
            <img key={k.id} src={k.url} alt={k.name} />
          ))}
        </div>
      )}

      <div className="status">
        {status.kind === 'sending' && '提交中…'}
        {status.kind === 'ok' && '已提交 ✓'}
        {status.kind === 'err' && `提交失败：${status.msg}`}
      </div>

      <button
        className="submit"
        onClick={submit}
        disabled={kept.length === 0 || status.kind === 'sending' || status.kind === 'ok'}
      >
        {status.kind === 'ok' ? '已提交' : '提交保留列表'}
      </button>
      <button
        className="submit"
        onClick={onReset}
        style={{ background: '#374151' }}
      >
        重新筛选
      </button>
    </div>
  )
}
