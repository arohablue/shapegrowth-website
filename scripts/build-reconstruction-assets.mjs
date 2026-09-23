/**
 * ────────────────────────────────────────────────────────────────────────────
 * COLMAP OUTPUT → WEB ASSETS
 * ────────────────────────────────────────────────────────────────────────────
 * Turns the raw reconstruction in `data/colmap-sunflower/` into the two files
 * the site actually loads. Run it once per new scan; the outputs are committed,
 * the inputs are not deployed.
 *
 *   node scripts/build-reconstruction-assets.mjs
 *
 * WHAT IT DOES, AND WHY EACH STEP EXISTS
 * ──────────────────────────────────────
 * 1. CLOUD — `fused-clean.ply` is 468,090 points at 28 bytes each, what remains
 *    of `fused.ply`'s 560,012 once `rebuild-mesh.py` has stripped the white-matte
 *    bleed. Thirteen of those bytes are normals and alpha that `PointCloudLayer`
 *    never reads, so they are pure download cost. Stripping them and decimating
 *    to `--points` yields xyz+rgb at 15 B/point.
 *
 *    The decimation is a deterministic stride, matching `normalizePointCloud`'s
 *    reasoning: a random sample produces a different cloud every run, which
 *    makes a visual regression impossible to spot in a screenshot diff.
 *
 * 2. MESH — `meshed-rebuilt.ply`, produced by `scripts/rebuild-mesh.py`.
 *
 *    NOT the `meshed-poisson*.ply` files that shipped with the scan. Both of
 *    those are empty: ~2% of a plausible canopy area, 150 disconnected
 *    components, 92% of their vertices inside one 0.11-unit blob, with 93% of
 *    all vertices in a single narrow y band in BOTH files — so the surface was
 *    lost in Poisson, not in MeshLab's decimation. `rebuild-mesh.py` re-runs
 *    screened Poisson on the cleaned cloud, whose oriented normals were verified
 *    clean, and recovers a surface of area 1.593 against their 0.0086.
 *
 *    The rebuilt mesh carries position, normals and colour, but only the
 *    positions and faces are used here. Colour is re-baked from the *fused*
 *    cloud rather than trusted from the PLY, because Poisson interpolates
 *    vertex colour through its own solver and the cloud is the densest and most
 *    faithful source in the drop; normals are recomputed from face topology for
 *    the same reason the bake exists — one pipeline owns both, so the mesh
 *    cannot drift from the cloud it dissolves out of.
 *
 * ORIENTATION — THE SCAN ARRIVES UPSIDE DOWN
 * ───────────────────────────────────────────
 * In `fused.ply` the flower head is at the BOTTOM. The yellow disc with its
 * radiating petals sits at y 0.35-0.55 of a 0.31-1.22 range, the leaves run
 * upward from it, and the cut stem end is the narrow tip at high y. Every
 * source photograph shows the opposite: pot on the ground, stem rising, flower
 * at the top. So the reconstruction's +Y points at the floor.
 *
 * (An earlier pass read the per-axis radial spread — 0.128 / 0.255 / 0.056 from
 * low y to high — as base / canopy / apex and concluded plain Y-up. That
 * profile is symmetric enough to fit either way round. The flower's colour is
 * not, which is why the check that settled it was looking at the thing.)
 *
 * The correction is a 180 degree rotation about X: (x, y, z) -> (x, -y, -z).
 * Determinant +1, so winding order and normal handedness are preserved and the
 * double-sided material is not hiding a flipped surface.
 *
 * It is applied HERE rather than in `src/assets/normalize.ts` for two reasons.
 * `AssetTransform.upAxis` only expresses the common z-up case and `yaw` only
 * rotates about Y, so neither can say "inverted" — supporting it would mean new
 * app-side configuration for a defect in one scan. And the cloud and the mesh
 * cross-fade into each other, so they must be flipped by the same matrix or
 * they separate; the registration block below already owns exactly that
 * guarantee. The runtime stays ignorant and `upAxis` stays `y`.
 *
 * The flip is applied at the three points where source coordinates enter the
 * pipeline — the cloud write, the mesh read, and the colour bake's cloud index
 * — so everything downstream (bounds, normals, registration) is already
 * upright. Normals are recomputed from flipped positions, so they need no
 * separate correction.
 *
 * COLOUR SPACE — THE OTHER SUBTLE PART
 * ──────────────────────────────────
 * `PLYLoader` converts uchar RGB through `Color.setRGB(..., SRGBColorSpace)`,
 * so the point cloud's colours reach the GPU **linear**. glTF specifies
 * `COLOR_0` as linear too, and `GLTFLoader` passes it through untouched. If the
 * bake wrote raw sRGB bytes the mesh would render visibly paler than the cloud
 * it dissolves out of — the two are on screen within a second of each other, so
 * the mismatch would be obvious. `srgbToLinear` below is what keeps them equal.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? fallback : process.argv[i + 1]
}

const SOURCE_DIR = resolve(ROOT, arg('source', 'data/colmap-sunflower'))
const OUT_DIR = resolve(ROOT, arg('out', 'public/models'))
const TARGET_POINTS = Number(arg('points', 250_000))
/** Neighbours averaged per mesh vertex. See `bakeColour`. */
const COLOUR_K = 8

