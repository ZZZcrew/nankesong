import { useEffect, useMemo, useState } from 'react'
import Deck from '../filter/Deck'
import Results from '../filter/Results'
import { loadFeed, type FeedItem } from '../filter/images'

type Phase = 'swiping' | 'done'

type Props = {
  onProceed: (kept: FeedItem[]) => void
}

export default function FilterPage({ onProceed }: Props) {
  const initial = useMemo(() => loadFeed(), [])
  const [queue, setQueue] = useState<FeedItem[]>(initial)
  const [kept, setKept] = useState<FeedItem[]>([])

  useEffect(() => {
    document.body.classList.add('filter-active')
    return () => document.body.classList.remove('filter-active')
  }, [])

  const phase: Phase = queue.length === 0 ? 'done' : 'swiping'

  const handleKeep = (item: FeedItem) => {
    setKept((prev) => [...prev, item])
    setQueue((prev) => prev.slice(1))
  }

  const handleTrash = () => {
    setQueue((prev) => prev.slice(1))
  }

  const reset = () => {
    setQueue(initial)
    setKept([])
  }

  if (initial.length === 0) {
    return (
      <div className="filter-app">
        <div className="topbar">
          <span>素材清理</span>
        </div>
        <div className="empty">
          没有找到可筛选的内容。<br />
          请把图片放到 <code>src/assets/images/</code> 目录，或在 <code>src/filter/images.ts</code> 里加朋友圈 mock，然后刷新。
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
            <button className="trash" onClick={handleTrash} aria-label="删除">✕</button>
            <button className="keep" onClick={() => handleKeep(queue[0])} aria-label="保留">✓</button>
          </div>
        </>
      ) : (
        <Results kept={kept} onReset={reset} onProceed={onProceed} />
      )}
    </div>
  )
}
