'use client'

import { useEffect, useRef } from 'react'
import { ForceSimulation } from './forceSimulation'
import { FILE_TYPE_COLORS, type GraphNode, type KnowledgeGraphData } from './types'

interface GraphCanvasProps {
  data: KnowledgeGraphData
  search: string
  selectedId: string | null
  onSelect: (node: GraphNode | null) => void
  onHover: (node: GraphNode | null) => void
}

interface Camera {
  scale: number
  offsetX: number
  offsetY: number
}

export default function GraphCanvas({ data, search, selectedId, onSelect, onHover }: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const searchRef = useRef(search)
  const selectedRef = useRef(selectedId)
  searchRef.current = search
  selectedRef.current = selectedId

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const { nodes, links } = data
    const sim = new ForceSimulation(nodes, links)
    const index = new Map(nodes.map((n, i) => [n.id, i]))
    const neighbors: Set<number>[] = nodes.map(() => new Set<number>())
    for (const link of links) {
      const a = index.get(link.source)
      const b = index.get(link.target)
      if (a === undefined || b === undefined) continue
      neighbors[a].add(b)
      neighbors[b].add(a)
    }

    const cam: Camera = { scale: 1, offsetX: 0, offsetY: 0 }
    let fitted = false
    const dpr = window.devicePixelRatio || 1

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = canvas
      canvas.width = w * dpr
      canvas.height = h * dpr
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const fit = () => {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (let i = 0; i < sim.count; i++) {
        minX = Math.min(minX, sim.x[i]); maxX = Math.max(maxX, sim.x[i])
        minY = Math.min(minY, sim.y[i]); maxY = Math.max(maxY, sim.y[i])
      }
      const w = canvas.width / dpr
      const h = canvas.height / dpr
      const spanX = maxX - minX || 1
      const spanY = maxY - minY || 1
      cam.scale = Math.min(w / spanX, h / spanY) * 0.85
      cam.offsetX = w / 2 - ((minX + maxX) / 2) * cam.scale
      cam.offsetY = h / 2 - ((minY + maxY) / 2) * cam.scale
    }

    const toWorld = (sx: number, sy: number) => ({
      x: (sx - cam.offsetX) / cam.scale,
      y: (sy - cam.offsetY) / cam.scale,
    })

    const pick = (sx: number, sy: number): number | null => {
      const { x: wx, y: wy } = toWorld(sx, sy)
      let best = -1
      let bestDist = Infinity
      for (let i = 0; i < sim.count; i++) {
        const dx = sim.x[i] - wx
        const dy = sim.y[i] - wy
        const d = dx * dx + dy * dy
        const r = sim.nodeRadius(i) + 4
        if (d < r * r && d < bestDist) {
          bestDist = d
          best = i
        }
      }
      return best === -1 ? null : best
    }

    const activeSet = (): Set<number> | null => {
      const q = searchRef.current.trim().toLowerCase()
      if (q) {
        const matched = new Set<number>()
        nodes.forEach((n, i) => {
          if (n.label.toLowerCase().includes(q) || n.sourceFile.toLowerCase().includes(q)) {
            matched.add(i)
          }
        })
        return matched
      }
      if (selectedRef.current) {
        const i = index.get(selectedRef.current)
        if (i === undefined) return null
        return new Set<number>([i, ...neighbors[i]])
      }
      return null
    }

    const draw = () => {
      const w = canvas.width / dpr
      const h = canvas.height / dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(0, 0, w, h)
      ctx.setTransform(dpr * cam.scale, 0, 0, dpr * cam.scale, dpr * cam.offsetX, dpr * cam.offsetY)

      const active = activeSet()

      ctx.lineWidth = 0.6 / cam.scale
      for (const link of links) {
        const a = index.get(link.source)
        const b = index.get(link.target)
        if (a === undefined || b === undefined) continue
        const lit = !active || (active.has(a) && active.has(b))
        ctx.strokeStyle = lit ? 'rgba(148,163,184,0.35)' : 'rgba(148,163,184,0.05)'
        ctx.beginPath()
        ctx.moveTo(sim.x[a], sim.y[a])
        ctx.lineTo(sim.x[b], sim.y[b])
        ctx.stroke()
      }

      for (let i = 0; i < sim.count; i++) {
        const lit = !active || active.has(i)
        ctx.globalAlpha = lit ? 1 : 0.12
        ctx.fillStyle = FILE_TYPE_COLORS[nodes[i].fileType] ?? '#94a3b8'
        ctx.beginPath()
        ctx.arc(sim.x[i], sim.y[i], sim.nodeRadius(i), 0, Math.PI * 2)
        ctx.fill()
        if (lit && active) {
          ctx.lineWidth = 1.2 / cam.scale
          ctx.strokeStyle = '#f8fafc'
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1
    }

    let raf = 0
    const loop = () => {
      for (let s = 0; s < 2; s++) sim.tick()
      if (!fitted && sim.count > 0) {
        fit()
        fitted = true
      }
      draw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    // Interaction ----------------------------------------------------------
    let dragging = false
    let lastX = 0
    let lastY = 0
    let moved = false

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const before = toWorld(sx, sy)
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      cam.scale = Math.max(0.05, Math.min(8, cam.scale * factor))
      cam.offsetX = sx - before.x * cam.scale
      cam.offsetY = sy - before.y * cam.scale
    }
    const onDown = (e: PointerEvent) => {
      dragging = true
      moved = false
      lastX = e.clientX
      lastY = e.clientY
      canvas.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      if (dragging) {
        const dx = e.clientX - lastX
        const dy = e.clientY - lastY
        if (Math.abs(dx) + Math.abs(dy) > 2) moved = true
        cam.offsetX += dx
        cam.offsetY += dy
        lastX = e.clientX
        lastY = e.clientY
      } else {
        const hit = pick(sx, sy)
        canvas.style.cursor = hit === null ? 'grab' : 'pointer'
        onHover(hit === null ? null : nodes[hit])
      }
    }
    const onUp = (e: PointerEvent) => {
      if (dragging && !moved) {
        const rect = canvas.getBoundingClientRect()
        const hit = pick(e.clientX - rect.left, e.clientY - rect.top)
        onSelect(hit === null ? null : nodes[hit])
        if (hit !== null) sim.reheat()
      }
      dragging = false
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointerleave', () => onHover(null))

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
    }
  }, [data, onHover, onSelect])

  return <canvas ref={canvasRef} className="h-full w-full touch-none select-none" style={{ cursor: 'grab' }} />
}