/**
 * 180 degrees about X — see ORIENTATION above. Signs rather than a matrix
 * because this runs per-coordinate over 750k points and a Vector3 per point is
 * the whole cost of the pass. `--no-flip` disables it for a scan that arrives
 * the right way up.
 */
const FLIP_UPRIGHT = process.argv.indexOf('--no-flip') === -1
const SY = FLIP_UPRIGHT ? -1 : 1
const SZ = FLIP_UPRIGHT ? -1 : 1

/* ── PLY reading ──────────────────────────────────────────────────────────── */

const SCALAR = {
  char: ['readInt8', 1], int8: ['readInt8', 1],
  uchar: ['readUInt8', 1], uint8: ['readUInt8', 1],
  short: ['readInt16LE', 2], int16: ['readInt16LE', 2],
  ushort: ['readUInt16LE', 2], uint16: ['readUInt16LE', 2],
  int: ['readInt32LE', 4], int32: ['readInt32LE', 4],
  uint: ['readUInt32LE', 4], uint32: ['readUInt32LE', 4],
  float: ['readFloatLE', 4], float32: ['readFloatLE', 4],
  double: ['readDoubleLE', 8], float64: ['readDoubleLE', 8],
}

/**
 * Minimal binary-little-endian PLY reader.
 *
 * Deliberately not a general parser: it rejects ascii and big-endian rather
 * than half-supporting them, because a silently mis-parsed scan produces a
 * plausible-looking cloud in the wrong place, which is far worse than a throw.
 */
function readPly(path) {
  const buf = readFileSync(path)
  const marker = buf.indexOf('end_header\n')
  if (marker === -1) throw new Error(`${basename(path)}: no end_header`)
  const header = buf.subarray(0, marker).toString('latin1')
  if (!/format\s+binary_little_endian/.test(header)) {
    throw new Error(`${basename(path)}: only binary_little_endian is supported`)
  }

  const elements = []
  let current = null
  for (const line of header.split('\n')) {
    const p = line.trim().split(/\s+/)
    if (p[0] === 'element') {
      current = { name: p[1], count: Number(p[2]), props: [] }
      elements.push(current)
    } else if (p[0] === 'property' && current) {
      current.props.push(
        p[1] === 'list'
          ? { list: true, countType: p[2], itemType: p[3], name: p[4] }
          : { list: false, type: p[1], name: p[2] },
      )
    }
  }

  let offset = marker + 'end_header\n'.length
  const out = {}

  for (const el of elements) {
    // Fixed-width elements are the common case and can be strided directly.
    const fixed = el.props.every((p) => !p.list)
    if (fixed) {
      const layout = {}
      let stride = 0
      for (const p of el.props) {
        const s = SCALAR[p.type]
        if (!s) throw new Error(`${basename(path)}: unsupported type ${p.type}`)
        layout[p.name] = { read: s[0], at: stride }
        stride += s[1]
      }
      out[el.name] = { count: el.count, layout, stride, base: offset, buf }
      offset += stride * el.count
      continue
    }

    // Lists are only used by `face`, and only ever triangles here.
    const indices = []
    for (let i = 0; i < el.count; i++) {
      for (const p of el.props) {
        if (p.list) {
          const [cRead, cSize] = SCALAR[p.countType]
          const n = buf[cRead](offset)
          offset += cSize
          const [iRead, iSize] = SCALAR[p.itemType]
          const poly = []
          for (let k = 0; k < n; k++) {
            poly.push(buf[iRead](offset))
            offset += iSize
          }
          // Fan-triangulate anything that is not already a triangle.
          for (let k = 2; k < poly.length; k++) indices.push(poly[0], poly[k - 1], poly[k])
        } else {
          offset += SCALAR[p.type][1]
        }
      }
    }
    out[el.name] = { count: el.count, indices }
  }

  return out
}

