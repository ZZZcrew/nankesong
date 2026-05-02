// 接口文档 §3 §4:Agent 摘要生成 + 长辈对话
// POST http://192.168.188.244:8000/api/v1/agent/generate-summary
// POST http://192.168.188.244:8000/api/v1/agent/chat

const BASE_URL = 'http://192.168.188.244:8000/api/v1'

// ============== §3 generate-summary ==============

export type GenerateSummaryInput = {
  date: string // YYYY-MM-DD
  user_id: string
}

export type GenerateSummaryResult = {
  summary_id: string
  title: string
  content: string // 整段家书正文
  cover_image: string[] // AI 挑选的封面图 URL 列表
  suggested_questions: string[] // 给长辈相框上的预设问题按钮
}

type ApiResponse<T> = {
  code: number
  message: string
  data: T
}

export async function generateSummary(
  input: GenerateSummaryInput,
): Promise<GenerateSummaryResult> {
  const res = await fetch(`${BASE_URL}/agent/generate-summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = (await res.json()) as ApiResponse<GenerateSummaryResult>
  if (json.code !== 200) throw new Error(json.message || 'unknown error')
  return json.data
}

// ============== §4 chat ==============

export type ChatInput = {
  query: string // 长辈说的话(ASR 结果)
  summary_id: string // 当前展示的家书 ID,让 Agent 知道上下文
}

export type ChatResult = {
  reply_text: string // 给 TTS 播报 + 字幕用
  action: 'reply' | 'notify_younger' // notify_younger=后端已生成给小辈的关怀通知
}

export async function chatWithAgent(input: ChatInput): Promise<ChatResult> {
  const res = await fetch(`${BASE_URL}/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = (await res.json()) as ApiResponse<ChatResult>
  if (json.code !== 200) throw new Error(json.message || 'unknown error')
  return json.data
}

