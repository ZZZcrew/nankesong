// 接口文档 §1:获取当日原始数据
//
// 当后端就绪:
//   1. 把 USE_REAL_API 改为 true
//   2. 删掉 mockFetchRawData 函数及其相关 import 即可,fetchRawData 会走真实 HTTP

import { loadImages, loadSocials } from '../filter/images'

const BASE_URL = 'http://192.168.188.244:8000/api/v1'
const USE_REAL_API = true

export type RawItem = {
  item_id: string
  type: 'image' | 'video' | 'text'
  content: string // 图片/视频 URL;若是 text 则为文本本身
  description: string // 原始描述/配文,纯文本可为空字符串
  timestamp: string // Unix 秒,字符串
}

export type FetchRawDataInput = {
  date: string // YYYY-MM-DD,必填
  user_id?: string // 选填
}

export type FetchRawDataResult = {
  date: string
  items: RawItem[]
}

type ApiResponse<T> = {
  code: number
  message: string
  data: T
}

export async function fetchRawData(input: FetchRawDataInput): Promise<FetchRawDataResult> {
  if (USE_REAL_API) {
    const qs = new URLSearchParams({
      date: input.date,
      ...(input.user_id ? { user_id: input.user_id } : {}),
    })
    const res = await fetch(`${BASE_URL}/data/raw?${qs}`, {
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = (await res.json()) as ApiResponse<FetchRawDataResult>
    if (json.code !== 200) throw new Error(json.message || 'unknown error')
    return json.data
  }
  return mockFetchRawData(input)
}

// ============== 以下为 mock 实现,接真实后端时可整段删除 ==============

async function mockFetchRawData(input: FetchRawDataInput): Promise<FetchRawDataResult> {
  await new Promise((r) => setTimeout(r, 300)) // 模拟网络延迟

  const now = Math.floor(Date.now() / 1000)
  const images = loadImages()
  const socials = loadSocials()

  const items: RawItem[] = [
    ...images.map((img, idx) => ({
      item_id: img.id,
      type: 'image' as const,
      content: img.url,
      description: '',
      timestamp: String(now - idx * 600),
    })),
    ...socials.map((soc, idx) => ({
      item_id: soc.id,
      type: 'text' as const,
      content: soc.text,
      // 把 author 和 time 编进 description,前端转换时再拆出来。
      // 这是 demo 用的简化处理,真实接口可以扩展 RawItem schema 加 author/time 字段。
      description: `${soc.author} | ${soc.time}`,
      timestamp: String(now - (images.length + idx) * 600),
    })),
  ]

  return { date: input.date, items }
}