const field = (v, name, i) =>
  v.layout[name] === undefined ? 0 : v.buf[v.layout[name].read](v.base + i * v.stride + v.layout[name].at)

const hasField = (v, name) => v.layout[name] !== undefined

/* ── colour ───────────────────────────────────────────────────────────────── */

/** IEC 61966-2-1. Matches `THREE.Color.setRGB(..., SRGBColorSpace)`. */
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))

/* ── cloud source ─────────────────────────────────────────────────────────── */

/**
 * NOT `fused.ply`. `rebuild-mesh.py` strips the white-matte bleed — the hueless
 * fringe MVS emits around every silhouette because the source photographs are a
 * segmented plant on a pure white background — and writes what remains here.
 * See that script for the four measurements that identify the fringe.
 *
 * Reading the cleaned file rather than re-implementing the threshold keeps one
 * definition of "the plant" in the pipeline. Two would be worse than none: the
 * cloud and the mesh cross-fade into each other on screen, so a threshold that
 * drifted between the Python and the JavaScript would show up as the fringe
 * flickering into existence at the dissolve.
 */
const CLOUD_SOURCE = 'fused-clean.ply'

let cloudSource = null
function readCloudSource() {
  if (cloudSource) return cloudSource
  try {
    cloudSource = readPly(resolve(SOURCE_DIR, CLOUD_SOURCE))
  } catch (cause) {
    throw new Error(
      `${CLOUD_SOURCE} not found in ${SOURCE_DIR}. Run scripts/rebuild-mesh.py first — ` +
        'it writes both that file and meshed-rebuilt.ply.',
      { cause },
    )
  }
  return cloudSource
}

/* ── 1. point cloud ───────────────────────────────────────────────────────── */

function buildCloud() {
  const src = readCloudSource()
  const v = src.vertex
  if (!v) throw new Error(`${CLOUD_SOURCE}: no vertex element`)
  const coloured = hasField(v, 'red')

  const stride = v.count > TARGET_POINTS ? Math.ceil(v.count / TARGET_POINTS) : 1
  const count = Math.floor((v.count + stride - 1) / stride)

  // xyz float32 + rgb uchar. No normals, no alpha — nothing downstream reads
  // them, and at 560k points they were 7.3 MB of dead weight.
  const header = Buffer.from(
    'ply\n' +
      'format binary_little_endian 1.0\n' +
      `comment source ${basename(SOURCE_DIR)}/${CLOUD_SOURCE} (${v.count} points, stride ${stride})\n` +
      'comment normals and alpha stripped: unused by the renderer\n' +
      'comment white-matte bleed removed by scripts/rebuild-mesh.py\n' +
      `element vertex ${count}\n` +
      'property float x\nproperty float y\nproperty float z\n' +
      (coloured ? 'property uchar red\nproperty uchar green\nproperty uchar blue\n' : '') +
      'end_header\n',
    'ascii',
  )

  const rowBytes = 12 + (coloured ? 3 : 0)
  const body = Buffer.alloc(count * rowBytes)
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]

  for (let i = 0, s = 0; i < count; i++, s += stride) {
    const o = i * rowBytes
    const xyz = [field(v, 'x', s), SY * field(v, 'y', s), SZ * field(v, 'z', s)]
    for (let k = 0; k < 3; k++) {
      body.writeFloatLE(xyz[k], o + k * 4)
      if (xyz[k] < min[k]) min[k] = xyz[k]
      if (xyz[k] > max[k]) max[k] = xyz[k]
    }
    if (coloured) {
      body.writeUInt8(field(v, 'red', s), o + 12)
      body.writeUInt8(field(v, 'green', s), o + 13)
      body.writeUInt8(field(v, 'blue', s), o + 14)
    }
  }

  const out = Buffer.concat([header, body])
  const path = resolve(OUT_DIR, 'sunflower-cloud.ply')
  writeFileSync(path, out)
  return { path, count, sourceCount: v.count, stride, bytes: out.length, coloured, min, max }
}

