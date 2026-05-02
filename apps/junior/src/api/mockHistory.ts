import { loadImages } from '../filter/images'

export type HistoryImageItem = { kind: 'image'; id: string; url: string; name: string }
export type HistorySocialItem = {
  kind: 'social'
  id: string
  author: string
  time: string
  text: string
}
export type HistoryItem = HistoryImageItem | HistorySocialItem

export type HistoryDiary = {
  id: string
  date: string
  dateLabel: string // '5 月 1 日 · 星期五'
  title: string
  narration: string
  items: HistoryItem[]
  itemCount: number
  thumbnailUrl?: string
}

export function loadHistoryDiaries(): HistoryDiary[] {
  const images = loadImages()
  const pick = (n: number, offset: number): HistoryImageItem[] =>
    images.slice(offset, offset + n).map((it) => ({
      kind: 'image',
      id: it.id,
      url: it.url,
      name: it.name,
    }))

  return [
    {
      id: 'h-20260501',
      date: '2026-05-01',
      dateLabel: '5 月 1 日 · 星期五',
      title: '带小狗去了公园',
      narration:
        '今天小明带着邻居家的狗去公园跑了一圈，狗追蝴蝶追得特别起劲。路过卖烤红薯的小摊，买了一个坐在长椅上慢慢吃。妈妈，他今天挺开心的。',
      items: pick(3, 3),
      itemCount: 3,
      thumbnailUrl: pick(1, 3)[0]?.url,
    },
    {
      id: 'h-20260430',
      date: '2026-04-30',
      dateLabel: '4 月 30 日 · 星期四',
      title: '加班到九点',
      narration:
        '今天公司有个评审，小明加班到九点才回家。路上买了一份烤鱼当晚饭，回去洗了个澡就睡了。他说这周忙完就有空回家看您。',
      items: pick(2, 6),
      itemCount: 2,
      thumbnailUrl: pick(1, 6)[0]?.url,
    },
    {
      id: 'h-20260429',
      date: '2026-04-29',
      dateLabel: '4 月 29 日 · 星期三',
      title: '午休去了趟书店',
      narration:
        '中午小明溜去了公司旁边新开的书店，翻了一本关于烹饪的书，想回家试着做您教他的红烧肉。他还拍了一张书店的照片，说是装修和他大学时常去的那家一模一样。',
      items: [
        ...pick(2, 8),
        {
          kind: 'social' as const,
          id: 'soc-past-1',
          author: '小明',
          time: '4 月 29 日 · 12:45',
          text: '被一家新开的书店救了午休。',
        },
      ],
      itemCount: 3,
      thumbnailUrl: pick(1, 8)[0]?.url,
    },
    {
      id: 'h-20260428',
      date: '2026-04-28',
      dateLabel: '4 月 28 日 · 星期二',
      title: '下班和同事吃烧烤',
      narration:
        '下班和几个同事去吃了顿烧烤，聊到很晚，有个同事说下个月要结婚了。小明喝了一点啤酒，答应明天早点起。',
      items: pick(2, 10),
      itemCount: 2,
      thumbnailUrl: pick(1, 10)[0]?.url,
    },
  ]
}
