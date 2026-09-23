import { BufferAttribute, BufferGeometry, Mesh, Vector3, type Object3D } from 'three'

/**
 * ────────────────────────────────────────────────────────────────────────────
 * DERIVING STRUCTURE FROM THE RECONSTRUCTED MESH
 * ────────────────────────────────────────────────────────────────────────────
 * Everything here exists to make the transformation *spatially continuous*
 * rather than a crossfade between two unrelated objects.
 *
 * The scan and the mesh are separate files, normalised independently, and there
 * is no correspondence between a PLY sample and a mesh vertex. So we build one:
 * every retained sample is assigned the nearest vertex of the reconstruction,
 * and the shader interpolates each particle from where it was *measured* to
 * where the reconstruction says it *is*. The cloud does not dissolve into the
 * mesh — it migrates onto it, point by point.
 *
 * A useful side effect: because the correspondence is computed after both assets
 * are normalised, it absorbs any residual mismatch between their bounds. A scan
 * whose noise makes it 3% taller than its own reconstruction still lands exactly
 * on the surface.
 *
 * All of this runs once, at load, off the render path.
 */

/** Collects every mesh vertex in the object, in world space. No dedupe: a duplicated position is a duplicated (identical) nearest-neighbour answer, so welding would cost time and change nothing. */
export function extractMeshVertices(object: Object3D): Float32Array {
  const chunks: Float32Array[] = []
  let total = 0

  object.updateMatrixWorld(true)
  const v = new Vector3()

  object.traverse((child) => {
    if (!(child instanceof Mesh)) return
    const position = child.geometry.getAttribute('position')
    if (!position) return

    const out = new Float32Array(position.count * 3)
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i).applyMatrix4(child.matrixWorld)
      out[i * 3 + 0] = v.x
      out[i * 3 + 1] = v.y
      out[i * 3 + 2] = v.z
    }
    chunks.push(out)
    total += out.length
  })

  if (chunks.length === 1) return chunks[0]!

  const merged = new Float32Array(total)
  let cursor = 0
  for (const chunk of chunks) {
    merged.set(chunk, cursor)
    cursor += chunk.length
  }
  return merged
}

/**
 * A uniform spatial hash over the mesh vertices.
 *
 * The naive nearest-vertex search is O(samples × vertices) — for a 240k sample
 * scan against a 100k vertex reconstruction that is 2.4×10^10 distance tests,
 * which is minutes, on the main thread, during page load. The grid makes it
 * effectively O(samples): because the two assets occupy the same volume, the
 * answer is almost always in the query point's own cell or the 26 around it.
 *
 * Cells are cubic (derived from the longest axis) rather than one-per-axis, so
 * a tall thin plant does not produce pathologically flat cells that defeat the
 * whole point.
 */
class VertexGrid {
  private readonly cell: number
  private readonly nx: number
  private readonly ny: number
  private readonly nz: number
  private readonly minX: number
  private readonly minY: number
  private readonly minZ: number
  private readonly start: Int32Array
  private readonly items: Int32Array
  private readonly points: Float32Array
  readonly count: number

  constructor(points: Float32Array) {
    this.points = points
    this.count = (points.length / 3) | 0

    let minX = Infinity
    let minY = Infinity
    let minZ = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    let maxZ = -Infinity
    for (let i = 0; i < this.count; i++) {
      const x = points[i * 3]!
      const y = points[i * 3 + 1]!
      const z = points[i * 3 + 2]!
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (z < minZ) minZ = z
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
      if (z > maxZ) maxZ = z
    }

    this.minX = minX
    this.minY = minY
    this.minZ = minZ

    const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1e-6)
    // ~1 vertex per cell on average, bounded so a tiny mesh does not produce a
    // 1-cell grid and a huge one does not allocate a million empty buckets.
    const res = Math.min(96, Math.max(4, Math.round(Math.cbrt(this.count))))
    this.cell = span / res

    this.nx = Math.max(1, Math.ceil((maxX - minX) / this.cell) + 1)
    this.ny = Math.max(1, Math.ceil((maxY - minY) / this.cell) + 1)
    this.nz = Math.max(1, Math.ceil((maxZ - minZ) / this.cell) + 1)

    // Counting sort into flat arrays rather than a Map of arrays: one
    // allocation instead of one per occupied cell.
    const cells = this.nx * this.ny * this.nz
    const counts = new Int32Array(cells + 1)
    const bucketOf = new Int32Array(this.count)

    for (let i = 0; i < this.count; i++) {
      const b = this.bucket(points[i * 3]!, points[i * 3 + 1]!, points[i * 3 + 2]!)
      bucketOf[i] = b
      counts[b + 1]!++
    }
    for (let c = 0; c < cells; c++) counts[c + 1]! += counts[c]!

