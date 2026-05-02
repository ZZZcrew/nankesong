// 补充接口 §5-§8:家书发布 + 今日 / 历史查询(接口文档未覆盖,按 spec §6 补齐)
import { USE_REAL_API, apiRequest, mockDelay } from './client'
import { loadImages } from '../filter/images'

// ==== 共享类型 ====

export type DiaryItem =
  | { item_id: string; type: 'image'; content: string } // content = image url
  | {
      item_id: string
      type: 'social'
      author: string
      time: string
      text: string
    }

export type Diary = {
  diary_id: string
  date: string
  title: string
  narration: string
  items: DiaryItem[]
  published_at: number
}

export type DiaryPreview = {
  diary_id: string
  date: string
  date_label: string // 'M 月 D 日 · 星期几',前端直接展示
  title: string
  narration_preview: string
  item_count: number
  thumbnail_url?: string
  published_at: number
}

// ==== 1. 发布日记 ====
// POST /api/v1/diary/publish

export type PublishDiaryInput = {
  summary_id: string
  user_id: string
  // mock-only:demo 阶段前端直接把筛出来的 items 塞过来。
  // 真实后端通过 raw_clips(visibility=visible) join summary 获取,发版前删掉这个字段。
  _mock_items?: DiaryItem[]
  _mock_title?: string
  _mock_narration?: string
  _mock_date?: string
}

export type PublishDiaryResult = {
  diary_id: string
  published_at: number
}

const LOCAL_TODAY_KEY = 'nks-diary'

export async function publishDiary(input: PublishDiaryInput): Promise<PublishDiaryResult> {
  if (USE_REAL_API) {
    return apiRequest<PublishDiaryResult>('/diary/publish', {
      method: 'POST',
      body: JSON.stringify({ summary_id: input.summary_id, user_id: input.user_id }),
    })
  }

  // Mock:把完整 Diary 写入 localStorage,同 origin 的长辈 tab 通过 storage 事件即时收到
  const diary_id = `d_${Date.now()}`
  const published_at = Math.floor(Date.now() / 1000)
  const diary: Diary = {
    diary_id,
    date: input._mock_date ?? new Date().toISOString().slice(0, 10),
    title: input._mock_title ?? '今日日记',
    narration: input._mock_narration ?? '',
    items: input._mock_items ?? [],
    published_at,
  }
  try {
    localStorage.setItem(LOCAL_TODAY_KEY, JSON.stringify(diary))
  } catch {
    // ignore
  }
  return mockDelay({ diary_id, published_at }, 300)
}

// ==== 2. 获取今日已发布日记(长辈端轮询) ====
// GET /api/v1/diary/today

export type FetchTodayInput = {
  user_id: string
}

export async function fetchTodayDiary(input: FetchTodayInput): Promise<Diary | null> {
  if (USE_REAL_API) {
    const qs = new URLSearchParams({ user_id: input.user_id })
    return apiRequest<Diary | null>(`/diary/today?${qs}`)
  }

  try {
    const raw = localStorage.getItem(LOCAL_TODAY_KEY)
    if (!raw) return mockDelay(null, 50)
    const parsed = JSON.parse(raw) as Diary
    if (!parsed || !Array.isArray(parsed.items)) return mockDelay(null, 50)
    return mockDelay(parsed, 50)
  } catch {
    return mockDelay(null, 50)
  }
}

// ==== 3. 历史日记列表 ====
// GET /api/v1/diary/history

export type FetchHistoryInput = {
  user_id: string
  limit?: number
}

