// 接口文档 §3:Agent 摘要生成
// POST http://192.168.188.244:8000/api/v1/agent/generate-summary
// Body: { date, user_id }
// Returns: { summary_id, title, content, cover_image[], suggested_questions[] }
//
// 触发时机:小辈在筛选页点"进入下一步"按钮时,把后端剩余的(visibility=visible)素材
// 喂给 LLM 生成今日家书,前端拿到结果后渲染到预览发送页

const BASE_URL = 'http://192.168.188.244:8000/api/v1'

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