/* ── 2. mesh ──────────────────────────────────────────────────────────────── */

/**
 * Averages the `COLOUR_K` nearest fused-cloud points onto each mesh vertex.
 *
 * A uniform spatial hash rather than a k-d tree: the cloud is dense and evenly
 * distributed over a small volume, which is the case a hash grid handles well,
 * and it is ~50 lines less code to get wrong.
 *
 * Averaging rather than single-nearest because MVS colour is speckled — one
 * mis-coloured point becomes one mis-coloured vertex, and at 12k vertices each
 * one covers enough screen area to be visible as a fleck.
 */
function bakeColour(positions, cloud) {
  const { count } = cloud
  const ext = [cloud.max[0] - cloud.min[0], cloud.max[1] - cloud.min[1], cloud.max[2] - cloud.min[2]]
  // Aim for ~2 points per cell: cell = (volume / count)^(1/3) * 2^(1/3).
  const cell = Math.cbrt((ext[0] * ext[1] * ext[2]) / Math.max(count, 1)) * 1.6
  const inv = 1 / cell
  const key = (a, b, c) => `${a},${b},${c}`

  const grid = new Map()
  const cx = new Float32Array(count)
  const cy = new Float32Array(count)
  const cz = new Float32Array(count)
  const cr = new Float32Array(count)
  const cg = new Float32Array(count)
  const cb = new Float32Array(count)

  const v = cloud.vertex
  for (let i = 0; i < count; i++) {
    const x = field(v, 'x', i), y = SY * field(v, 'y', i), z = SZ * field(v, 'z', i)
    cx[i] = x; cy[i] = y; cz[i] = z
    cr[i] = field(v, 'red', i); cg[i] = field(v, 'green', i); cb[i] = field(v, 'blue', i)
    const k = key(Math.floor(x * inv), Math.floor(y * inv), Math.floor(z * inv))
    let bucket = grid.get(k)
    if (!bucket) grid.set(k, (bucket = []))
    bucket.push(i)
  }

  const n = positions.length / 3
  const colours = new Float32Array(n * 3)
  let worst = 0
  let sumDist = 0

  // Reused across vertices so the inner loop allocates nothing.
  const bestD = new Float64Array(COLOUR_K)
  const bestI = new Int32Array(COLOUR_K)

  for (let q = 0; q < n; q++) {
    const px = positions[q * 3], py = positions[q * 3 + 1], pz = positions[q * 3 + 2]
    bestD.fill(Infinity)
    bestI.fill(-1)
    let found = 0

    // Grow the search ring until enough neighbours are in hand. Poisson closes
    // the surface slightly past the samples, so some vertices genuinely sit in
    // empty cells and need a wider ring.
    for (let ring = 0; ring <= 6 && found < COLOUR_K; ring++) {
      const bx = Math.floor(px * inv), by = Math.floor(py * inv), bz = Math.floor(pz * inv)
      for (let a = bx - ring; a <= bx + ring; a++) {
        for (let b = by - ring; b <= by + ring; b++) {
          for (let c = bz - ring; c <= bz + ring; c++) {
            // Only the shell of the ring is new; the interior was done already.
            if (ring > 0 && Math.abs(a - bx) !== ring && Math.abs(b - by) !== ring && Math.abs(c - bz) !== ring) continue
            const bucket = grid.get(key(a, b, c))
            if (!bucket) continue
            for (const i of bucket) {
              const d = (cx[i] - px) ** 2 + (cy[i] - py) ** 2 + (cz[i] - pz) ** 2
              if (d >= bestD[COLOUR_K - 1]) continue
              let j = COLOUR_K - 1
              while (j > 0 && bestD[j - 1] > d) { bestD[j] = bestD[j - 1]; bestI[j] = bestI[j - 1]; j-- }
              bestD[j] = d
              bestI[j] = i
              found++
            }
          }
        }
      }
    }

    let r = 0, g = 0, bl = 0, w = 0
    for (let k = 0; k < COLOUR_K; k++) {
      if (bestI[k] < 0) continue
      // Inverse-distance weighting, clamped so a coincident point does not
      // divide by zero and dominate the average outright.
      const wk = 1 / Math.max(Math.sqrt(bestD[k]), 1e-4)
      r += cr[bestI[k]] * wk; g += cg[bestI[k]] * wk; bl += cb[bestI[k]] * wk; w += wk
    }
    if (w === 0) { colours[q * 3] = colours[q * 3 + 1] = colours[q * 3 + 2] = 0.5; continue }

    colours[q * 3 + 0] = srgbToLinear(r / w / 255)
    colours[q * 3 + 1] = srgbToLinear(g / w / 255)
    colours[q * 3 + 2] = srgbToLinear(bl / w / 255)

    const nearest = Math.sqrt(bestD[0])
    sumDist += nearest
    if (nearest > worst) worst = nearest
  }

  return { colours, worstDistance: worst, meanDistance: sumDist / n }
}

