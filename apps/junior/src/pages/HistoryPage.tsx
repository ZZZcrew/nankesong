import { useEffect, useState } from 'react'
import { fetchDiaryHistory, fetchDiary, type Diary, type DiaryPreview } from '../api/diary'
import { JUNIOR_USER_ID } from '../api/client'

type Props = {
  onBack: () => void
}

export default function HistoryPage({ onBack }: Props) {
  const [previews, setPreviews] = useState<DiaryPreview[]>([])
  const [loadingList, setLoadingList] = useState(true)

  const [activeId, setActiveId] = useState<string | null>(null)
  const [active, setActive] = useState<Diary | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchDiaryHistory({ user_id: JUNIOR_USER_ID, limit: 20 })
      .then((res) => {
        if (cancelled) return
        setPreviews(res.diaries)
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!activeId) {
      setActive(null)
      return
    }
    let cancelled = false
    setLoadingDetail(true)
    fetchDiary(activeId)
      .then((d) => {
        if (!cancelled) setActive(d)
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeId])

  const activePreview = activeId ? previews.find((p) => p.diary_id === activeId) : null

  if (activeId) {
    return (
      <div className="flex flex-1 flex-col bg-[#fbf8f2]">
        <header className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 pb-3 pt-6">
          <button
            onClick={() => setActiveId(null)}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-stone-300 bg-white text-stone-700 transition hover:bg-stone-50 active:translate-y-px"
            aria-label="返回列表"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-xs tracking-wide text-stone-500">
              {activePreview?.date_label ?? active?.date ?? ''}
            </div>
            <h1 className="truncate font-serif text-xl font-semibold text-stone-900 md:text-2xl">
              {active?.title ?? activePreview?.title ?? '加载中…'}
            </h1>
          </div>
        </header>

        <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 pb-10">
          {loadingDetail || !active ? (
            <div className="py-20 text-center text-sm text-stone-400">加载中…</div>
          ) : (
            <>
              <section className="overflow-hidden rounded-2xl border border-amber-200/70 bg-white shadow-sm">
                <div className="flex items-stretch">
                  <div className="w-1.5 flex-none bg-amber-600" aria-hidden="true" />
                  <div className="flex-1 px-5 py-5">
                    <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.15em] text-amber-700">
                      那天写给妈妈的信
                    </div>
                    <p className="whitespace-pre-line text-[15px] leading-relaxed text-stone-800">
                      {active.narration}
                    </p>
                  </div>
                </div>
              </section>

              <div className="pt-1 text-xs font-medium tracking-wide text-stone-500">
                当天发出的内容（{active.items.length}）
              </div>

              {active.items.map((it, i) =>
                it.type === 'image' ? (
                  <article
                    key={it.item_id}
                    className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
                  >
                    <div className="relative aspect-[3/2] bg-[#f6f1e5]">
                      <img
                        src={it.content}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <div className="absolute left-3 top-3 rounded-full bg-black/40 px-2.5 py-0.5 text-xs text-white backdrop-blur">
                        {i + 1} / {active.items.length}
                      </div>
                    </div>
                  </article>
                ) : (
                  <article
                    key={it.item_id}
                    className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
                  >
                    <div className="flex items-center gap-2 border-b border-stone-100 bg-[#fdf7e8] px-4 py-2.5">
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                        朋友圈
                      </span>
                      <span className="text-xs font-medium text-stone-700">{it.author}</span>
                      <span className="text-[11px] text-stone-400">· {it.time}</span>
                      <span className="ml-auto text-[11px] text-stone-400">
                        {i + 1} / {active.items.length}
                      </span>
                    </div>
                    <p className="px-4 py-4 text-[15px] leading-relaxed text-stone-800">{it.text}</p>
                  </article>
                ),
              )}
            </>
          )}
        </main>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col bg-[#fbf8f2]">
      <header className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 pb-3 pt-6">
        <button
          onClick={onBack}
          className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-stone-300 bg-white text-stone-700 transition hover:bg-stone-50 active:translate-y-px"
          aria-label="返回首页"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-stone-900">
            过去的信
          </h1>
          <p className="mt-0.5 text-sm text-stone-500">妈妈在相框里读过的，每一封都在这里</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-3 px-4 pb-10">
        {loadingList ? (
          <div className="py-20 text-center text-sm text-stone-400">加载中…</div>
        ) : previews.length === 0 ? (
          <div className="py-20 text-center text-sm text-stone-400">还没有历史日记</div>
        ) : (
          previews.map((d) => (
            <button
              key={d.diary_id}
              onClick={() => setActiveId(d.diary_id)}
              className="group flex w-full items-stretch gap-4 overflow-hidden rounded-2xl border border-stone-200 bg-white p-3 text-left shadow-sm transition hover:border-amber-200 hover:shadow-md active:translate-y-px"
            >
              <div className="aspect-square h-20 w-20 flex-none overflow-hidden rounded-xl bg-[#f6f1e5]">
                {d.thumbnail_url ? (
                  <img src={d.thumbnail_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-stone-300">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <circle cx="9" cy="11" r="2" />
                      <path d="m21 17-5-5-4 4-3-3-6 6" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <div className="text-[11px] font-medium tracking-wide text-amber-700">
                  {d.date_label}
                </div>
                <div className="mt-0.5 truncate text-base font-semibold tracking-tight text-stone-900">
                  {d.title}
                </div>
                <div className="mt-1 line-clamp-2 text-sm leading-relaxed text-stone-500">
                  {d.narration_preview}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-stone-400">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <circle cx="9" cy="11" r="2" />
                    <path d="m21 17-5-5-4 4-3-3-6 6" />
                  </svg>
                  共 {d.item_count} 条
                </div>
              </div>
              <div className="flex flex-none items-center pr-2 text-stone-300 transition group-hover:translate-x-1 group-hover:text-amber-700">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </div>
            </button>
          ))
        )}
      </main>
    </div>
  )
}
