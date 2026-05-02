import type { FeedItem } from './images'

type Props = {
  kept: FeedItem[]
  onReset: () => void
  onProceed: (kept: FeedItem[]) => void
}

export default function Results({ kept, onReset, onProceed }: Props) {
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

      <button className="submit secondary" onClick={onReset}>
        重新筛选
      </button>
      <button
        className="submit primary"
        onClick={() => onProceed(kept)}
        disabled={kept.length === 0}
      >
        进入下一步：预览发送 →
      </button>
    </div>
  )
}