/** Area-weighted vertex normals. The simplified PLY ships none. */
function computeNormals(positions, indices) {
  const normals = new Float32Array(positions.length)
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3
    const e1 = [positions[b] - positions[a], positions[b + 1] - positions[a + 1], positions[b + 2] - positions[a + 2]]
    const e2 = [positions[c] - positions[a], positions[c + 1] - positions[a + 1], positions[c + 2] - positions[a + 2]]
    // Cross product magnitude is twice the triangle area, so accumulating the
    // un-normalised face normal weights each face by its area for free.
    const nx = e1[1] * e2[2] - e1[2] * e2[1]
    const ny = e1[2] * e2[0] - e1[0] * e2[2]
    const nz = e1[0] * e2[1] - e1[1] * e2[0]
    for (const o of [a, b, c]) {
      normals[o] += nx; normals[o + 1] += ny; normals[o + 2] += nz
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const len = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1
    normals[i] /= len; normals[i + 1] /= len; normals[i + 2] /= len
  }
  return normals
}

const pad4 = (n) => (n + 3) & ~3

function buildMesh(cloud) {
  const src = readPly(resolve(SOURCE_DIR, 'meshed-rebuilt.ply'))
  const v = src.vertex
  const faces = src.face
  if (!v || !faces) throw new Error('meshed-rebuilt.ply is missing vertex or face data')

  const positions = new Float32Array(v.count * 3)
  for (let i = 0; i < v.count; i++) {
    positions[i * 3 + 0] = field(v, 'x', i)
    positions[i * 3 + 1] = SY * field(v, 'y', i)
    positions[i * 3 + 2] = SZ * field(v, 'z', i)
  }

  const bake = bakeColour(positions, cloud)
  const normals = computeNormals(positions, faces.indices)

  // uint16 indices while the vertex count allows it — halves the largest
  // buffer in the file and every WebGL implementation supports it natively.
  const wide = v.count > 65_535
  const indices = wide ? Uint32Array.from(faces.indices) : Uint16Array.from(faces.indices)

  const posBytes = Buffer.from(positions.buffer)
  const nrmBytes = Buffer.from(normals.buffer)
  const colBytes = Buffer.from(bake.colours.buffer)
  const idxBytes = Buffer.from(indices.buffer)

  const posOffset = 0
  const nrmOffset = pad4(posBytes.length)
  const colOffset = pad4(nrmOffset + nrmBytes.length)
  const idxOffset = pad4(colOffset + colBytes.length)
  const binLength = pad4(idxOffset + idxBytes.length)

  const bin = Buffer.alloc(binLength)
  posBytes.copy(bin, posOffset)
  nrmBytes.copy(bin, nrmOffset)
  colBytes.copy(bin, colOffset)
  idxBytes.copy(bin, idxOffset)

  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], positions[i + k])
      max[k] = Math.max(max[k], positions[i + k])
    }
  }

  const json = {
    asset: { version: '2.0', generator: 'phenotyping build-reconstruction-assets' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    // No node rotation: the COLMAP world frame is already Y-up for this scan,
    // verified by radial profiling (stem narrow at the base, canopy widest
    // mid-height, apex collapsing to near zero).
    nodes: [{ mesh: 0, name: 'sunflower' }],
    meshes: [
      {
        name: 'sunflower',
        primitives: [{ attributes: { POSITION: 0, NORMAL: 1, COLOR_0: 2 }, indices: 3, material: 0 }],
      },
    ],
    materials: [
      {
        name: 'reconstruction',
        pbrMetallicRoughness: {
          // White base so COLOR_0 passes through unmultiplied. The baked colour
          // IS the plant's colour; anything else here would tint real data.
          baseColorFactor: [1, 1, 1, 1],
          metallicFactor: 0.0,
          roughnessFactor: 0.78,
        },
        doubleSided: true,
      },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: positions.length / 3, type: 'VEC3', min, max },
      { bufferView: 1, componentType: 5126, count: normals.length / 3, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: bake.colours.length / 3, type: 'VEC3' },
      { bufferView: 3, componentType: wide ? 5125 : 5123, count: indices.length, type: 'SCALAR' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: posOffset, byteLength: posBytes.length, target: 34962 },
      { buffer: 0, byteOffset: nrmOffset, byteLength: nrmBytes.length, target: 34962 },
      { buffer: 0, byteOffset: colOffset, byteLength: colBytes.length, target: 34962 },
      { buffer: 0, byteOffset: idxOffset, byteLength: idxBytes.length, target: 34963 },
    ],
    buffers: [{ byteLength: binLength }],
  }

  let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8')
  if (jsonBuf.length % 4 !== 0) {
    jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(pad4(jsonBuf.length) - jsonBuf.length, 0x20)])
  }

  const total = 12 + 8 + jsonBuf.length + 8 + bin.length
  const glb = Buffer.alloc(total)
  let o = 0
  glb.write('glTF', o, 'ascii'); o += 4
  glb.writeUInt32LE(2, o); o += 4
  glb.writeUInt32LE(total, o); o += 4
  glb.writeUInt32LE(jsonBuf.length, o); o += 4
  glb.writeUInt32LE(0x4e4f534a, o); o += 4 // 'JSON'
  jsonBuf.copy(glb, o); o += jsonBuf.length
  glb.writeUInt32LE(bin.length, o); o += 4
  glb.writeUInt32LE(0x004e4942, o); o += 4 // 'BIN\0'
  bin.copy(glb, o)

  const path = resolve(OUT_DIR, 'sunflower-mesh.glb')
  writeFileSync(path, glb)
  return {
    path, bytes: total, vertices: v.count, triangles: indices.length / 3,
    indexBits: wide ? 32 : 16, min, max, ...bake,
  }
}

