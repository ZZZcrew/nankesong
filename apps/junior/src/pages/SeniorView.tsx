import { useCallback, useEffect, useState } from 'react'
import { useCloudTTS } from '../tts/useCloudTTS'
import { useASR } from '../asr/useASR'
import { askBackend } from '../api/ask'
import { loadMockDiary } from '../api/mockDiary'

type ImageDiaryItem = {
  kind: 'image'
  id: string
  url: string
}

type SocialDiaryItem = {
  kind: 'social'
  id: string
  author: string
  time: string
  text: string
}

type DiaryItem = ImageDiaryItem | SocialDiaryItem

type Diary = {
  date: string
  title: string
  publishedAt: number
  narration: string
  items: DiaryItem[]
}

const STORAGE_KEY = 'nks-diary'
const AUTO_INTERVAL_MS = 5000

function loadDiary(): Diary | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Omit<Partial<Diary>, 'items'> & {
      items?: Array<Record<string, unknown>>
    }
    if (!parsed || !Array.isArray(parsed.items) || parsed.items.length === 0) return null
    const items: DiaryItem[] = parsed.items.map((it) => {
      const kind = (it.kind as string | undefined) ?? 'image'
      if (kind === 'social') {
        return {
          kind: 'social',
          id: String(it.id ?? ''),
          author: String(it.author ?? ''),
          time: String(it.time ?? ''),
          text: String(it.text ?? ''),
        }
      }
      return { kind: 'image', id: String(it.id ?? ''), url: String(it.url ?? '') }
    })
    return {
      date: parsed.date ?? '',
      title: parsed.title ?? '',
      publishedAt: parsed.publishedAt ?? 0,
      narration: parsed.narration ?? '',
      items,
    }
  } catch {
    return null
  }
}

