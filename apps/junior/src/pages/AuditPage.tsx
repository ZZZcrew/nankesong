import { useState } from 'react'

type Paragraph = {
  id: string
  text: string
  hidden: boolean
}

type Cover = {
  id: string
  src: string
}

const DRAFT_TITLE = '小明在南山散步的一天'

const INITIAL_PARAGRAPHS: Paragraph[] = [
  {
    id: 'p1',
    text: '今天下午五点多，小明和同事走到南山脚下。山间的梧桐叶还没落光，风一吹就响得像下雨。他们沿着步道慢慢往上走，路边有人推着小推车卖烤红薯，香味飘得很远。',
    hidden: false,
  },
  {
    id: 'p2',
    text: '六点多，他在观景台停了一会儿，看着城里的灯一盏一盏亮起来。他拿手机拍了几张照片，笑着说这个角度比上次去的那个要好。',
    hidden: false,
  },
  {
    id: 'p3',
    text: '晚饭他们在山下的老店吃了火锅。小明点了毛肚和虾滑，又加了他总忘不了的卤花生。朋友说他今天吃得比平时多，心情看起来不错。',
    hidden: false,
  },
  {
    id: 'p4',
    text: '饭后他们去了附近一家新开的酒吧，坐在露台上聊了一个小时。窗外是半明半暗的街灯，屋里放着慢摇的爵士。小明点了一杯加了橙皮的威士忌。',
    hidden: true,
  },
  {
    id: 'p5',
    text: '回家的路上他买了一袋橘子，说准备明天带去办公室。地铁上他坐在靠窗的位置，车窗外能看到远处的江面，水上还浮着几只小船。',
    hidden: false,
  },
]

const INITIAL_COVERS: Cover[] = [
  { id: 'c1', src: 'https://picsum.photos/seed/nks-walk/400/400' },
  { id: 'c2', src: 'https://picsum.photos/seed/nks-view/400/400' },
  { id: 'c3', src: 'https://picsum.photos/seed/nks-hotpot/400/400' },
  { id: 'c4', src: '' },
]

export default function AuditPage() {
  const [paragraphs, setParagraphs] = useState(INITIAL_PARAGRAPHS)
  const [covers] = useState(INITIAL_COVERS)

  const visibleCount = paragraphs.filter((p) => !p.hidden).length

  const toggleHidden = (id: string) => {
    setParagraphs((prev) =>
      prev.map((p) => (p.id === id ? { ...p, hidden: !p.hidden } : p)),
    )
  }

  return (
    <div className="min-h-screen pb-32">
      {/* 倒计时警示条 */}
      <div className="sticky top-0 z-20 border-b border-amber-200/60 bg-gradient-to-r from-amber-100 to-amber-50/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10 text-amber-700">
              ⏳
            </span>
            <div>
              <div className="text-sm text-amber-900">
                <span className="font-semibold">2 分 47 秒</span>
                <span className="ml-1">后自动发送给妈妈</span>
              </div>
              <div className="text-xs text-amber-700/70">不操作则以当前草稿发布</div>
            </div>
          </div>
          <button className="rounded-full border border-amber-300/60 bg-white/60 px-3 py-1 text-xs text-amber-800 hover:bg-white">
            暂停倒计时
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        {/* 标题 */}
        <header className="space-y-1">
          <div className="text-xs tracking-wide text-stone-500">2026 年 5 月 2 日 · 今日日记草稿</div>
          <h1 className="text-2xl font-semibold text-stone-900">{DRAFT_TITLE}</h1>
          <div className="text-xs text-stone-500">
            共 {paragraphs.length} 段 · 当前保留 <span className="font-semibold text-emerald-700">{visibleCount}</span> 段
          </div>
        </header>

        {/* 段落卡片 */}
        <section className="space-y-3">
          {paragraphs.map((p, i) => (
            <article
              key={p.id}
              className={`group relative rounded-2xl border bg-white p-4 shadow-sm transition ${
                p.hidden ? 'border-rose-200/60 bg-rose-50/40' : 'border-stone-200/70'
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-medium ${
                    p.hidden ? 'bg-rose-100 text-rose-500' : 'bg-stone-100 text-stone-500'
                  }`}
                >
                  {i + 1}
                </span>
                <p
                  className={`leading-relaxed ${
                    p.hidden ? 'text-stone-400 line-through decoration-rose-300 decoration-2' : 'text-stone-800'
                  }`}
                >
                  {p.text}
                </p>
              </div>

              {p.hidden && (
                <div className="mt-3 ml-9 flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-rose-700">
                    ❌ 已隐藏，不给妈妈看
                  </span>
                </div>
              )}

              <div className="mt-3 ml-9 flex gap-3 text-xs">
                <button className="text-stone-500 hover:text-stone-700">编辑此段</button>
                <button
                  onClick={() => toggleHidden(p.id)}
                  className={`font-medium ${
                    p.hidden ? 'text-emerald-600 hover:text-emerald-700' : 'text-rose-500 hover:text-rose-600'
                  }`}
                >
                  {p.hidden ? '恢复显示' : '删除此段'}
                </button>
              </div>
            </article>
          ))}
        </section>

        {/* 封面图选择 */}
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-stone-700">封面图</h2>
            <span className="text-xs text-stone-400">最多 4 张，会按顺序轮播</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {covers.map((c) => (
              <div
                key={c.id}
                className="group relative aspect-square overflow-hidden rounded-xl border border-stone-200 bg-stone-100"
              >
                {c.src ? (
                  <>
                    <img src={c.src} alt="" className="h-full w-full object-cover" />
                    <button className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition group-hover:opacity-100">
                      ×
                    </button>
                  </>
                ) : (
                  <button className="flex h-full w-full items-center justify-center text-2xl text-stone-400 hover:bg-stone-50 hover:text-stone-600">
                    +
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* 妈妈上次留言 */}
        <section className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
          <div className="flex items-center gap-2 text-xs text-rose-600/80">
            <span>💌</span>
            <span>妈妈的上次留言</span>
            <span className="ml-auto text-rose-400">昨天 21:42</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-stone-700">
            "那个橘子汁不错，什么时候再回来，妈给你炖排骨。"
          </p>
          <button className="mt-3 text-xs font-medium text-rose-600 hover:text-rose-700">回复 ›</button>
        </section>
      </main>

      {/* 底部操作栏 */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl gap-3 px-4 py-3">
          <button className="flex-1 rounded-xl border border-stone-300 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50">
            ♻ 重新生成
          </button>
          <button className="flex-[2] rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-700">
            ✅ 立即发送
          </button>
        </div>
      </div>
    </div>
  )
}