/* ── run ──────────────────────────────────────────────────────────────────── */

mkdirSync(OUT_DIR, { recursive: true })

const fused = readCloudSource()
const cloud = buildCloud()
const mesh = buildMesh({
  vertex: fused.vertex,
  count: fused.vertex.count,
  min: cloud.min,
  max: cloud.max,
})

const mb = (n) => `${(n / 1e6).toFixed(2)} MB`
const fmt = (a) => `[${a.map((n) => n.toFixed(3)).join(', ')}]`

/**
 * ────────────────────────────────────────────────────────────────────────────
 * REGISTERING THE MESH TO THE CLOUD
 * ────────────────────────────────────────────────────────────────────────────
 * `resolveNormalizationMatrix` scales each asset by `targetHeight / ownHeight`
 * and centres its own bounding box. That is correct for one asset alone and
 * wrong for two that have to dissolve into each other, because a Poisson
 * surface always closes slightly past the samples it was fitted to. Here the
 * mesh is 0.9257 tall against the cloud's 0.9094 — 1.8% — so normalising both
 * to 3.2 independently would shrink the plant by 1.8% at the exact moment the
 * two are cross-fading, as a step rather than a drift.
 *
 * The fix is to make the mesh adopt the CLOUD's scale instead of its own:
 *
 *     targetHeight_mesh = 3.2 * (meshHeight / cloudHeight)
 *
 * which cancels to the cloud's scale factor, and then to shift it by the
 * difference in bounding-box centres, which is what `yOffset` is for.
 *
 * The trimmed alternative — deleting the overshooting vertices so the two boxes
 * match — was rejected: it opens a rim hole on a double-sided material, and
 * deleting reconstructed geometry to make a transform convenient is the wrong
 * trade in a project whose whole claim is that it does not touch the data.
 *
 * (Against the meshes that shipped with the scan this was a 14% error rather
 * than 1.8%, because those meshes were empty — see `scripts/rebuild-mesh.py`.
 * The correction is kept because it is derived, not because it is large.)
 *
 * X and Z are left alone. Their centres differ by 0.005 and 0.012 source
 * units, which is 0.4% and 1.2% of plant height after scaling — below the
 * point-cloud's own noise floor, and there are no xOffset/zOffset env vars to
 * correct them with. Y was worth fixing because 14% is not a rounding error.
 */
