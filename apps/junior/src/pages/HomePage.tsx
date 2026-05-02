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
    <div className="senior-stage relative flex flex-1 flex-col">
      {/* 顶部柔光 + 品牌印章 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[42vh] bg-[radial-gradient(circle_at_50%_-10%,_rgba(255,250,238,0.85),_transparent_70%)]" />

      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pb-8 pt-8 md:pt-12">
        {/* 顶端品牌行 */}
        <div className="flex items-center justify-between">
          <span className="senior-eyebrow text-[10px] uppercase text-stone-500">
            南客松 · Family Letter
          </span>
          <span className="senior-tabular text-[11px] text-stone-500">{dateLabel}</span>
        </div>

        {/* 标题区 */}
        <header className="mt-10 md:mt-14">
          <h1 className="senior-title text-[2rem] leading-[1.2] text-stone-900 md:text-[2.5rem]">
            给妈妈捎点今天的事
          </h1>
          <p className="mt-3 max-w-[36ch] text-[15px] leading-relaxed text-stone-600">
            从朋友圈和相册里挑几张，写成一封小信，让她在相框里读到。
          </p>
        </header>

        {/* 主入口：信封卡片 */}
        <button
          onClick={onEnterFilter}
          className="group relative mt-8 flex w-full items-stretch overflow-hidden rounded-[1.25rem] border border-[#e9d9bf] bg-gradient-to-br from-white via-[#fdf7ea] to-[#fbeed5] text-left shadow-[0_18px_40px_-22px_rgba(154,51,10,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_46px_-22px_rgba(154,51,10,0.45)] active:translate-y-0"
        >
          {/* 邮票/封蜡装饰：右上角 */}
          <span
            aria-hidden="true"
            className="senior-tabular pointer-events-none absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-md border border-[#c2410c]/30 bg-white/80 px-2 py-0.5 text-[10px] font-semibold tracking-[0.18em] text-[#9a330a]"
          >
            POSTED · {today.getMonth() + 1}/{today.getDate()}
          </span>
          {/* 左侧信脊 */}
          <div className="w-2 flex-none bg-gradient-to-b from-[#c2410c] to-[#9a330a]" aria-hidden="true" />
          <div className="flex flex-1 items-center gap-4 p-5 md:gap-5 md:p-6">
            <div className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-[#fdebd5] text-[#9a330a] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] md:h-16 md:w-16">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                <path d="m2 7 10 6 10-6" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="senior-eyebrow text-[10px] uppercase text-[#9a330a]">
                Today
              </div>
              <div className="senior-title mt-1 text-xl text-stone-900 md:text-2xl">
                整理今天，发给妈妈
              </div>
              <div className="mt-1 text-sm text-stone-500">
                筛图 · 写成一段小作文 · 发到相框
              </div>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none text-stone-400 transition group-hover:translate-x-1 group-hover:text-[#9a330a]">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </div>
        </button>

        {/* 次入口 */}
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* 妈妈的留言 */}
          <button
            onClick={onEnterMessages}
            className="group flex flex-col gap-3 rounded-[1.1rem] border border-stone-200/80 bg-white/85 p-5 text-left shadow-[0_10px_22px_-18px_rgba(82,53,33,0.35)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-[#c2410c]/30 hover:shadow-[0_16px_28px_-18px_rgba(154,51,10,0.4)] active:translate-y-0"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-[#fdebd5] text-[#9a330a]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="senior-title text-[17px] text-stone-900">
                    妈妈的留言
                  </span>
                  {unreadCount > 0 && (
                    <span className="senior-tabular inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#c2410c] px-1.5 text-[11px] font-semibold text-white shadow-[0_0_0_3px_rgba(194,65,12,0.15)]">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-stone-500">
                  {unreadCount > 0 ? `有 ${unreadCount} 条新的` : '暂时没有新的'}
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-[#9a330a]">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </div>
            {lastMessage && (
              <div className="rounded-xl border border-[#f1e4cc] bg-[#fbf2dd]/80 px-3 py-2.5">
                <div className="senior-tabular text-[11px] text-stone-500">{lastMessage.time}</div>
                <p className="senior-title mt-0.5 line-clamp-2 text-[15px] leading-relaxed text-stone-800">
                  「{lastMessage.question}」
                </p>
              </div>
            )}
          </button>

          {/* 过去的日记 */}
          <button
            onClick={onEnterHistory}
            className="group flex flex-col gap-3 rounded-[1.1rem] border border-stone-200/80 bg-white/85 p-5 text-left shadow-[0_10px_22px_-18px_rgba(82,53,33,0.35)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-[#c2410c]/30 hover:shadow-[0_16px_28px_-18px_rgba(154,51,10,0.4)] active:translate-y-0"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-[#f1e4cc] text-[#7a5224]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="senior-title text-[17px] text-stone-900">
                  过去的信
                </div>
                <div className="mt-0.5 text-xs text-stone-500">翻一翻这几天都写了什么</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-[#9a330a]">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </div>
            {/* 信件叠层 */}
            <div className="relative h-12">
              <div className="absolute left-0 top-1.5 h-9 w-12 rotate-[-6deg] rounded-md border border-[#e9d9bf] bg-gradient-to-br from-white to-[#fbf2dd] shadow-sm" />
              <div className="absolute left-9 top-0 h-9 w-12 rotate-[2deg] rounded-md border border-[#e9d9bf] bg-gradient-to-br from-white to-[#fdebd5] shadow-sm" />
              <div className="absolute left-[68px] top-1.5 h-9 w-12 rotate-[7deg] rounded-md border border-[#e9d9bf] bg-gradient-to-br from-white to-[#fbf2dd] shadow-sm" />
              <div className="senior-tabular absolute left-[110px] top-2.5 inline-flex h-7 items-center rounded-md border border-stone-200 bg-white/80 px-2 text-[11px] font-medium text-stone-500">
                共 7 封
              </div>
            </div>
          </button>
        </div>

        {/* 留白填充 + 底部署名 */}
        <div className="flex-1" />

        <footer className="mt-10 flex items-center justify-center gap-2 text-center text-[11px] text-stone-400">
          <span className="h-px w-10 bg-stone-300/60" aria-hidden="true" />
          <span>南客松 · 让妈妈离你近一点</span>
          <span className="h-px w-10 bg-stone-300/60" aria-hidden="true" />
        </footer>
      </div>
    </div>
  )
}
