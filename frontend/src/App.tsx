import { useEffect, useMemo, useState } from 'react'
import Deck from './Deck'
import Results from './Results'
import { loadImages, type ImageItem } from './images'

type Phase = 'swiping' | 'done'

export default function App() {
  const initial = useMemo(() => loadImages(), [])
  const [queue, setQueue] = useState<ImageItem[]>(initial)
  const [kept, setKept] = useState<ImageItem[]>([])

  useEffect(() => {
    if (initial.length === 0) return
  }, [initial])

  const phase: Phase = queue.length === 0 ? 'done' : 'swiping'

  const handleKeep = (item: ImageItem) => {
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
      <div className="app">
        <div className="topbar">
          <span>图片筛选</span>
        </div>
        <div className="empty">
          没有找到图片。<br />
          请把图片放到 <code>src/assets/images/</code> 目录，然后刷新。
        </div>
      </div>
    )
  }

  return (
    <div className="app">
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
            左右滑动 = 保留并下一张 · 上滑 = 删除
          </div>
          <div className="actions">
            <button className="trash" onClick={handleTrash} aria-label="删除">✕</button>
            <button className="keep" onClick={() => handleKeep(queue[0])} aria-label="保留">✓</button>
          </div>
        </>
      ) : (
        <Results kept={kept} onReset={reset} />
      )}
    </div>
  )
}
