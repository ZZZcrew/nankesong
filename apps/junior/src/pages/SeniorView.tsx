import { useEffect, useState } from 'react'

type ImageDiaryItem = {
  kind: 'image'
  id: string
  url: string
  caption: string
}

type SocialDiaryItem = {
  kind: 'social'
  id: string
  author: string
  time: string
  text: string
}

type DiaryItem = ImageDiaryItem | SocialDiaryItem

type Diary = {
  date: string
  title: string
  publishedAt: number
  items: DiaryItem[]
}

const STORAGE_KEY = 'nks-diary'
const AUTO_INTERVAL_MS = 5000

function loadDiary(): Diary | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Diary
    if (!parsed || !Array.isArray(parsed.items) || parsed.items.length === 0) return null
    // 向后兼容:旧格式的 item 没有 kind 字段,按 image 处理
    parsed.items = parsed.items.map((it) =>
      it.kind ? it : ({ ...(it as object), kind: 'image' } as DiaryItem),
    )
    return parsed
  } catch {
    return null
  }
}

export default function SeniorView() {
  const [diary, setDiary] = useState<Diary | null>(() => loadDiary())
  const [sceneIdx, setSceneIdx] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      setDiary(loadDiary())
      setSceneIdx(0)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const total = diary?.items.length ?? 0
  const safeIdx = total > 0 ? Math.min(sceneIdx, total - 1) : 0

  useEffect(() => {
    if (paused || total === 0) return
    const t = setTimeout(() => {
      setSceneIdx((i) => (i + 1) % total)
    }, AUTO_INTERVAL_MS)
    return () => clearTimeout(t)
  }, [safeIdx, paused, total])

  const scene = diary?.items[safeIdx]

  return (
    <div className="h-[100dvh] overflow-hidden bg-stone-900 p-3 md:p-5">
      <div
        className="mx-auto flex h-full max-w-[1400px] flex-col rounded-2xl p-3 sm:p-4"
        style={{
          background:
            'linear-gradient(135deg, #8b5a2b 0%, #a06b35 25%, #6b3e1d 55%, #8b5a2b 100%)',
          boxShadow:
            'inset 0 0 0 1px rgba(255,215,165,0.25), inset 0 2px 6px rgba(255,215,165,0.3), inset 0 -2px 6px rgba(0,0,0,0.3), 0 20px 50px rgba(0,0,0,0.55)',
        }}
      >
        <div
          className="flex flex-1 flex-col rounded-xl p-[3px]"
          style={{ background: 'linear-gradient(135deg, #d4a056, #7a5220, #d4a056)' }}
        >
          <div className="flex flex-1 flex-col overflow-hidden rounded-lg bg-[#fbf8f2]">
            {diary === null ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <circle cx="9" cy="11" r="2" />
                    <path d="m21 17-5-5-4 4-3-3-6 6" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold tracking-tight text-stone-700">
                  等待小辈发来今日日记…
                </h2>
                <p className="mt-2 max-w-[32ch] text-sm leading-relaxed text-stone-500">
                  他还在整理今天的照片，完成后会自动出现在这里。
                </p>
              </div>
            ) : (
              <>
                <header className="flex-none px-6 pb-2 pt-4 text-center sm:px-8">
                  <div className="text-xs text-stone-500">{diary.date}</div>
                  <h1 className="mt-0.5 text-lg font-bold text-stone-900 md:text-xl">
                    {diary.title}
                  </h1>
                </header>

                <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-2 sm:px-8">
                  <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                    <div className="relative aspect-[3/2] h-full max-w-full overflow-hidden rounded-xl bg-stone-200 shadow-lg shadow-stone-900/20">
                      {diary.items.map((s, i) => (
                        <div
                          key={s.id}
                          className={`absolute inset-0 transition-opacity duration-700 ${
                            i === safeIdx ? 'opacity-100' : 'opacity-0'
                          }`}
                        >
                          {s.kind === 'image' ? (
                            <img
                              src={s.url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#f5efe3] via-[#faf6ec] to-[#efe6d2] px-10 py-8 text-center">
                              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-stone-600 shadow-sm">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                  <circle cx="12" cy="12" r="10" />
                                  <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                                  <path d="M9 9h.01M15 9h.01" />
                                </svg>
                                来自朋友圈
                              </div>
                              <p className="max-w-[22ch] text-xl font-medium leading-relaxed tracking-tight text-stone-800 md:text-2xl">
                                “{s.text}”
                              </p>
                              <div className="mt-4 text-sm text-stone-500">
                                — {s.author} · {s.time}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-2">
                        {diary.items.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setSceneIdx(i)}
                            aria-label={`第 ${i + 1} 条`}
                            className={`h-2 rounded-full transition-all ${
                              i === safeIdx ? 'w-8 bg-white' : 'w-2 bg-white/60'
                            }`}
                          />
                        ))}
                      </div>

                      <div className="absolute right-3 top-3 rounded-full bg-black/40 px-2.5 py-0.5 text-xs text-white backdrop-blur">
                        {safeIdx + 1} / {total}
                      </div>
                    </div>
                  </div>

                  {scene && (
                    <p className="mt-3 flex-none px-4 text-center text-lg leading-relaxed text-stone-800 md:text-xl">
                      {scene.kind === 'image'
                        ? scene.caption
                        : `${scene.author}发在朋友圈里`}
                    </p>
                  )}
                </main>

                <div className="flex-none border-t border-stone-200/70 px-6 py-3 sm:px-8">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="mb-1 flex items-baseline justify-between">
                        <span className="text-xs font-medium text-stone-600">
                          {paused ? '已暂停' : '正在轮播'} · 第 {safeIdx + 1} / {total} 条
                        </span>
                        <span className="text-[11px] text-stone-400">每 5 秒切换</span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-stone-200">
                        <div
                          className="h-full rounded-full bg-amber-500 transition-all"
                          style={{ width: `${((safeIdx + 0.5) / total) * 100}%` }}
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => setPaused((p) => !p)}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-700 transition hover:bg-stone-50 active:translate-y-px"
                      aria-label={paused ? '继续' : '暂停'}
                    >
                      {paused ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <rect x="6" y="5" width="4" height="14" rx="1" />
                          <rect x="14" y="5" width="4" height="14" rx="1" />
                        </svg>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-center">
                    <button className="pulse-ring relative flex h-14 w-[min(380px,90%)] items-center justify-center gap-3 rounded-full bg-red-600 text-white shadow-lg shadow-red-600/30 transition active:scale-[0.98] active:bg-red-700">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="9" y="3" width="6" height="12" rx="3" />
                          <path d="M5 11a7 7 0 0 0 14 0" />
                          <path d="M12 18v3" />
                        </svg>
                      </span>
                      <div className="text-left leading-tight">
                        <div className="text-base font-bold tracking-tight">按住说话</div>
                        <div className="text-[11px] opacity-90">问问题 · 或留言给小明</div>
                      </div>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
