import { useState } from 'react'
import type { GenerateSummaryResult } from '../api/agent'

type Props = {
  summary: GenerateSummaryResult
  onBack: () => void
}

type SendStatus = 'idle' | 'sending' | 'sent'

const DIARY_DATE_LABEL = '2026 年 5 月 2 日 · 星期六'

export default function AuditPage({ summary, onBack }: Props) {
  const [status, setStatus] = useState<SendStatus>('idle')
  const [coverIdx, setCoverIdx] = useState(0)

  const send = async () => {
    setStatus('sending')
    // 这里写 localStorage 是 demo 的中转手段,后续接 §4 publish 接口后会替换
    const diary = {
      date: DIARY_DATE_LABEL,
      title: summary.title,
      publishedAt: Date.now(),
      narration: summary.content,
      summary_id: summary.summary_id,
      suggested_questions: summary.suggested_questions,
      items: summary.cover_image.map((url, i) => ({
        kind: 'image' as const,
        id: `cover-${i}`,
        url,
      })),
    }
    try {
      localStorage.setItem('nks-diary', JSON.stringify(diary))
    } catch {
      // ignore
    }
    setTimeout(() => setStatus('sent'), 400)
  }

  const busy = status !== 'idle'
  const covers = summary.cover_image
  const safeIdx = covers.length > 0 ? Math.min(coverIdx, covers.length - 1) : 0

  return (
    <div className="senior-stage relative flex flex-1 flex-col pb-28">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[40vh] bg-[radial-gradient(circle_at_50%_-10%,_rgba(255,250,238,0.85),_transparent_70%)]" />

      <header className="relative z-10 mx-auto w-full max-w-2xl px-4 pb-4 pt-8 text-center">
        <div className="senior-eyebrow text-[10px] uppercase text-[#9a330a]">
          {DIARY_DATE_LABEL} · 即将寄出
        </div>
        <h1 className="senior-title mt-2 text-2xl leading-tight text-stone-900 [text-wrap:balance] md:text-[28px]">
          {summary.title}
        </h1>
        <p className="mt-2 text-xs text-stone-500">妈妈在相框里会看到下面这封信</p>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-2xl flex-1 space-y-5 px-4">
        {/* 封面图 · 装裱在浅色相框里 */}
        {covers.length > 0 && (
          <section
            className="overflow-hidden rounded-[1.1rem] border border-[#e9d9bf] bg-gradient-to-br from-white to-[#fbf2dd] p-2.5 shadow-[0_18px_36px_-22px_rgba(154,51,10,0.3)]"
          >
            <div className="relative aspect-[3/2] overflow-hidden rounded-[0.6rem] bg-[#f6f1e5] shadow-[inset_0_0_0_1px_rgba(120,95,69,0.12)]">
              {covers.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt=""
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
                    i === safeIdx ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              ))}
              {covers.length > 1 && (
                <>
                  <div className="senior-tabular absolute right-3 top-3 rounded-full bg-[#2b1f15]/55 px-2.5 py-0.5 text-xs text-white backdrop-blur">
                    {safeIdx + 1} / {covers.length}
                  </div>
                  <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-2">
                    {covers.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCoverIdx(i)}
                        aria-label={`第 ${i + 1} 张`}
                        className={`h-2 rounded-full transition-all ${
                          i === safeIdx ? 'w-8 bg-white' : 'w-2 bg-white/60'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {/* 家书正文 · 信笺 */}
        <section className="relative overflow-hidden rounded-[1.1rem] border border-[#e9d9bf] bg-gradient-to-br from-white via-[#fdf7ea] to-[#fbeed5] shadow-[0_18px_36px_-22px_rgba(154,51,10,0.3)]">
          <div className="flex items-stretch">
            <div className="w-1.5 flex-none bg-gradient-to-b from-[#c2410c] to-[#9a330a]" aria-hidden="true" />
            <div className="flex-1 px-5 py-6 md:px-7">
              <div className="mb-3 flex items-center justify-between">
                <div className="senior-eyebrow text-[10px] uppercase text-[#9a330a]">
                  AI · 代笔
                </div>
                <span
                  aria-hidden="true"
                  className="senior-tabular hidden items-center gap-1 rounded-md border border-[#c2410c]/30 bg-white/80 px-2 py-0.5 text-[10px] font-semibold tracking-[0.18em] text-[#9a330a] sm:inline-flex"
                >
                  PREVIEW
                </span>
              </div>
              <p className="senior-title whitespace-pre-line text-[16px] font-medium leading-[1.85] tracking-[0.01em] text-stone-800 md:text-[17px]">
                {summary.content}
              </p>
              <div className="mt-5 flex items-center justify-end gap-2 text-xs text-stone-500">
                <span className="h-px w-8 bg-stone-300/70" aria-hidden="true" />
                <span>—— 小明 敬上</span>
              </div>
            </div>
          </div>
        </section>

      </main>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-[#e9d9bf]/70 bg-[#fbf6ea]/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <button
            onClick={onBack}
            disabled={busy}
            className="rounded-xl border border-stone-300 bg-white/80 px-4 py-3 text-sm font-medium text-stone-700 transition hover:border-[#c2410c]/30 hover:text-[#9a330a] active:translate-y-px disabled:opacity-40"
          >
            ← 返回
          </button>
          <button
            onClick={send}
            disabled={busy}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold tracking-tight text-white transition active:translate-y-px disabled:cursor-not-allowed ${
              status === 'sent'
                ? 'bg-gradient-to-b from-[#3f8a4f] to-[#2d6a3a] shadow-[0_10px_22px_-10px_rgba(45,106,58,0.55)]'
                : status === 'sending'
                  ? 'bg-gradient-to-b from-[#b8a899] to-[#8e7e6f] shadow-none'
                  : 'bg-gradient-to-b from-[#d35420] to-[#9a330a] shadow-[0_12px_24px_-10px_rgba(154,51,10,0.55)] hover:from-[#c2410c] hover:to-[#7a2705]'
            }`}
          >
            {status === 'idle' && (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 2 11 13" />
                  <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
                </svg>
                寄到妈妈的相框
              </>
            )}
            {status === 'sending' && (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="animate-spin">
                  <path d="M21 12a9 9 0 1 1-6.2-8.55" />
                </svg>
                投递中…
              </>
            )}
            {status === 'sent' && (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                已送达妈妈的相框
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
