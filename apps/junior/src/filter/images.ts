export type ImageItem = {
  id: string
  url: string
  name: string
}

const modules = import.meta.glob(
  '../assets/images/*.{jpg,jpeg,png,webp,gif,avif,JPG,JPEG,PNG,WEBP,GIF,AVIF}',
  { eager: true, query: '?url', import: 'default' },
)

export function loadImages(): ImageItem[] {
  const entries = Object.entries(modules) as [string, string][]
  return entries
    .map(([path, url]) => {
      const name = path.split('/').pop() ?? path
      return { id: name, url, name }
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
}
