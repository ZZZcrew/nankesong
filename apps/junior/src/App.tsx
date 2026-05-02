import { useState } from 'react'
import FilterPage from './pages/FilterPage'
import AuditPage from './pages/AuditPage'

type Step = 'filter' | 'audit'

const STEPS: { key: Step; label: string; sub: string }[] = [
  { key: 'filter', label: '清理素材', sub: '上滑删除不想给妈妈看的' },
  { key: 'audit', label: '审核日记', sub: 'AI 生成的草稿，3 分钟后自动发送' },
]

export default function App() {
  const [step, setStep] = useState<Step>('filter')

  return (
    <div className="flex min-h-screen flex-col">
      {/* 顶部步骤指示器 */}
      <nav className="flex-none border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2.5">
          {STEPS.map((s, i) => {
            const active = s.key === step
            return (
              <button
                key={s.key}
                onClick={() => setStep(s.key)}
                className={`group flex flex-1 items-center gap-2 rounded-xl px-3 py-2 text-left transition ${
                  active ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                <span
                  className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-sm font-semibold ${
                    active ? 'bg-white text-stone-900' : 'bg-white text-stone-500'
                  }`}
                >
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-tight">{s.label}</span>
                  <span className={`block truncate text-[11px] leading-tight ${active ? 'text-white/70' : 'text-stone-500'}`}>
                    {s.sub}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* 页面内容区域：flex-1 让 FilterPage 内部的 flex 布局能拉满 */}
      <main className="relative flex flex-1 flex-col">
        {step === 'filter' ? (
          <FilterPage onProceed={() => setStep('audit')} />
        ) : (
          <AuditPage />
        )}
      </main>
    </div>
  )
}
