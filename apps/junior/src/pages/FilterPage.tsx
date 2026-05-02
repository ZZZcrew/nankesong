import { useEffect, useState } from 'react'
import Deck from '../filter/Deck'
import Results from '../filter/Results'
import type { FeedItem } from '../filter/images'
import { fetchRawData, deleteRawItems, type RawItem } from '../api/data'
import type { GenerateSummaryResult } from '../api/agent'

type Phase = 'loading' | 'swiping' | 'done' | 'empty' | 'error'

type Props = {
  onProceed: (kept: FeedItem[], summary: GenerateSummaryResult) => void
}

// 把后端的 RawItem 适配成现有 UI 用的 FeedItem(image / social)
function rawToFeed(raw: RawItem[]): FeedItem[] {
  return raw.flatMap<FeedItem>((it) => {
    if (it.type === 'image') {
      return [{ kind: 'image', id: it.item_id, url: it.content ?? '', name: it.item_id }]
    }
    if (it.type === 'text') {
      // mock 里 description 用 "author | time" 编码;真实后端可能给 null,做兜底
      const desc = it.description ?? ''
      const [author = '小明', time = ''] = desc.split('|').map((s) => s.trim())
      return [{ kind: 'social', id: it.item_id, author, time, text: it.content ?? '' }]
    }
    return [] // video 暂不展示
  })
}

function todayStr(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export default function FilterPage({ onProceed }: Props) {
  const [initial, setInitial] = useState<FeedItem[]>([])
  const [queue, setQueue] = useState<FeedItem[]>([])
  const [kept, setKept] = useState<FeedItem[]>([])
  const [phase, setPhase] = useState<Phase>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    document.body.classList.add('filter-active')
    return () => document.body.classList.remove('filter-active')
  }, [])

  useEffect(() => {
    let cancelled = false
    setPhase('loading')
    setErrorMsg(null)
    fetchRawData({ date: todayStr(), user_id: 'user_junior' })
      .then((res) => {
        if (cancelled) return
        const feed = rawToFeed(res.items)
        setInitial(feed)
        setQueue(feed)
        setKept([])
        setPhase(feed.length === 0 ? 'empty' : 'swiping')
      })
      .catch((err) => {
        if (cancelled) return
        setErrorMsg(err instanceof Error ? err.message : String(err))
        setPhase('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 滑动完成时切到 done
  useEffect(() => {
    if (phase === 'swiping' && queue.length === 0) setPhase('done')
  }, [phase, queue.length])

  const handleKeep = (item: FeedItem) => {
    setKept((prev) => [...prev, item])
    setQueue((prev) => prev.slice(1))
  }

  const handleTrash = (item?: FeedItem) => {
    const removed = item ?? queue[0]
    setQueue((prev) => prev.slice(1))
    if (removed) {
      // 后台 fire-and-forget,不阻塞滑动手感;失败仅打日志,不回滚 UI
      deleteRawItems({ item_ids: [removed.id], user_id: 'user_junior' }).catch((err) => {
        console.error('[删除] 失败 item_id=%s:', removed.id, err)
      })
    }
  }

  const reset = () => {
    setQueue(initial)
    setKept([])
    setPhase(initial.length === 0 ? 'empty' : 'swiping')
  }

  if (phase === 'loading') {
    return (
      <div className="filter-app">
        <div className="topbar">
          <span>素材清理</span>
        </div>
        <div className="empty">正在拉取今日素材…</div>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="filter-app">
        <div className="topbar">
          <span>素材清理</span>
        </div>
        <div className="empty">
          拉取失败：{errorMsg}
          <br />
          <button className="reset" onClick={reset} style={{ marginTop: 12 }}>
            重试
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'empty') {
    return (
      <div className="filter-app">
        <div className="topbar">
          <span>素材清理</span>
        </div>
        <div className="empty">
          今天还没有可筛选的内容。
          <br />
          请把图片放到 <code>src/assets/images/</code>，或在 <code>src/filter/images.ts</code> 里加朋友圈
          mock。
        </div>
      </div>
    )
  }

  return (
    <div className="filter-app">
      <div className="topbar">
        <span className="count">
          {phase === 'swiping'
            ? `剩余 ${queue.length} / ${initial.length}`
            : `已保留 ${kept.length} / ${initial.length}`}
        </span>
        <button className="reset" onClick={reset}>重置</button>
      </div>

      {phase === 'swiping' ? (
        <>
          <Deck queue={queue} onKeep={handleKeep} onTrash={handleTrash} />
          <div className="hint">
            左右滑 = 保留并下一条 · 上滑 = 删除<br />
            混合来自相机的照片与朋友圈
          </div>
          <div className="actions">
            <button className="trash" onClick={() => handleTrash()} aria-label="删除">✕</button>
            <button className="keep" onClick={() => handleKeep(queue[0])} aria-label="保留">✓</button>
          </div>
        </>
      ) : (
        <Results kept={kept} onReset={reset} onProceed={onProceed} />
      )}
    </div>
  )
}
