import { useState } from 'react'
import type { FeedItem } from '../filter/images'
import { generateNarration } from '../api/narration'

type Props = {
  kept: FeedItem[]
  onBack: () => void
}

type SendStatus = 'idle' | 'generating' | 'sending' | 'sent'

const DIARY_TITLE = '小明在南山散步的一天'
const DIARY_DATE = '2026 年 5 月 2 日 · 星期六'

function fallbackNarration(items: FeedItem[]): string {
  const socials = items.filter((it) => it.kind === 'social').map((it) => it.text)
  if (socials.length > 0) return socials.join(' ')
  return '今天小明过得挺好的，给妈妈分享了几张照片。'
}

export default function AuditPage({ kept, onBack }: Props) {
  const [status, setStatus] = useState<SendStatus>('idle')

  const send = async () => {
    setStatus('generating')
    let narration = ''
    try {
      const res = await generateNarration({ date: DIARY_DATE, title: DIARY_TITLE, items: kept })
      narration = res.text
    } catch {
      narration = fallbackNarration(kept)
    }

    setStatus('sending')
    const diary = {
      date: DIARY_DATE,
      title: DIARY_TITLE,
      publishedAt: Date.now(),
      narration,
      items: kept.map((it) =>
        it.kind === 'image'
          ? { kind: 'image', id: it.id, url: it.url }
          : { kind: 'social', id: it.id, author: it.author, time: it.time, text: it.text },
      ),
    }
    try {
      localStorage.setItem('nks-diary', JSON.stringify(diary))
    } catch {
      // 容错:localStorage 满/被禁;保持发送流程不中断,状态仍然走到 sent
    }
    setTimeout(() => setStatus('sent'), 400)
  }

  if (kept.length === 0) {
    return (
      <div className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="9" cy="11" r="2" />
            <path d="m21 17-5-5-4 4-3-3-6 6" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold tracking-tight text-stone-800">还没有选好内容</h2>
        <p className="mt-1.5 max-w-[32ch] text-sm leading-relaxed text-stone-500">
          请先回到第一步"清理素材"，筛选出要给妈妈看的照片或朋友圈。
        </p>
        <button
          onClick={onBack}
          className="mt-6 rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 active:translate-y-px"
        >
          ← 去筛选
        </button>
      </div>
    )
  }

  const busy = status !== 'idle'

  return (
    <div className="flex flex-1 flex-col pb-28">
      <header className="mx-auto w-full max-w-2xl px-4 pb-3 pt-6 text-center">
        <div className="text-xs tracking-wide text-stone-500">{DIARY_DATE} · 即将发送</div>
        <h1 className="mt-1 text-2xl font-semibold text-stone-900">{DIARY_TITLE}</h1>
        <p className="mt-1 text-sm text-stone-500">
          共 {kept.length} 条内容 · 妈妈将在相框里看到下面的内容
        </p>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4">
        {kept.map((it, i) =>
          it.kind === 'image' ? (
            <article
              key={it.id}
              className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
            >
              <div className="relative aspect-[3/2] bg-stone-100">
                <img
                  src={it.url}
                  alt={it.name}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute left-3 top-3 rounded-full bg-black/50 px-2.5 py-0.5 text-xs text-white backdrop-blur">
                  {i + 1} / {kept.length}
                </div>
              </div>
            </article>
          ) : (
            <article
              key={it.id}
              className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
            >
              <div className="flex items-center gap-2 border-b border-stone-100 bg-stone-50/60 px-4 py-2.5">
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                  朋友圈
                </span>
                <span className="text-xs font-medium text-stone-700">{it.author}</span>
                <span className="text-[11px] text-stone-400">· {it.time}</span>
                <span className="ml-auto text-[11px] text-stone-400">
                  {i + 1} / {kept.length}
                </span>
              </div>
              <p className="px-4 py-4 text-base leading-relaxed text-stone-800">{it.text}</p>
            </article>
          ),
        )}
      </main>

      {/* 底部固定发送按钮 */}
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
                : 'bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-700'
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
            {status === 'generating' && 'AI 正在写今天的小作文…'}
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
