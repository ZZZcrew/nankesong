// 纯前端 mock 日记种子,用于在后端还没接入时快速测试长辈端 TTS/字幕链路
// 走和 AuditPage 相同的 publishDiary 入口,保证写入 localStorage 的 shape 一致

import { loadImages } from '../filter/images'
import { publishDiary, type DiaryItem } from './diary'
import { JUNIOR_USER_ID } from './client'

const MOCK_NARRATION =
  '今天下午五点多，小明和同事走到南山脚下散步，秋风吹得人很舒服。' +
  '走到山腰的观景台时，城里的灯正一盏一盏亮起来，远远看像一条发光的带子。' +
  '晚饭他和朋友去了山下的老店，点了一锅热气腾腾的火锅，两个人一直聊到很晚。' +
  '回家路上他经过一个水果摊，顺手买了一袋橘子，说是明天带去办公室分给大家。' +
  '妈妈，他今天过得挺好的，您放心。'

function buildMockItems(): DiaryItem[] {
  const images = loadImages().slice(0, 3)
  if (images.length === 0) {
    // 没本地图片也得能跑
    return [{ item_id: 'mock-placeholder', type: 'image', content: '' }]
  }
  return images.map((it) => ({ item_id: it.id, type: 'image' as const, content: it.url }))
}

export async function loadMockDiary() {
  const items = buildMockItems()
  await publishDiary({
    summary_id: `sum_mock_${Date.now()}`,
    user_id: JUNIOR_USER_ID,
    _mock_items: items,
    _mock_title: '小明在南山散步的一天',
    _mock_narration: MOCK_NARRATION,
    _mock_date: new Date().toISOString().slice(0, 10),
  })
  // publishDiary 里会 localStorage.setItem,但同 tab 不触发 storage 事件,手动派一次
  const raw = localStorage.getItem('nks-diary')
  if (raw) {
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'nks-diary',
        newValue: raw,
        storageArea: localStorage,
      }),
    )
  }
}
