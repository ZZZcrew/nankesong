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
    <div className="flex flex-1 flex-col bg-[#fbf8f2] pb-28">
      <header className="mx-auto w-full max-w-2xl px-4 pb-3 pt-6 text-center">
        <div className="text-xs tracking-wide text-stone-500">{DIARY_DATE_LABEL} · 即将发送</div>
        <h1 className="mt-1 font-serif text-2xl font-semibold leading-tight tracking-tight text-stone-900 md:text-[28px]">
          {summary.title}
        </h1>
        <p className="mt-1 text-xs text-stone-500">妈妈在相框里会看到下面这封信</p>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4">
        {/* 封面图轮播 */}
        {covers.length > 0 && (
          <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="relative aspect-[3/2] bg-[#f6f1e5]">
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
                  <div className="absolute right-3 top-3 rounded-full bg-black/40 px-2.5 py-0.5 text-xs text-white backdrop-blur">
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

        {/* 家书正文 */}
        <section className="overflow-hidden rounded-2xl border border-amber-200/70 bg-white shadow-sm">
          <div className="flex items-stretch">
            <div className="w-1.5 flex-none bg-amber-600" aria-hidden="true" />
            <div className="flex-1 px-5 py-5">
              <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.15em] text-amber-700">
                AI 替你写的小作文
              </div>
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-stone-800">
                {summary.content}
              </p>
            </div>
          </div>
        </section>

      </main>

      <div className="fixed bottom-0 left-0 right-0 border-t border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <button
            onClick={onBack}
            disabled={busy}
            className="rounded-xl border border-stone-300 px-4 py-3 text-sm font-medium text-stone-700 transition hover:bg-stone-50 active:translate-y-px disabled:opacity-40"
          >
            ← 返回
          </button>
          <button
            onClick={send}
            disabled={busy}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold tracking-tight text-white shadow-sm transition active:translate-y-px disabled:opacity-80 ${
              status === 'sent'
                ? 'bg-emerald-500'
                : 'bg-amber-600 shadow-amber-600/20 hover:bg-amber-700'
            }`}
          >
            {status === 'idle' && (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 2 11 13" />
                  <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
                </svg>
                发送给妈妈
              </>
            )}
            {status === 'sending' && '发送中…'}
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
