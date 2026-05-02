import { useState } from 'react'
import HomePage from './pages/HomePage'
import FilterPage from './pages/FilterPage'
import AuditPage from './pages/AuditPage'
import SeniorView from './pages/SeniorView'
import HistoryPage from './pages/HistoryPage'
import MessagesPage from './pages/MessagesPage'
import type { FeedItem } from './filter/images'
import type { GenerateSummaryResult } from './api/agent'

type View = 'home' | 'filter' | 'audit' | 'history' | 'messages'

export default function App() {
  const role = new URLSearchParams(window.location.search).get('role')
  if (role === 'senior') return <SeniorView />

  return <JuniorApp />
}

function JuniorApp() {
  const [view, setView] = useState<View>('home')
  const [summary, setSummary] = useState<GenerateSummaryResult | null>(null)

  const handleProceed = (_items: FeedItem[], result: GenerateSummaryResult) => {
    setSummary(result)
    setView('audit')
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* 筛选/审核流程保留顶部步骤指示器,其他页面各自负责布局 */}
      {(view === 'filter' || view === 'audit') && (
        <nav className="flex-none border-b border-stone-200 bg-white">
          <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2.5">
            <button
              onClick={() => setView('home')}
              className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-stone-300 bg-white text-stone-700 transition hover:bg-stone-50 active:translate-y-px"
              aria-label="返回首页"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            {([
              { key: 'filter', label: '清理素材', sub: '上滑删除不想给妈妈看的' },
              { key: 'audit', label: '预览发送', sub: '确认内容和 AI 配文' },
            ] as const).map((s, i) => {
              const active = s.key === view
              return (
                <button
                  key={s.key}
                  onClick={() => setView(s.key)}
                  disabled={s.key === 'audit' && summary === null}
                  className={`group flex flex-1 items-center gap-2 rounded-xl px-3 py-2 text-left transition disabled:opacity-40 ${
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
      )}

      <main className="relative flex flex-1 flex-col">
        {view === 'home' && (
          <HomePage
            onEnterFilter={() => setView('filter')}
            onEnterHistory={() => setView('history')}
            onEnterMessages={() => setView('messages')}
          />
        )}
        {view === 'filter' && <FilterPage onProceed={handleProceed} />}
        {view === 'audit' && summary && (
          <AuditPage summary={summary} onBack={() => setView('filter')} />
        )}
        {view === 'history' && <HistoryPage onBack={() => setView('home')} />}
        {view === 'messages' && <MessagesPage onBack={() => setView('home')} />}
      </main>
    </div>
  )
}
