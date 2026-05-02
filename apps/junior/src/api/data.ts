// 接口文档 §1, §2:当日原始数据 获取 + 剔除
import { USE_REAL_API, apiRequest, mockDelay } from './client'
import { loadFeed } from '../filter/images'

export type RawItem = {
  item_id: string
  type: 'image' | 'video' | 'text'
  content: string // 图片/视频 URL;若是纯文本则为文本本身
  description: string
  timestamp: string // Unix 秒
}

export type FetchRawDataInput = {
  date: string // YYYY-MM-DD
  user_id?: string
}

export type FetchRawDataResult = {
  date: string
  items: RawItem[]
}

// GET /api/v1/data/raw
export async function fetchRawData(input: FetchRawDataInput): Promise<FetchRawDataResult> {
  if (USE_REAL_API) {
    const qs = new URLSearchParams({ date: input.date, ...(input.user_id ? { user_id: input.user_id } : {}) })
    return apiRequest<FetchRawDataResult>(`/data/raw?${qs}`)
  }

  // Mock:直接用本地 assets/images 和硬编码朋友圈数据拼成 raw items
  const feed = loadFeed()
  const items: RawItem[] = feed.map((it, idx) => {
    if (it.kind === 'image') {
      return {
        item_id: it.id,
        type: 'image' as const,
        content: it.url,
        description: '',
        timestamp: String(Math.floor(Date.now() / 1000) - idx * 600),
      }
    }
    return {
      item_id: it.id,
      type: 'text' as const,
      content: it.text,
      description: `${it.author} · ${it.time}`,
      timestamp: String(Math.floor(Date.now() / 1000) - idx * 600),
    }
  })
  return mockDelay({ date: input.date, items })
}

export type DeleteRawInput = {
  item_ids: string[]
  user_id: string
}

export type DeleteRawResult = {
  deleted_count: number
}

// POST /api/v1/data/raw/delete
export async function deleteRawItems(input: DeleteRawInput): Promise<DeleteRawResult> {
  if (USE_REAL_API) {
    return apiRequest<DeleteRawResult>('/data/raw/delete', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }
  // Mock:纯前端删除已在筛图页处理,这里只回执一个计数
  return mockDelay({ deleted_count: input.item_ids.length })
}
