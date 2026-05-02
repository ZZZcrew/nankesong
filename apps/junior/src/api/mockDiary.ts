// 纯前端 mock 日记,用于在后端还没接入时快速测试长辈端 TTS/字幕链路
// 直接写入 localStorage 后触发 storage 事件,SeniorView 会自动刷新

import type { FeedItem } from '../filter/images'

const STORAGE_KEY = 'nks-diary'

const MOCK_NARRATION =
  '今天下午五点多，小明和同事走到南山脚下散步，秋风吹得人很舒服。' +
  '走到山腰的观景台时，城里的灯正一盏一盏亮起来，远远看像一条发光的带子。' +
  '晚饭他和朋友去了山下的老店，点了一锅热气腾腾的火锅，两个人一直聊到很晚。' +
  '回家路上他经过一个水果摊，顺手买了一袋橘子，说是明天带去办公室分给大家。' +
  '妈妈，他今天过得挺好的，您放心。'

const MOCK_DIARY = {
  date: '2026 年 5 月 2 日 · 星期六',
  title: '小明在南山散步的一天',
  publishedAt: Date.now(),
  narration: MOCK_NARRATION,
  items: [] as Array<Pick<FeedItem, 'kind' | 'id'> & Record<string, string>>,
}

// 从 assets/images/ 里挑前几张作为图片素材。没有就走空数组(字幕 + TTS 仍能跑)。
async function collectMockItems() {
  try {
    const mods = import.meta.glob(
      '../assets/images/*.{jpg,jpeg,png,webp,gif,avif,JPG,JPEG,PNG,WEBP,GIF,AVIF}',
      { eager: true, query: '?url', import: 'default' },
    )
    const entries = Object.entries(mods) as [string, string][]
    return entries.slice(0, 3).map(([path, url], i) => {
      const name = path.split('/').pop() ?? `mock-${i}`
      return { kind: 'image', id: name, url }
    })
  } catch {
    return []
  }
}

export async function loadMockDiary() {
  const items = await collectMockItems()
  const diary = {
    ...MOCK_DIARY,
    publishedAt: Date.now(),
    items: items.length > 0 ? items : [{ kind: 'image', id: 'mock', url: '' }],
  }
  const payload = JSON.stringify(diary)
  localStorage.setItem(STORAGE_KEY, payload)
  // 同一个 tab 写 localStorage 不会触发 storage 事件,手动派一次
  window.dispatchEvent(
    new StorageEvent('storage', {
      key: STORAGE_KEY,
      newValue: payload,
      storageArea: localStorage,
    }),
  )
}
