export type ElderMessage = {
  id: string
  time: string
  question: string // 长辈通过语音说的问题/留言
  reply?: string // AI/后端已代为回复的内容
  unread?: boolean
}

export function loadElderMessages(): ElderMessage[] {
  return [
    {
      id: 'm-1',
      time: '今天 20:14',
      question: '小明啊，今天工作忙吗？饭都按时吃了吗？',
      reply: '妈妈，他今天去南山散步了，和朋友吃了火锅，晚上还买了一袋橘子，您放心。',
      unread: true,
    },
    {
      id: 'm-2',
      time: '今天 09:02',
      question: '今年端午放假回来吗？我给你包粽子。',
      unread: true,
    },
    {
      id: 'm-3',
      time: '昨天 21:47',
      question: '上次你说的那个新书店在哪里呀？我让你爸去看看。',
      reply: '妈妈，他说是在公司楼下地铁站出口右手边第二家，店名叫"十月书房"。',
    },
    {
      id: 'm-4',
      time: '前天 18:35',
      question: '天气凉了，记得加衣服。',
    },
    {
      id: 'm-5',
      time: '4 月 29 日',
      question: '我看你这几天加班到很晚，身体要紧，别太拼。',
      reply: '妈妈，他今天评审已经过了，接下来几天会早点下班回家休息。',
    },
  ]
}
