import { loadElderMessages } from '../api/mockMessages'

type Props = {
  onBack: () => void
}

export default function MessagesPage({ onBack }: Props) {
  const messages = loadElderMessages()

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
        <div className="flex-1">
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-stone-900">
            妈妈的留言
          </h1>
          <p className="mt-0.5 text-sm text-stone-500">她在相框那头按了"说话"按钮说的</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-3 px-4 pb-10">
        {messages.length === 0 ? (
          <div className="mt-20 text-center text-sm text-stone-400">暂无留言</div>
        ) : (
          messages.map((m) => (
            <article
              key={m.id}
              className={`overflow-hidden rounded-2xl border shadow-sm transition ${
                m.unread ? 'border-amber-300 bg-[#fdf7e8]' : 'border-stone-200 bg-white'
              }`}
            >
              <div className="flex items-start gap-3 px-4 py-3.5">
                <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-amber-600 text-base font-semibold text-white">
                  妈
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-stone-800">妈妈</span>
                    <span className="text-[11px] text-stone-400">{m.time}</span>
                    {m.unread && (
                      <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                        新
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-base leading-relaxed text-stone-900">{m.question}</p>
                </div>
              </div>

              {m.reply ? (
                <div className="border-t border-amber-100/70 bg-[#fffdf7] px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-stone-100 text-stone-500">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 8V4H8" />
                        <rect width="16" height="12" x="4" y="8" rx="2" />
                        <path d="M2 14h2" />
                        <path d="M20 14h2" />
                        <path d="M15 13v2" />
                        <path d="M9 13v2" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="text-[11px] font-medium text-stone-500">
                        AI 已代为回复
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-stone-700">{m.reply}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border-t border-stone-200/60 bg-stone-50/60 px-4 py-2.5 text-xs text-stone-400">
                  等待回复…
                </div>
              )}
            </article>
          ))
        )}
      </main>
    </div>
  )
}