const cloudH = cloud.max[1] - cloud.min[1]
const meshH = mesh.max[1] - mesh.min[1]
const cloudCentreY = (cloud.min[1] + cloud.max[1]) / 2
const meshCentreY = (mesh.min[1] + mesh.max[1]) / 2

const TARGET = 3.2
const sharedScale = TARGET / cloudH
const meshTargetHeight = TARGET * (meshH / cloudH)
const meshYOffset = (meshCentreY - cloudCentreY) * sharedScale

console.log(`
sunflower-cloud.ply
  ${cloud.count.toLocaleString()} points  (from ${cloud.sourceCount.toLocaleString()}, stride ${cloud.stride})
  ${mb(cloud.bytes)}   vertex colours: ${cloud.coloured ? 'yes' : 'NO'}
  bounds ${fmt(cloud.min)} → ${fmt(cloud.max)}

sunflower-mesh.glb
  ${mesh.vertices.toLocaleString()} vertices, ${mesh.triangles.toLocaleString()} triangles, uint${mesh.indexBits} indices
  ${mb(mesh.bytes)}
  bounds ${fmt(mesh.min)} → ${fmt(mesh.max)}
  colour bake: mean NN ${mesh.meanDistance.toFixed(4)}, worst ${mesh.worstDistance.toFixed(4)} (source units)

registration
  cloud height ${cloudH.toFixed(4)}   mesh height ${meshH.toFixed(4)}   ratio ${(meshH / cloudH).toFixed(4)}
  shared scale ${sharedScale.toFixed(4)}   (Poisson overshoot ${(meshH - cloudH).toFixed(4)}, ${((meshH / cloudH - 1) * 100).toFixed(1)}% of height)

  Paste into .env.local and .env.production — DERIVED, do not hand-edit:

    VITE_POINTCLOUD_TARGET_HEIGHT=${TARGET}
    VITE_MESH_TARGET_HEIGHT=${meshTargetHeight.toFixed(4)}
    VITE_MESH_Y_OFFSET=${meshYOffset.toFixed(4)}
`)