export async function fetchDiaryHistory(
  input: FetchHistoryInput,
): Promise<{ diaries: DiaryPreview[] }> {
  if (USE_REAL_API) {
    const qs = new URLSearchParams({
      user_id: input.user_id,
      ...(input.limit ? { limit: String(input.limit) } : {}),
    })
    return apiRequest<{ diaries: DiaryPreview[] }>(`/diary/history?${qs}`)
  }

  // Mock:4 条过去的假日记,配本地 assets/images 作为缩略图
  const images = loadImages()
  const previews: DiaryPreview[] = [
    {
      diary_id: 'd_20260501',
      date: '2026-05-01',
      date_label: '5 月 1 日 · 星期五',
      title: '带小狗去了公园',
      narration_preview:
        '今天小明带着邻居家的狗去公园跑了一圈，狗追蝴蝶追得特别起劲……',
      item_count: 3,
      thumbnail_url: images[3]?.url,
      published_at: 1714550400,
    },
    {
      diary_id: 'd_20260430',
      date: '2026-04-30',
      date_label: '4 月 30 日 · 星期四',
      title: '加班到九点',
      narration_preview: '今天公司有个评审，小明加班到九点才回家……',
      item_count: 2,
      thumbnail_url: images[6]?.url,
      published_at: 1714464000,
    },
    {
      diary_id: 'd_20260429',
      date: '2026-04-29',
      date_label: '4 月 29 日 · 星期三',
      title: '午休去了趟书店',
      narration_preview:
        '中午小明溜去了公司旁边新开的书店，翻了一本关于烹饪的书……',
      item_count: 3,
      thumbnail_url: images[8]?.url,
      published_at: 1714377600,
    },
    {
      diary_id: 'd_20260428',
      date: '2026-04-28',
      date_label: '4 月 28 日 · 星期二',
      title: '下班和同事吃烧烤',
      narration_preview:
        '下班和几个同事去吃了顿烧烤，聊到很晚，有个同事说下个月要结婚了……',
      item_count: 2,
      thumbnail_url: images[10]?.url,
      published_at: 1714291200,
    },
  ]
  return mockDelay({ diaries: previews.slice(0, input.limit ?? 20) })
}

// ==== 4. 历史日记详情 ====
// GET /api/v1/diary/:diary_id

export async function fetchDiary(diary_id: string): Promise<Diary> {
  if (USE_REAL_API) {
    return apiRequest<Diary>(`/diary/${encodeURIComponent(diary_id)}`)
  }

  // Mock:根据 diary_id 返回不同的假完整日记
  const images = loadImages()
  const pick = (n: number, offset: number): DiaryItem[] =>
    images.slice(offset, offset + n).map((it) => ({
      item_id: it.id,
      type: 'image' as const,
      content: it.url,
    }))

  const DIARY_BANK: Record<string, Diary> = {
    d_20260501: {
      diary_id: 'd_20260501',
      date: '2026-05-01',
      title: '带小狗去了公园',
      narration:
        '今天小明带着邻居家的狗去公园跑了一圈，狗追蝴蝶追得特别起劲。路过卖烤红薯的小摊，买了一个坐在长椅上慢慢吃。妈妈，他今天挺开心的。',
      items: pick(3, 3),
      published_at: 1714550400,
    },
    d_20260430: {
      diary_id: 'd_20260430',
      date: '2026-04-30',
      title: '加班到九点',
      narration:
        '今天公司有个评审，小明加班到九点才回家。路上买了一份烤鱼当晚饭，回去洗了个澡就睡了。他说这周忙完就有空回家看您。',
      items: pick(2, 6),
      published_at: 1714464000,
    },
    d_20260429: {
      diary_id: 'd_20260429',
      date: '2026-04-29',
      title: '午休去了趟书店',
      narration:
        '中午小明溜去了公司旁边新开的书店，翻了一本关于烹饪的书，想回家试着做您教他的红烧肉。他还拍了一张书店的照片，说是装修和他大学时常去的那家一模一样。',
      items: [
        ...pick(2, 8),
        {
          item_id: 'soc-past-1',
          type: 'social' as const,
          author: '小明',
          time: '4 月 29 日 · 12:45',
          text: '被一家新开的书店救了午休。',
        },
      ],
      published_at: 1714377600,
    },
    d_20260428: {
      diary_id: 'd_20260428',
      date: '2026-04-28',
      title: '下班和同事吃烧烤',
      narration:
        '下班和几个同事去吃了顿烧烤，聊到很晚，有个同事说下个月要结婚了。小明喝了一点啤酒，答应明天早点起。',
      items: pick(2, 10),
      published_at: 1714291200,
    },
  }

  const data = DIARY_BANK[diary_id]
  if (!data) throw new Error(`diary ${diary_id} not found`)
  return mockDelay(data)
}