export default function SeniorView() {
  const [diary, setDiary] = useState<Diary | null>(() => loadDiary())
  const [sceneIdx, setSceneIdx] = useState(0)
  const [paused, setPaused] = useState(false)

  // TTS 当前正在播报的文本:初始=小作文,提问后=后端回复
  const [spokenText, setSpokenText] = useState<string>(diary?.narration ?? '')
  const [thinking, setThinking] = useState(false)

  const tts = useCloudTTS(spokenText)
  const asr = useASR('zh-CN')

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      const next = loadDiary()
      setDiary(next)
      setSceneIdx(0)
      setPaused(false)
      setSpokenText(next?.narration ?? '')
      setThinking(false)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const total = diary?.items.length ?? 0
  const safeIdx = total > 0 ? Math.min(sceneIdx, total - 1) : 0

  useEffect(() => {
    if (paused || total === 0) return
    const t = setTimeout(() => {
      setSceneIdx((i) => (i + 1) % total)
    }, AUTO_INTERVAL_MS)
    return () => clearTimeout(t)
  }, [safeIdx, paused, total])

  const scene = diary?.items[safeIdx]

  const togglePause = () => {
    setPaused((p) => {
      const next = !p
      if (next) tts.pause()
      else tts.resume()
      return next
    })
  }

  const replay = () => {
    setPaused(false)
    setSpokenText(diary?.narration ?? '')
    // setState 相同值不会触发 useEffect,所以先 stop 再重播
    tts.stop()
    setTimeout(() => tts.play(), 0)
  }

  // ASR 流程:按住开始,松开结束,拿到 transcript 调后端,回复丢给 TTS 播
  const handleFinalTranscript = useCallback(
    async (transcript: string) => {
      console.log('[链路] ASR 完整识别:', transcript)
      setThinking(true)
      try {
        console.log('[链路] 调用 askBackend...')
        const { text } = await askBackend({ transcript })
        console.log('[链路] 后端回复:', text)
        console.log('[链路] 交给 TTS 播报')
        setSpokenText(text)
      } catch (err) {
        console.error('[链路] askBackend 失败:', err)
        setSpokenText('妈妈，我这边好像出了点问题，您稍等一下再试试。')
      } finally {
        setThinking(false)
      }
    },
    [],
  )

  const startListening = () => {
    if (tts.status === 'playing' || tts.status === 'paused') tts.stop()
    asr.start(handleFinalTranscript)
  }

  const stopListening = () => {
    if (asr.status === 'listening') asr.stop()
  }

  // 「按住说话」可按条件:ASR 可用、不在 thinking、有日记。
  // 如果日记有小作文,还需等 TTS 念完;没小作文就直接放行(比如接口挂了兜底为空)
  const micUsable = asr.status !== 'unsupported' && asr.status !== 'denied'
  const narrationReady = tts.sentences.length === 0 || tts.status === 'ended'
  const canTalk = narrationReady && !thinking && micUsable && diary !== null

  const micHint =
    asr.status === 'unsupported'
      ? asr.error ?? '当前浏览器不支持语音识别'
      : asr.status === 'denied'
        ? '未授权麦克风权限'
        : asr.status === 'error'
          ? `语音识别失败: ${asr.error ?? '未知错误'}`
          : !canTalk && diary !== null && !narrationReady && !thinking
            ? '先听完今天的故事,再按住说话'
            : thinking
              ? '小明正在想怎么回答…'
              : '问问题 · 或留言给小明'

  const { sentences, activeIdx, status: ttsStatus } = tts
  const hasNarration = sentences.length > 0
  const displayIdx = activeIdx < 0 ? 0 : activeIdx
  const prevSentence = displayIdx > 0 ? sentences[displayIdx - 1] : ''
  const curSentence = sentences[displayIdx] ?? ''
  const nextSentence = displayIdx < sentences.length - 1 ? sentences[displayIdx + 1] : ''

  const showListeningSubtitle = asr.status === 'listening'
  const showThinkingSubtitle = thinking
  const asrPreview = (asr.finalTranscript + asr.interim).trim()

  return (
    <div className="h-[100dvh] overflow-hidden bg-stone-900 p-3 md:p-5">
      <div
        className="mx-auto flex h-full max-w-[1400px] flex-col rounded-2xl p-3 sm:p-4"
        style={{
          background:
            'linear-gradient(135deg, #8b5a2b 0%, #a06b35 25%, #6b3e1d 55%, #8b5a2b 100%)',
          boxShadow:
            'inset 0 0 0 1px rgba(255,215,165,0.25), inset 0 2px 6px rgba(255,215,165,0.3), inset 0 -2px 6px rgba(0,0,0,0.3), 0 20px 50px rgba(0,0,0,0.55)',
        }}
      >
        <div
          className="flex flex-1 flex-col rounded-xl p-[3px]"
          style={{ background: 'linear-gradient(135deg, #d4a056, #7a5220, #d4a056)' }}
        >
          <div className="flex flex-1 flex-col overflow-hidden rounded-lg bg-[#fbf8f2]">
            {diary === null ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <circle cx="9" cy="11" r="2" />
                    <path d="m21 17-5-5-4 4-3-3-6 6" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold tracking-tight text-stone-700">
                  等待小辈发来今日日记…
                </h2>
                <p className="mt-2 max-w-[32ch] text-sm leading-relaxed text-stone-500">
                  他还在整理今天的照片，完成后会自动出现在这里。
                </p>
                <button
                  onClick={() => loadMockDiary()}
                  className="mt-6 rounded-full border border-stone-300 bg-white px-4 py-2 text-xs font-medium text-stone-600 shadow-sm transition hover:bg-stone-50 active:translate-y-px"
                >
                  加载示例日记（测试用）
                </button>
              </div>
            ) : (
              <>
                <header className="flex-none px-6 pb-2 pt-4 text-center sm:px-8">
                  <div className="text-xs text-stone-500">{diary.date}</div>
                  <h1 className="mt-0.5 text-lg font-bold text-stone-900 md:text-xl">
                    {diary.title}
                  </h1>
                </header>

                <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-2 sm:px-8">
                  <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                    <div className="relative aspect-[3/2] h-full max-w-full overflow-hidden rounded-xl bg-stone-200 shadow-lg shadow-stone-900/20">
                      {diary.items.map((s, i) => (
                        <div
                          key={s.id}
                          className={`absolute inset-0 transition-opacity duration-700 ${
                            i === safeIdx ? 'opacity-100' : 'opacity-0'
                          }`}
                        >
                          {s.kind === 'image' ? (
                            <img
                              src={s.url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#f5efe3] via-[#faf6ec] to-[#efe6d2] px-10 py-8 text-center">
                              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-stone-600 shadow-sm">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                  <circle cx="12" cy="12" r="10" />
                                  <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                                  <path d="M9 9h.01M15 9h.01" />
                                </svg>
                                来自朋友圈
                              </div>
                              <p className="max-w-[22ch] text-xl font-medium leading-relaxed tracking-tight text-stone-800 md:text-2xl">
                                “{s.text}”
                              </p>
                              <div className="mt-4 text-sm text-stone-500">
                                — {s.author} · {s.time}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-2">
                        {diary.items.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setSceneIdx(i)}
                            aria-label={`第 ${i + 1} 条`}
                            className={`h-2 rounded-full transition-all ${
                              i === safeIdx ? 'w-8 bg-white' : 'w-2 bg-white/60'
                            }`}
                          />
                        ))}
                      </div>

                      <div className="absolute right-3 top-3 rounded-full bg-black/40 px-2.5 py-0.5 text-xs text-white backdrop-blur">
                        {safeIdx + 1} / {total}
                      </div>
                    </div>
                  </div>

                  {/* 字幕区:优先展示 ASR/thinking 状态,否则展示 TTS */}
                  <div className="relative mt-3 flex min-h-[6.5rem] w-full max-w-3xl flex-none flex-col items-center justify-center px-4 text-center">
                    {/* 跳过讲述:小作文没念完就始终可见,和当前渲染分支解耦 */}
                    {hasNarration &&
                      !showListeningSubtitle &&
                      !showThinkingSubtitle &&
                      ttsStatus !== 'ended' &&
                      ttsStatus !== 'unsupported' && (
                        <button
                          onClick={() => tts.skip()}
                          className="absolute right-0 top-0 z-10 inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-medium text-stone-600 shadow-sm transition hover:bg-stone-50 hover:text-stone-900 active:translate-y-px"
                          aria-label="跳过讲述"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polygon points="5 4 15 12 5 20 5 4" />
                            <line x1="19" y1="5" x2="19" y2="19" />
                          </svg>
                          跳过讲述
                        </button>
                      )}
                    {showListeningSubtitle ? (
                      <>
                        <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-600">
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                          </span>
                          正在听，您说…
                        </div>
                        <p className="my-1 min-h-[2rem] px-2 text-xl font-semibold leading-relaxed tracking-tight text-stone-900 md:text-2xl">
                          {asrPreview || <span className="text-stone-400">（请讲）</span>}
                        </p>
                      </>
                    ) : showThinkingSubtitle ? (
                      <>
                        <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="animate-spin">
                            <path d="M21 12a9 9 0 1 1-6.2-8.55" />
                          </svg>
                          小明正在想怎么回答…
                        </div>
                        {asr.finalTranscript && (
                          <p className="my-1 max-w-prose px-2 text-sm italic leading-relaxed text-stone-500">
                            您问：{asr.finalTranscript}
                          </p>
                        )}
                      </>
                    ) : hasNarration ? (
                      ttsStatus === 'blocked' ? (
                        <button
                          onClick={() => tts.play()}
                          className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-stone-800 active:translate-y-px"
                        >
                          点击开始讲述今天的故事
                        </button>
                      ) : ttsStatus === 'error' ? (
                        <div className="px-4">
                          <p className="mb-2 text-sm font-medium text-red-600">TTS 出错了</p>
                          <p className="max-w-prose break-all text-xs leading-relaxed text-stone-500">
                            {tts.error ?? '未知错误'}
                          </p>
                          <button
                            onClick={() => tts.play()}
                            className="mt-3 rounded-full border border-stone-300 bg-white px-4 py-1.5 text-xs font-medium text-stone-700 shadow-sm transition hover:bg-stone-50 active:translate-y-px"
                          >
                            重试
                          </button>
                        </div>
                      ) : (
                        <>
                          {prevSentence && (
                            <p className="truncate text-sm leading-tight text-stone-400">
                              {prevSentence}
                            </p>
                          )}
                          <p
                            key={displayIdx}
                            className="my-1 px-2 text-xl font-semibold leading-relaxed tracking-tight text-stone-900 md:text-2xl"
                          >
                            {curSentence}
                          </p>
                          {nextSentence && (
                            <p className="truncate text-sm leading-tight text-stone-400">
                              {nextSentence}
                            </p>
                          )}
                          {ttsStatus === 'ended' && (
                            <button
                              onClick={replay}
                              className="absolute bottom-0 right-2 inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white/90 px-3 py-1 text-xs font-medium text-stone-700 shadow-sm transition hover:bg-white active:translate-y-px"
                              aria-label="重播今天的故事"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M3 12a9 9 0 1 0 3-6.7" />
                                <path d="M3 4v5h5" />
                              </svg>
                              重播
                            </button>
                          )}
                        </>
                      )
                    ) : (
                      scene &&
                      scene.kind === 'social' && (
                        <p className="px-4 text-lg leading-relaxed text-stone-800 md:text-xl">
                          {scene.author}发在朋友圈里
                        </p>
                      )
                    )}
                  </div>
                </main>

                <div className="flex-none border-t border-stone-200/70 px-6 py-3 sm:px-8">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="mb-1 flex items-baseline justify-between">
                        <span className="text-xs font-medium text-stone-600">
                          {paused ? '已暂停' : '正在轮播'} · 第 {safeIdx + 1} / {total} 条
                        </span>
                        <span className="text-[11px] text-stone-400">每 5 秒切换</span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-stone-200">
                        <div
                          className="h-full rounded-full bg-amber-500 transition-all"
                          style={{ width: `${((safeIdx + 0.5) / total) * 100}%` }}
                        />
                      </div>
                    </div>
                    <button
                      onClick={togglePause}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-700 transition hover:bg-stone-50 active:translate-y-px"
                      aria-label={paused ? '继续' : '暂停'}
                    >
                      {paused ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <rect x="6" y="5" width="4" height="14" rx="1" />
                          <rect x="14" y="5" width="4" height="14" rx="1" />
                        </svg>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-center">
                    <button
                      disabled={!canTalk && asr.status !== 'listening'}
                      onClick={() => {
                        if (asr.status === 'listening') stopListening()
                        else if (canTalk) startListening()
                      }}
                      className={`pulse-ring relative flex h-14 w-[min(380px,90%)] select-none items-center justify-center gap-3 rounded-full text-white shadow-lg transition active:translate-y-px ${
                        !canTalk && asr.status !== 'listening'
                          ? 'cursor-not-allowed bg-stone-400 shadow-stone-400/20'
                          : asr.status === 'listening'
                            ? 'scale-[1.02] bg-red-700 shadow-red-600/40'
                            : 'bg-red-600 shadow-red-600/30 hover:bg-red-700'
                      }`}
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="9" y="3" width="6" height="12" rx="3" />
                          <path d="M5 11a7 7 0 0 0 14 0" />
                          <path d="M12 18v3" />
                        </svg>
                      </span>
                      <div className="text-left leading-tight">
                        <div className="text-base font-bold tracking-tight">
                          {asr.status === 'listening' ? '点一下结束' : '点一下说话'}
                        </div>
                        <div className="text-[11px] opacity-90">{micHint}</div>
                      </div>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
