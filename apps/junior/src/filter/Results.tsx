import type { ImageItem } from './images'

type Props = {
  kept: ImageItem[]
  onReset: () => void
  onProceed: (kept: ImageItem[]) => void
}

export default function Results({ kept, onReset, onProceed }: Props) {
  return (
    <div className="results">
      <h2>
        保留 <span className="tabular-nums">{kept.length}</span> 张
      </h2>

      {kept.length === 0 ? (
        <div className="empty">没有保留任何照片</div>
      ) : (
        <div className="grid">
          {kept.map((k) => (
            <img key={k.id} src={k.url} alt={k.name} />
          ))}
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
