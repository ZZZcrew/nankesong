import { useEffect, useMemo, useRef } from 'react'
import { useSprings, animated, to } from '@react-spring/web'
import { useDrag } from '@use-gesture/react'
import type { ImageItem } from './images'

type Props = {
  queue: ImageItem[]
  onKeep: (item: ImageItem) => void
  onTrash: (item: ImageItem) => void
}

const VISIBLE = 3

type CardStyle = {
  x: number
  y: number
  rot: number
  scale: number
  opacity: number
}

const stackStyle = (i: number): CardStyle => ({
  x: 0,
  y: i * -8,
  rot: 0,
  scale: 1 - i * 0.04,
  opacity: i < VISIBLE ? 1 : 0,
})

export default function Deck({ queue, onKeep, onTrash }: Props) {
  const items = useMemo(() => queue.slice(0, VISIBLE), [queue])
  const goneRef = useRef<Set<string>>(new Set())

  const [springs, api] = useSprings(items.length, (i) => ({
    ...stackStyle(i),
    config: { tension: 300, friction: 30 },
  }))

  useEffect(() => {
    goneRef.current = new Set()
    api.start((i) => ({
      from: stackStyle(i + 1),
      to: stackStyle(i),
      config: { tension: 300, friction: 30 },
    }))
  }, [items, api])

  const bind = useDrag(
    ({ args: [id], active, movement: [mx, my], velocity: [vx, vy], direction: [dx, dy] }) => {
      if (goneRef.current.has(id)) return

      const THRESH_X = 100
      const THRESH_Y = 100
      const V_THRESH = 0.5

      const swipeRight = !active && (mx > THRESH_X || (vx > V_THRESH && dx > 0))
      const swipeLeft = !active && (mx < -THRESH_X || (vx > V_THRESH && dx < 0))
      const swipeUp = !active && (my < -THRESH_Y || (vy > V_THRESH && dy < 0))

      api.start((i) => {
        if (items[i]?.id !== id) return
        if (swipeUp) {
          goneRef.current.add(id)
          return {
            x: 0,
            y: -window.innerHeight * 1.2,
            rot: 0,
            scale: 0.9,
            opacity: 0,
            config: { tension: 220, friction: 28 },
            onRest: () => onTrash(items[i]),
          }
        }
        if (swipeRight || swipeLeft) {
          goneRef.current.add(id)
          const dir = swipeRight ? 1 : -1
          return {
            x: dir * window.innerWidth * 1.2,
            y: my,
            rot: dir * 20,
            scale: 0.95,
            opacity: 0,
            config: { tension: 220, friction: 28 },
            onRest: () => onKeep(items[i]),
          }
        }
        if (active) {
          return {
            x: mx,
            y: my,
            rot: mx / 12,
            scale: 1.03,
            opacity: 1,
            immediate: (key) => key === 'x' || key === 'y' || key === 'rot',
          }
        }
        return { ...stackStyle(i), immediate: false }
      })
    },
    { filterTaps: true, pointer: { touch: true } },
  )

  return (
    <div className="deck">
      {springs.map((style, i) => {
        const item = items[i]
        if (!item) return null
        const isTop = i === 0
        return (
          <animated.div
            key={item.id}
            className="card"
            style={{
              zIndex: items.length - i,
              opacity: style.opacity,
              transform: to(
                [style.x, style.y, style.rot, style.scale],
                (x, y, r, s) => `translate3d(${x}px, ${y}px, 0) rotate(${r}deg) scale(${s})`,
              ),
            }}
            {...(isTop ? bind(item.id) : {})}
          >
            <img src={item.url} alt={item.name} draggable={false} />
            {isTop && (
              <>
                <animated.span
                  className="label keep"
                  style={{ opacity: style.x.to((x) => Math.max(0, Math.min(1, x / 100))) }}
                >
                  保留
                </animated.span>
                <animated.span
                  className="label trash"
                  style={{ opacity: style.y.to((y) => Math.max(0, Math.min(1, -y / 100))) }}
                >
                  删除
                </animated.span>
              </>
            )}
          </animated.div>
        )
      })}
    </div>
  )
}
