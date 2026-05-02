import type { ImageItem } from './images'

type Props = {
  kept: ImageItem[]
  onReset: () => void
  onProceed: () => void
}

export default function Results({ kept, onReset, onProceed }: Props) {
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

      <button
        className="submit"
        onClick={onProceed}
        disabled={kept.length === 0}
      >
        进入下一步：审核日记 →
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
