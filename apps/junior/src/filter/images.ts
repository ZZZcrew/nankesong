export type ImageItem = {
  kind: 'image'
  id: string
  url: string
  name: string
}

export type SocialItem = {
  kind: 'social'
  id: string
  author: string
  time: string
  text: string
}

export type FeedItem = ImageItem | SocialItem

const modules = import.meta.glob(
  '../assets/images/*.{jpg,jpeg,png,webp,gif,avif,JPG,JPEG,PNG,WEBP,GIF,AVIF}',
  { eager: true, query: '?url', import: 'default' },
)

export function loadImages(): ImageItem[] {
  const entries = Object.entries(modules) as [string, string][]
  return entries
    .map(([path, url]) => {
      const name = path.split('/').pop() ?? path
      return { kind: 'image' as const, id: name, url, name }
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
}

// mock 的朋友圈抓取结果（demo 用，真做时替换为拉取接口）
export function loadSocials(): SocialItem[] {
  return [
    {
      kind: 'social',
      id: 'soc-1',
      author: '小明',
      time: '今天 19:32',
      text: '下班和同事去爬了南山，山顶的灯一片一片亮起来，像撒了糖。',
    },
    {
      kind: 'social',
      id: 'soc-2',
      author: '小明',
      time: '昨天 21:14',
      text: '试了家新开的面馆，汤头出乎意料地好，想带妈妈来尝尝。',
    },
    {
      kind: 'social',
      id: 'soc-3',
      author: '老王',
      time: '今天 10:22',
      text: '小明最近总加班，周末我强行拉他去打了一场羽毛球。',
    },
    {
      kind: 'social',
      id: 'soc-4',
      author: '小明',
      time: '今天 23:47',
      text: '在小区里看到一只特别胖的狸花猫，想拍给妈妈，一晃它就跑了。',
    },
  ]
}

// 混合图片和朋友圈，按 id 排序以保证稳定
export function loadFeed(): FeedItem[] {
  const mixed: FeedItem[] = [...loadImages(), ...loadSocials()]
  // 按 id 字典序稳定排序，这样 image/social 会自然交错
  return mixed.sort((a, b) => a.id.localeCompare(b.id))
}
