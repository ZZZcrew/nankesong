// 接口文档 §3, §4:Agent 家书生成 + 对话
import { USE_REAL_API, apiRequest, mockDelay } from './client'

export type GenerateSummaryInput = {
  date: string
  user_id: string
}

export type GenerateSummaryResult = {
  summary_id: string
  title: string
  content: string // 家书正文(一整段小作文)
  cover_image: string[]
  suggested_questions: string[]
}

// POST /api/v1/agent/generate-summary
export async function generateSummary(
  input: GenerateSummaryInput,
): Promise<GenerateSummaryResult> {
  if (USE_REAL_API) {
    return apiRequest<GenerateSummaryResult>('/agent/generate-summary', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  // Mock:返回固定小作文(5 句),summary_id 用时间戳保证唯一
  return mockDelay(
    {
      summary_id: `sum_${Date.now()}`,
      title: '小明在南山散步的一天',
      content:
        '今天下午五点多，小明和同事走到南山脚下散步，秋风吹得人很舒服。' +
        '走到山腰的观景台时，城里的灯正一盏一盏亮起来，远远看像一条发光的带子。' +
        '晚饭他和朋友去了山下的老店，点了一锅热气腾腾的火锅，两个人一直聊到很晚。' +
        '回家路上他经过一个水果摊，顺手买了一袋橘子，说是明天带去办公室分给大家。' +
        '妈妈，他今天过得挺好的，您放心。',
      cover_image: [],
      suggested_questions: [
        '今天和谁一起吃的火锅呀？',
        '最近工作忙不忙，身体还好吗？',
      ],
    },
    400,
  )
}

export type ChatInput = {
  query: string
  summary_id: string
}

export type ChatResult = {
  reply_text: string
  action: 'reply' | 'notify_younger'
  message_id?: string // 若 action=notify_younger,后端落库后返回消息 ID(扩展字段)
}

// POST /api/v1/agent/chat
export async function chatWithAgent(input: ChatInput): Promise<ChatResult> {
  if (USE_REAL_API) {
    return apiRequest<ChatResult>('/agent/chat', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  // Mock:简单拼接用户问的话
  const q = input.query.trim()
  if (!q) {
    return mockDelay({
      reply_text: '妈妈，我刚才没听清您说什么，您再说一遍好吗？',
      action: 'reply' as const,
    })
  }
  return mockDelay(
    {
      reply_text: `妈妈，我刚才听到您说，${q}。等小明回来，我把这个问题转告他，让他再写一封信给您。`,
      action: 'reply' as const,
    },
    500,
  )
}