    this.start = counts
    this.items = new Int32Array(this.count)
    const cursor = counts.slice(0, cells)
    for (let i = 0; i < this.count; i++) {
      this.items[cursor[bucketOf[i]!]!++] = i
    }
  }

  private clampAxis(v: number, n: number): number {
    return v < 0 ? 0 : v >= n ? n - 1 : v
  }

  private bucket(x: number, y: number, z: number): number {
    const gx = this.clampAxis(Math.floor((x - this.minX) / this.cell), this.nx)
    const gy = this.clampAxis(Math.floor((y - this.minY) / this.cell), this.ny)
    const gz = this.clampAxis(Math.floor((z - this.minZ) / this.cell), this.nz)
    return gx + this.nx * (gy + this.ny * gz)
  }

  /** Index of the nearest vertex, or -1 if the grid is empty. */
  nearest(x: number, y: number, z: number): number {
    if (this.count === 0) return -1

    const cx = this.clampAxis(Math.floor((x - this.minX) / this.cell), this.nx)
    const cy = this.clampAxis(Math.floor((y - this.minY) / this.cell), this.ny)
    const cz = this.clampAxis(Math.floor((z - this.minZ) / this.cell), this.nz)

    const maxR = Math.max(this.nx, this.ny, this.nz)
    let best = -1
    let bestD2 = Infinity

    for (let r = 0; r <= maxR; r++) {
      // Once a hit exists, any cell shell further away than the current best
      // cannot improve on it. `(r - 1) * cell` is the guaranteed minimum
      // distance to anything in shell r.
      if (best >= 0) {
        const floorDist = (r - 1) * this.cell
        if (floorDist > 0 && floorDist * floorDist > bestD2) break
      }

      for (let dz = -r; dz <= r; dz++) {
        const gz = cz + dz
        if (gz < 0 || gz >= this.nz) continue
        for (let dy = -r; dy <= r; dy++) {
          const gy = cy + dy
          if (gy < 0 || gy >= this.ny) continue
          const edgeYZ = Math.abs(dz) === r || Math.abs(dy) === r
          for (let dx = -r; dx <= r; dx++) {
            // Shell only — the interior was covered by a smaller r.
            if (!edgeYZ && Math.abs(dx) !== r) continue
            const gx = cx + dx
            if (gx < 0 || gx >= this.nx) continue

            const b = gx + this.nx * (gy + this.ny * gz)
            const from = this.start[b]!
            const to = this.start[b + 1]!
            for (let k = from; k < to; k++) {
              const idx = this.items[k]!
              const ddx = this.points[idx * 3]! - x
              const ddy = this.points[idx * 3 + 1]! - y
              const ddz = this.points[idx * 3 + 2]! - z
              const d2 = ddx * ddx + ddy * ddy + ddz * ddz
              if (d2 < bestD2) {
                bestD2 = d2
                best = idx
              }
            }
          }
        }
      }
    }

    return best
  }
}

export interface MorphTargets {
  /** Per-sample destination, same layout and length as the cloud's position attribute. */
  positions: Float32Array
  /** Mean distance a sample travels, in scene units. A sanity check on asset alignment. */
  meanTravel: number
  /** Largest distance any sample travels. Large values mean the two assets disagree. */
  maxTravel: number
}

/**
 * For each cloud sample, the nearest vertex of the reconstruction.
 *
 * `meanTravel` and `maxTravel` come back because they are the cheap diagnostic
 * for the failure this whole mechanism is exposed to: a scan and a mesh that are
 * not actually the same plant. On matched assets the mean should be a small
 * fraction of the model height. If it is not, the morph will look like a blob
 * collapsing rather than a plant resolving, and the fault is in the assets, not
 * the shader.
 */
export function assignMorphTargets(
  cloudPositions: Float32Array,
  meshVertices: Float32Array,
): MorphTargets {
  const count = (cloudPositions.length / 3) | 0
  const positions = new Float32Array(cloudPositions.length)

  if (meshVertices.length === 0) {
    positions.set(cloudPositions)
    return { positions, meanTravel: 0, maxTravel: 0 }
  }

  const grid = new VertexGrid(meshVertices)
  let travelSum = 0
  let maxTravel = 0

  for (let i = 0; i < count; i++) {
    const x = cloudPositions[i * 3]!
    const y = cloudPositions[i * 3 + 1]!
    const z = cloudPositions[i * 3 + 2]!

    const n = grid.nearest(x, y, z)
    const tx = meshVertices[n * 3]!
    const ty = meshVertices[n * 3 + 1]!
    const tz = meshVertices[n * 3 + 2]!

    positions[i * 3 + 0] = tx
    positions[i * 3 + 1] = ty
    positions[i * 3 + 2] = tz

    const travel = Math.hypot(tx - x, ty - y, tz - z)
    travelSum += travel
    if (travel > maxTravel) maxTravel = travel
  }

  return { positions, meanTravel: count > 0 ? travelSum / count : 0, maxTravel }
}

