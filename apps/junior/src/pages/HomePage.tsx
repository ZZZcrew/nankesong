import { loadElderMessages } from '../api/mockMessages'

type Props = {
  onEnterFilter: () => void
  onEnterHistory: () => void
  onEnterMessages: () => void
}

export default function HomePage({ onEnterFilter, onEnterHistory, onEnterMessages }: Props) {
  const messages = loadElderMessages()
  const unreadCount = messages.filter((m) => m.unread).length
  const lastMessage = messages[0]

  const today = new Date()
  const weekday = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][today.getDay()]
  const dateLabel = `${today.getFullYear()} 年 ${today.getMonth() + 1} 月 ${today.getDate()} 日 · ${weekday}`

  return (
    <div className="flex flex-1 flex-col bg-[#fbf8f2]">
      <header className="mx-auto w-full max-w-3xl px-5 pb-4 pt-10 md:pt-14">
        <div className="text-xs font-medium tracking-wide text-stone-500">{dateLabel}</div>
        <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight tracking-tight text-stone-900 md:text-[34px]">
          给妈妈捎点今天的事
        </h1>
        <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-stone-500">
          从朋友圈和相册里挑几张，写成一封小信，让她在相框里读到。
        </p>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-10 pt-2">
        {/* 主入口:信件感卡片,左边一条暖色书脊,右边奶油纸 */}
        <button
          onClick={onEnterFilter}
          className="group flex w-full items-stretch overflow-hidden rounded-2xl border border-amber-200/70 bg-white text-left shadow-sm transition hover:shadow-md active:translate-y-px"
        >
          {/* 左侧色条模拟信封封口/书脊 */}
          <div className="w-2 flex-none bg-amber-600" aria-hidden="true" />
          <div className="flex flex-1 items-center gap-4 p-5 md:p-6">
            <div className="flex h-14 w-14 flex-none items-center justify-center rounded-xl bg-amber-100 text-amber-700 md:h-16 md:w-16">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                <path d="m2 7 10 6 10-6" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-amber-700">
                今日
              </div>
              <div className="mt-1 text-xl font-semibold tracking-tight text-stone-900 md:text-[22px]">
                整理今天，发给妈妈
              </div>
              <div className="mt-1 text-sm text-stone-500">
                筛图 · 写成一段小作文 · 发到相框
              </div>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none text-stone-300 transition group-hover:translate-x-1 group-hover:text-amber-700">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </div>
        </button>

        {/* 下面两个并排的次入口 */}
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {/* 妈妈的留言 */}
          <button
            onClick={onEnterMessages}
            className="group flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-5 text-left shadow-sm transition hover:border-amber-200 hover:shadow-md active:translate-y-px"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold tracking-tight text-stone-900">
                    妈妈的留言
                  </span>
                  {unreadCount > 0 && (
                    <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-semibold text-white">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <div className="text-xs text-stone-500">
                  {unreadCount > 0 ? `有 ${unreadCount} 条新的` : '暂时没有新的'}
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-stone-500">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </div>
            {lastMessage && (
              <div className="rounded-xl bg-[#f6f1e5] px-3 py-2.5">
                <div className="text-[11px] text-stone-400">{lastMessage.time}</div>
                <p className="mt-0.5 line-clamp-2 text-sm leading-relaxed text-stone-700">
                  "{lastMessage.question}"
                </p>
              </div>
            )}
          </button>

          {/* 过去的日记 */}
          <button
            onClick={onEnterHistory}
            className="group flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-5 text-left shadow-sm transition hover:border-amber-200 hover:shadow-md active:translate-y-px"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-base font-semibold tracking-tight text-stone-900">
                  过去的信
                </div>
                <div className="text-xs text-stone-500">翻一翻这几天都写了什么</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-stone-500">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </div>
            <div className="flex -space-x-2">
              <div className="h-9 w-9 rounded-lg border-2 border-white bg-amber-200/70" />
              <div className="h-9 w-9 rounded-lg border-2 border-white bg-stone-200" />
              <div className="h-9 w-9 rounded-lg border-2 border-white bg-amber-300/60" />
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-white bg-[#f6f1e5] text-[10px] font-medium text-stone-500">
                +4
              </div>
            </div>
          </button>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-3xl px-5 pb-8 text-center text-[11px] text-stone-400">
        南柯松 · 让妈妈离你近一点
      </footer>
    </div>
  )
}
