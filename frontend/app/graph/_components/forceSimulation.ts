import type { GraphLink, GraphNode } from './types'

interface EdgeIndex {
  a: number
  b: number
}

/**
 * Lightweight force-directed layout engine running over parallel typed arrays.
 * Repulsion is approximated with a uniform spatial grid so each tick stays
 * roughly O(n) rather than O(n²), keeping ~1.2k nodes interactive.
 */
export class ForceSimulation {
  readonly count: number
  readonly x: Float64Array
  readonly y: Float64Array
  private readonly vx: Float64Array
  private readonly vy: Float64Array
  private readonly edges: EdgeIndex[]
  private readonly degree: Int32Array
  private alpha = 1

  private static readonly REPULSION = 2400
  private static readonly SPRING_LENGTH = 36
  private static readonly SPRING_K = 0.04
  private static readonly GRAVITY = 0.012
  private static readonly DAMPING = 0.82
  private static readonly CELL = 70
  private static readonly ALPHA_DECAY = 0.985
  private static readonly ALPHA_MIN = 0.02

  constructor(nodes: GraphNode[], links: GraphLink[]) {
    this.count = nodes.length
    this.x = new Float64Array(this.count)
    this.y = new Float64Array(this.count)
    this.vx = new Float64Array(this.count)
    this.vy = new Float64Array(this.count)
    this.degree = new Int32Array(this.count)

    const index = new Map<string, number>()
    nodes.forEach((n, i) => index.set(n.id, i))

    // Seed positions on a phyllotaxis spiral grouped loosely by community so the
    // layout converges from a spread-out, deterministic start.
    for (let i = 0; i < this.count; i++) {
      const r = 12 * Math.sqrt(i)
      const theta = i * 2.399963 + nodes[i].community
      this.x[i] = r * Math.cos(theta)
      this.y[i] = r * Math.sin(theta)
    }

    this.edges = []
    for (const link of links) {
      const a = index.get(link.source)
      const b = index.get(link.target)
      if (a === undefined || b === undefined || a === b) continue
      this.edges.push({ a, b })
      this.degree[a]++
      this.degree[b]++
    }
  }

  get cooled(): boolean {
    return this.alpha <= ForceSimulation.ALPHA_MIN
  }

  reheat(): void {
    this.alpha = 0.6
  }

  tick(): void {
    if (this.cooled) return
    const { x, y, vx, vy, count } = this
    const fx = new Float64Array(count)
    const fy = new Float64Array(count)

    // Repulsion via spatial grid: each node only repels neighbours in its own
    // cell and the eight surrounding cells.
    const cell = ForceSimulation.CELL
    const grid = new Map<number, number[]>()
    const key = (cx: number, cy: number) => cx * 100000 + cy
    for (let i = 0; i < count; i++) {
      const k = key(Math.floor(x[i] / cell), Math.floor(y[i] / cell))
      const bucket = grid.get(k)
      if (bucket) bucket.push(i)
      else grid.set(k, [i])
    }
    for (let i = 0; i < count; i++) {
      const cx = Math.floor(x[i] / cell)
      const cy = Math.floor(y[i] / cell)
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          const bucket = grid.get(key(gx, gy))
          if (!bucket) continue
          for (const j of bucket) {
            if (j <= i) continue
            let dx = x[i] - x[j]
            let dy = y[i] - y[j]
            let distSq = dx * dx + dy * dy
            if (distSq === 0) {
              dx = (Math.random() - 0.5) * 0.1
              dy = (Math.random() - 0.5) * 0.1
              distSq = dx * dx + dy * dy
            }
            const force = ForceSimulation.REPULSION / distSq
            const dist = Math.sqrt(distSq)
            const ux = (dx / dist) * force
            const uy = (dy / dist) * force
            fx[i] += ux
            fy[i] += uy
            fx[j] -= ux
            fy[j] -= uy
          }
        }
      }
    }

    // Spring attraction along edges.
    for (const { a, b } of this.edges) {
      const dx = x[b] - x[a]
      const dy = y[b] - y[a]
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01
      const force = (dist - ForceSimulation.SPRING_LENGTH) * ForceSimulation.SPRING_K
      const ux = (dx / dist) * force
      const uy = (dy / dist) * force
      fx[a] += ux
      fy[a] += uy
      fx[b] -= ux
      fy[b] -= uy
    }

    // Gravity toward the origin keeps disconnected components on screen.
    for (let i = 0; i < count; i++) {
      fx[i] -= x[i] * ForceSimulation.GRAVITY
      fy[i] -= y[i] * ForceSimulation.GRAVITY

      vx[i] = (vx[i] + fx[i] * this.alpha) * ForceSimulation.DAMPING
      vy[i] = (vy[i] + fy[i] * this.alpha) * ForceSimulation.DAMPING
      x[i] += vx[i]
      y[i] += vy[i]
    }

    this.alpha *= ForceSimulation.ALPHA_DECAY
  }

  nodeRadius(i: number): number {
    return 3 + Math.min(7, Math.sqrt(this.degree[i]))
  }
}