export interface WireframeTopology {
  geometry: BufferGeometry
  segments: number
  sourceSegments: number
}

/**
 * Unique triangle edges as a growable `LineSegments` geometry.
 *
 * Each segment carries its origin endpoint in `aOther`, so the vertex shader can
 * interpolate the far end from the near one and make edges *grow* instead of
 * fading in. Fading reads as a texture appearing; growing reads as structure
 * being inferred, which is the whole point of the stage.
 *
 * Edges are deduped per child by index pair. Cross-child welding is deliberately
 * skipped — a duplicated seam edge is invisible in a wireframe and welding a
 * large mesh by position costs more than it buys.
 */
export function buildWireframe(object: Object3D, maxEdges: number | null): WireframeTopology {
  const a: number[] = []
  const b: number[] = []

  object.updateMatrixWorld(true)
  const v = new Vector3()

  object.traverse((child) => {
    if (!(child instanceof Mesh)) return
    const position = child.geometry.getAttribute('position')
    if (!position) return

    const index = child.geometry.getIndex()
    const triangles = index ? index.count / 3 : position.count / 3
    const vertexCount = position.count
    const seen = new Set<number>()

    // World-space positions for this child, resolved once.
    const world = new Float32Array(vertexCount * 3)
    for (let i = 0; i < vertexCount; i++) {
      v.fromBufferAttribute(position, i).applyMatrix4(child.matrixWorld)
      world[i * 3 + 0] = v.x
      world[i * 3 + 1] = v.y
      world[i * 3 + 2] = v.z
    }

    const push = (i0: number, i1: number) => {
      const lo = i0 < i1 ? i0 : i1
      const hi = i0 < i1 ? i1 : i0
      const key = lo * vertexCount + hi
      if (seen.has(key)) return
      seen.add(key)
      a.push(world[lo * 3]!, world[lo * 3 + 1]!, world[lo * 3 + 2]!)
      b.push(world[hi * 3]!, world[hi * 3 + 1]!, world[hi * 3 + 2]!)
    }

    for (let t = 0; t < triangles; t++) {
      const i0 = index ? index.getX(t * 3) : t * 3
      const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1
      const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2
      push(i0, i1)
      push(i1, i2)
      push(i2, i0)
    }
  })

  const sourceSegments = (a.length / 3) | 0

  // A dense reconstruction has more edges than a wireframe can legibly show, and
  // beyond a few tens of thousands it is grey mush regardless of hardware.
  // Deterministic stride, matching the point cloud's decimation, so the same
  // asset always yields the same wireframe.
  const stride = maxEdges && sourceSegments > maxEdges ? Math.ceil(sourceSegments / maxEdges) : 1
  const segments = stride === 1 ? sourceSegments : Math.floor((sourceSegments + stride - 1) / stride)

  const positions = new Float32Array(segments * 2 * 3)
  const others = new Float32Array(segments * 2 * 3)
  const reveal = new Float32Array(segments * 2)

  let minY = Infinity
  let maxY = -Infinity
  for (let s = 0, src = 0; s < segments; s++, src += stride) {
    const ay = a[src * 3 + 1]!
    const by = b[src * 3 + 1]!
    const mid = (ay + by) * 0.5
    if (mid < minY) minY = mid
    if (mid > maxY) maxY = mid
  }
  const span = maxY - minY > 1e-6 ? maxY - minY : 1

  for (let s = 0, src = 0; s < segments; s++, src += stride) {
    const ax = a[src * 3]!
    const ay = a[src * 3 + 1]!
    const az = a[src * 3 + 2]!
    const bx = b[src * 3]!
    const by = b[src * 3 + 1]!
    const bz = b[src * 3 + 2]!

    // Vertex 0 sits at A and stays there; vertex 1 travels A → B. Both carry A
    // in `aOther`, so `mix(aOther, position, growth)` is a no-op for the first
    // and a sweep for the second.
    positions[s * 6 + 0] = ax
    positions[s * 6 + 1] = ay
    positions[s * 6 + 2] = az
    positions[s * 6 + 3] = bx
    positions[s * 6 + 4] = by
    positions[s * 6 + 5] = bz

    others[s * 6 + 0] = ax
    others[s * 6 + 1] = ay
    others[s * 6 + 2] = az
    others[s * 6 + 3] = ax
    others[s * 6 + 4] = ay
    others[s * 6 + 5] = az

    // Both endpoints share the midpoint's height, so an edge blooms as a unit
    // rather than tearing between two different reveal times.
    const r = ((ay + by) * 0.5 - minY) / span
    reveal[s * 2 + 0] = r
    reveal[s * 2 + 1] = r
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('aOther', new BufferAttribute(others, 3))
  geometry.setAttribute('aReveal', new BufferAttribute(reveal, 1))
  geometry.computeBoundingSphere()

  return { geometry, segments, sourceSegments }
}
