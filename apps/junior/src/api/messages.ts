// 补充接口 §9-§10:长辈留言列表 + 标记已读
// 长辈留言是 /agent/chat 中 action=notify_younger 和用户提问+AI 代答产生的消息落库
import { USE_REAL_API, apiRequest, mockDelay } from './client'

export type Message = {
  message_id: string
  time: string // 'M 月 D 日' 或 '今天 HH:mm',后端可直接给前端展示串
  question: string
  ai_reply?: string
  unread: boolean
  diary_id?: string // 若提问关联到某天的日记,回跳用
}

export type FetchMessagesInput = {
  user_id: string
  limit?: number
}

export type FetchMessagesResult = {
  unread_count: number
  messages: Message[]
}

// GET /api/v1/messages
export async function fetchMessages(
  input: FetchMessagesInput,
): Promise<FetchMessagesResult> {
  if (USE_REAL_API) {
    const qs = new URLSearchParams({
      user_id: input.user_id,
      ...(input.limit ? { limit: String(input.limit) } : {}),
    })
    return apiRequest<FetchMessagesResult>(`/messages?${qs}`)
  }

  const messages: Message[] = [
    {
      message_id: 'm_001',
      time: '今天 20:14',
      question: '小明啊，今天工作忙吗？饭都按时吃了吗？',
      ai_reply:
        '妈妈，他今天去南山散步了，和朋友吃了火锅，晚上还买了一袋橘子，您放心。',
      unread: true,
    },
    {
      message_id: 'm_002',
      time: '今天 09:02',
      question: '今年端午放假回来吗？我给你包粽子。',
      unread: true,
    },
    {
      message_id: 'm_003',
      time: '昨天 21:47',
      question: '上次你说的那个新书店在哪里呀？我让你爸去看看。',
      ai_reply:
        '妈妈，他说是在公司楼下地铁站出口右手边第二家，店名叫"十月书房"。',
      unread: false,
    },
    {
      message_id: 'm_004',
      time: '前天 18:35',
      question: '天气凉了，记得加衣服。',
      unread: false,
    },
    {
      message_id: 'm_005',
      time: '4 月 29 日',
      question: '我看你这几天加班到很晚，身体要紧，别太拼。',
      ai_reply: '妈妈，他今天评审已经过了，接下来几天会早点下班回家休息。',
      unread: false,
    },
  ]
  const unread_count = messages.filter((m) => m.unread).length
  return mockDelay(
    { unread_count, messages: messages.slice(0, input.limit ?? messages.length) },
    200,
  )
}

export type MarkMessagesReadInput = {
  message_ids: string[]
  user_id: string
}

export type MarkMessagesReadResult = {
  marked_count: number
}

// POST /api/v1/messages/read
export async function markMessagesRead(
  input: MarkMessagesReadInput,
): Promise<MarkMessagesReadResult> {
  if (USE_REAL_API) {
    return apiRequest<MarkMessagesReadResult>('/messages/read', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }
  return mockDelay({ marked_count: input.message_ids.length }, 100)
}
