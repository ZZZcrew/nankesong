import type { FeedItem } from '../filter/images'

export type NarrationInput = {
  date: string
  title: string
  items: FeedItem[]
}

export type NarrationResult = {
  text: string
}

// TODO(backend): 替换为 fetch('/api/diary/narration', { method: 'POST', body: JSON.stringify(input) }).then(r => r.json())
// 请保持返回签名 { text: string } 不变。失败时 throw 即可，调用方已做 fallback。
export async function generateNarration(_input: NarrationInput): Promise<NarrationResult> {
  await new Promise((r) => setTimeout(r, 300))
  return {
    text:
      '今天下午五点多，小明和同事走到南山脚下散步，秋风吹得人很舒服。' +
      '走到山腰的观景台时，城里的灯正一盏一盏亮起来，远远看像一条发光的带子。' +
      '晚饭他和朋友去了山下的老店，点了一锅热气腾腾的火锅，两个人一直聊到很晚。' +
      '回家路上他经过一个水果摊，顺手买了一袋橘子，说是明天带去办公室分给大家。' +
      '妈妈，他今天过得挺好的，您放心。',
  }
}
