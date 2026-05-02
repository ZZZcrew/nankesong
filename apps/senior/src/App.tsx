import { useEffect, useState } from 'react'

type Scene = {
  id: string
  src: string
  caption: string
}

const DIARY = {
  date: '2026 年 5 月 2 日 · 星期六',
  title: '小明在南山散步的一天',
  scenes: [
    {
      id: 's1',
      src: 'https://picsum.photos/seed/nks-walk/1200/800',
      caption: '下午五点多，小明和同事走到南山脚下散步。',
    },
    {
      id: 's2',
      src: 'https://picsum.photos/seed/nks-view/1200/800',
      caption: '在观景台看着城里的灯一盏一盏亮起来。',
    },
    {
      id: 's3',
      src: 'https://picsum.photos/seed/nks-hotpot/1200/800',
      caption: '晚上在山下的老店，和朋友吃了一顿火锅。',
    },
    {
      id: 's4',
      src: 'https://picsum.photos/seed/nks-orange/1200/800',
      caption: '回家路上买了一袋橘子，明天要带去办公室。',
    },
  ] as Scene[],
}

const AUTO_INTERVAL_MS = 5000

export default function App() {
  const [sceneIdx, setSceneIdx] = useState(0)
  const [paused, setPaused] = useState(false)

  const total = DIARY.scenes.length
  const scene = DIARY.scenes[sceneIdx]

  useEffect(() => {
    if (paused) return
    const t = setTimeout(() => {
      setSceneIdx((i) => (i + 1) % total)
    }, AUTO_INTERVAL_MS)
    return () => clearTimeout(t)
  }, [sceneIdx, paused, total])

  return (
    <div className="h-screen overflow-hidden bg-stone-900 p-3 md:p-5">
      {/* 木质相框 */}
      <div
        className="mx-auto flex h-full max-w-[1400px] flex-col rounded-2xl p-3 sm:p-4"
        style={{
          background:
            'linear-gradient(135deg, #8b5a2b 0%, #a06b35 25%, #6b3e1d 55%, #8b5a2b 100%)',
          boxShadow:
            'inset 0 0 0 1px rgba(255,215,165,0.25), inset 0 2px 6px rgba(255,215,165,0.3), inset 0 -2px 6px rgba(0,0,0,0.3), 0 20px 50px rgba(0,0,0,0.55)',
        }}
      >
        {/* 内圈金边 */}
        <div
          className="flex flex-1 flex-col rounded-xl p-[3px]"
          style={{ background: 'linear-gradient(135deg, #d4a056, #7a5220, #d4a056)' }}
        >
          {/* 画芯 */}
          <div className="flex flex-1 flex-col overflow-hidden rounded-lg bg-[#fbf8f2]">
            {/* 顶部：日期 + 标题 */}
            <header className="flex-none px-6 pb-2 pt-4 text-center sm:px-8">
              <div className="text-xs text-stone-500">{DIARY.date}</div>
              <h1 className="mt-0.5 text-lg font-bold text-stone-900 md:text-xl">
                {DIARY.title}
              </h1>
            </header>

            {/* 中央：图片 + 字幕，自适应填满 */}
            <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-2 sm:px-8">
              {/* 图片区：flex-1 按高度缩放 */}
              <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                <div className="relative aspect-[3/2] h-full max-w-full overflow-hidden rounded-xl bg-stone-200 shadow-lg shadow-stone-900/20">
                  {DIARY.scenes.map((s, i) => (
                    <img
                      key={s.id}
                      src={s.src}
                      alt=""
                      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                        i === sceneIdx ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                  ))}

                  <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-2">
                    {DIARY.scenes.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setSceneIdx(i)}
                        aria-label={`第 ${i + 1} 张`}
                        className={`h-2 rounded-full transition-all ${
                          i === sceneIdx ? 'w-8 bg-white' : 'w-2 bg-white/60'
                        }`}
                      />
                    ))}
                  </div>

                  <div className="absolute right-3 top-3 rounded-full bg-black/40 px-2.5 py-0.5 text-xs text-white backdrop-blur">
                    {sceneIdx + 1} / {total}
                  </div>
                </div>
              </div>

              {/* 字幕 */}
              <p className="mt-3 flex-none px-4 text-center text-lg leading-relaxed text-stone-800 md:text-xl">
                {scene.caption}
              </p>
            </main>

            {/* 底部：进度条 + 暂停 + 按住说话 */}
            <div className="flex-none border-t border-stone-200/70 px-6 py-3 sm:px-8">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex-1">
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="text-xs font-medium text-stone-600">
                      {paused ? '已暂停' : '正在轮播'} · 第 {sceneIdx + 1} / {total} 张
                    </span>
                    <span className="text-[11px] text-stone-400">每 5 秒切换</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-stone-200">
                    <div
                      className="h-full rounded-full bg-amber-500 transition-all"
                      style={{ width: `${((sceneIdx + 0.5) / total) * 100}%` }}
                    />
                  </div>
                </div>
                <button
                  onClick={() => setPaused((p) => !p)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-300 bg-white text-base text-stone-700 hover:bg-stone-50"
                  aria-label={paused ? '继续' : '暂停'}
                >
                  {paused ? '▶' : '⏸'}
                </button>
              </div>

              <div className="flex items-center justify-center">
                <button className="pulse-ring relative flex h-14 w-[min(380px,90%)] items-center justify-center gap-3 rounded-full bg-red-600 text-white shadow-lg shadow-red-600/30 transition active:scale-[0.98] active:bg-red-700">
                  <span className="text-2xl">🎙️</span>
                  <div className="text-left leading-tight">
                    <div className="text-base font-bold">按住说话</div>
                    <div className="text-[11px] opacity-90">问问题 · 或留言给小明</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
