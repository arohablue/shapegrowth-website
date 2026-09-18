/**
 * Generates stand-in reconstruction assets so the loading pipeline can be
 * exercised before the real scan exists.
 *
 * These are FIXTURES, not content. They are shaped to stress the parts of the
 * loader that a hand-made test asset usually lets through:
 *
 *   - the PLY is binary little-endian with uchar vertex colours (the format a
 *     real scanner emits, not ASCII)
 *   - it is Z-up and in millimetres, so the up-axis correction and the
 *     scale normalisation both have to do real work
 *   - its origin is deliberately offset from the plant, so the anchoring code
 *     is exercised rather than coincidentally correct
 *
 * Run: node scripts/make-fixtures.mjs
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../public/models')
mkdirSync(OUT_DIR, { recursive: true })

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const HEIGHT_MM = 820
const ORIGIN_OFFSET = [1250, -430, 0] // scanner origin, not plant origin

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const LEAF_COUNT = 11

/**
 * Multiplies every mesh grid subdivision. It exists because the fixture's
 * *density* is load-bearing for the scene, not just its shape.
 *
 * The scene's vertex stage draws each scan sample stacked on its nearest
 * reconstruction vertex, so the sample:vertex ratio decides how much of the
 * frame that stage can fill. At 1 the fixture mesh was 946 vertices against
 * 240k samples — 254:1 — and the samples collapsed onto so few distinct
 * positions that the stage rendered at 0.3% frame coverage. That looked exactly
 * like a broken reveal and sent me tuning shaders to fix a fixture.
 *
 * A real reconstruction is dense relative to nothing: it has one vertex per few
 * samples, not one per few hundred. 5 puts this at ~19.5k vertices (~12:1),
 * which is the regime the scene is actually designed for, and lands the edge
 * count just under the wireframe's 60k cap so the capping path stays exercised.
 */
const TESSELLATION = 5

/** Where leaf `i` attaches, and which way it points. Phyllotactic. */
function leafFrame(i) {
  const t = (i + 1.2) / (LEAF_COUNT + 1.4)
  const attachZ = t * HEIGHT_MM * 0.92
  const yaw = i * GOLDEN_ANGLE
  // Lower leaves are longer and droop harder — the usual gradient on a rosette.
  const length = HEIGHT_MM * (0.52 - 0.24 * t)
  const droop = 0.95 - 0.55 * t
  return { attachZ, yaw, length, droop }
}

/** Stem centreline: a gentle lean, Z-up. */
function stemAt(z) {
  const t = z / HEIGHT_MM
  return [42 * t * t, 18 * Math.sin(t * 2.2), z]
}

/**
 * A point on leaf `i`. `u` runs base→tip, `v` runs across the blade.
 * Returns [x, y, z] in scanner space.
 */
function leafPoint(i, u, v) {
  const { attachZ, yaw, length, droop } = leafFrame(i)
  const [sx, sy, sz] = stemAt(attachZ)

  // Blade half-width: narrow at the base, widest at 40%, tapering to a tip.
  const halfWidth = length * 0.17 * Math.sin(Math.pow(u, 0.7) * Math.PI) ** 0.8

  const out = u * length
  const rise = length * 0.30 * Math.sin(u * 1.9) - droop * length * 0.42 * u * u
  // Curl across the blade so it is a surface, not a flat plane.
  const curl = -halfWidth * 0.55 * v * v

  const across = v * halfWidth
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)

  return [
    sx + out * cos - across * sin,
    sy + out * sin + across * cos,
    sz + rise + curl,
  ]
}

function buildCloud(target) {
  const rand = mulberry32(0x5caed)
  const xyz = []
  const rgb = []

  const stemShare = Math.floor(target * 0.16)

  for (let i = 0; i < stemShare; i++) {
    const z = Math.pow(rand(), 0.85) * HEIGHT_MM
    const [cx, cy, cz] = stemAt(z)
    const radius = 13 * (1 - 0.55 * (z / HEIGHT_MM)) + rand() * 1.6
    const a = rand() * Math.PI * 2
    xyz.push(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, cz + (rand() - 0.5) * 2)
    const shade = 0.55 + 0.25 * rand()
    rgb.push((92 * shade) | 0, (118 * shade) | 0, (74 * shade) | 0)
  }

  const perLeaf = Math.floor((target - stemShare) / LEAF_COUNT)
  for (let i = 0; i < LEAF_COUNT; i++) {
    for (let n = 0; n < perLeaf; n++) {
      const u = Math.pow(rand(), 0.62)
      const v = rand() * 2 - 1
      const [x, y, z] = leafPoint(i, u, v)

      // Sensor noise, ~1.5mm — enough that the cloud reads as measured.
      const nx = (rand() - 0.5) * 3
      const ny = (rand() - 0.5) * 3
      const nz = (rand() - 0.5) * 3

      xyz.push(x + nx, y + ny, z + nz)

      // Chlorophyll gradient: yellower at the tips, darker toward the midrib.
      const tip = u
      const midrib = 1 - Math.abs(v)
      const r = 78 + 74 * tip + 26 * (1 - midrib)
      const g = 132 + 62 * tip - 18 * (1 - midrib)
      const b = 62 + 30 * tip
      const shade = 0.72 + 0.28 * rand()
      rgb.push(Math.min(255, (r * shade) | 0), Math.min(255, (g * shade) | 0), Math.min(255, (b * shade) | 0))
    }
  }

  return { xyz, rgb, count: xyz.length / 3 }
}

function writePly(path, cloud) {
  const header =
    'ply\n' +
    'format binary_little_endian 1.0\n' +
    'comment fixture — generated by scripts/make-fixtures.mjs, units mm, Z-up\n' +
    `element vertex ${cloud.count}\n` +
    'property float x\nproperty float y\nproperty float z\n' +
    'property uchar red\nproperty uchar green\nproperty uchar blue\n' +
    'end_header\n'

  const headerBuf = Buffer.from(header, 'ascii')
  const body = Buffer.alloc(cloud.count * (3 * 4 + 3))

  for (let i = 0; i < cloud.count; i++) {
    const o = i * 15
    body.writeFloatLE(cloud.xyz[i * 3 + 0] + ORIGIN_OFFSET[0], o + 0)
    body.writeFloatLE(cloud.xyz[i * 3 + 1] + ORIGIN_OFFSET[1], o + 4)
    body.writeFloatLE(cloud.xyz[i * 3 + 2] + ORIGIN_OFFSET[2], o + 8)
    body.writeUInt8(cloud.rgb[i * 3 + 0], o + 12)
    body.writeUInt8(cloud.rgb[i * 3 + 1], o + 13)
    body.writeUInt8(cloud.rgb[i * 3 + 2], o + 14)
  }

  writeFileSync(path, Buffer.concat([headerBuf, body]))
  return headerBuf.length + body.length
}

// ── GLB ──────────────────────────────────────────────────────────────────────
// Hand-assembled rather than exported: GLTFExporter expects a DOM. The mesh is
// the same plant as a surface — a tapered stem tube plus a grid per leaf.

function buildMesh() {
  const positions = []
  const indices = []

  const addQuadGrid = (rows, cols, at) => {
    const base = positions.length / 3
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const [x, y, z] = at(r / rows, c / cols)
        positions.push(x, y, z)
      }
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = base + r * (cols + 1) + c
        const b = a + 1
        const d = a + (cols + 1)
        const e = d + 1
        indices.push(a, d, b, b, d, e)
      }
    }
  }

  // Stem: rings around a tapered tube.
  addQuadGrid(10 * TESSELLATION, 8 * TESSELLATION, (u, v) => {
    const z = u * HEIGHT_MM
    const [cx, cy, cz] = stemAt(z)
    const radius = 13 * (1 - 0.55 * u)
    const a = v * Math.PI * 2
    return [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, cz]
  })

  for (let i = 0; i < LEAF_COUNT; i++) {
    addQuadGrid(10 * TESSELLATION, 6 * TESSELLATION, (u, v) =>
      leafPoint(i, Math.max(u, 0.02), v * 2 - 1),
    )
  }

  return { positions, indices }
}

function computeNormals(positions, indices) {
  const normals = new Float32Array(positions.length)
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = [indices[i] * 3, indices[i + 1] * 3, indices[i + 2] * 3]
    const ux = positions[b] - positions[a]
    const uy = positions[b + 1] - positions[a + 1]
    const uz = positions[b + 2] - positions[a + 2]
    const vx = positions[c] - positions[a]
    const vy = positions[c + 1] - positions[a + 1]
    const vz = positions[c + 2] - positions[a + 2]
    const nx = uy * vz - uz * vy
    const ny = uz * vx - ux * vz
    const nz = ux * vy - uy * vx
    for (const o of [a, b, c]) {
      normals[o] += nx
      normals[o + 1] += ny
      normals[o + 2] += nz
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const len = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1
    normals[i] /= len
    normals[i + 1] /= len
    normals[i + 2] /= len
  }
  return normals
}

const pad4 = (n) => (n + 3) & ~3

function writeGlb(path, mesh) {
  const positions = Float32Array.from(mesh.positions)
  const normals = computeNormals(mesh.positions, mesh.indices)
  const indices = Uint32Array.from(mesh.indices)

  const posBytes = Buffer.from(positions.buffer)
  const nrmBytes = Buffer.from(normals.buffer)
  const idxBytes = Buffer.from(indices.buffer)

  const posOffset = 0
  const nrmOffset = pad4(posBytes.length)
  const idxOffset = pad4(nrmOffset + nrmBytes.length)
  const binLength = pad4(idxOffset + idxBytes.length)

  const bin = Buffer.alloc(binLength)
  posBytes.copy(bin, posOffset)
  nrmBytes.copy(bin, nrmOffset)
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
    asset: { version: '2.0', generator: 'phenotyping fixtures' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    // Z-up source rotated to Y-up here, so the GLB is a well-formed Y-up asset
    // like a real export would be. The PLY is left Z-up on purpose so the two
    // paths are not both testing the same assumption.
    nodes: [{ mesh: 0, rotation: [-Math.SQRT1_2, 0, 0, Math.SQRT1_2] }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] }],
    materials: [
      {
        name: 'canopy',
        pbrMetallicRoughness: {
          baseColorFactor: [0.42, 0.58, 0.34, 1],
          metallicFactor: 0.0,
          roughnessFactor: 0.75,
        },
        doubleSided: true,
      },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: positions.length / 3, type: 'VEC3', min, max },
      { bufferView: 1, componentType: 5126, count: normals.length / 3, type: 'VEC3' },
      { bufferView: 2, componentType: 5125, count: indices.length, type: 'SCALAR' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: posOffset, byteLength: posBytes.length, target: 34962 },
      { buffer: 0, byteOffset: nrmOffset, byteLength: nrmBytes.length, target: 34962 },
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

  writeFileSync(path, glb)
  return { bytes: total, triangles: indices.length / 3, vertices: positions.length / 3 }
}

const cloud = buildCloud(240_000)
const plyBytes = writePly(resolve(OUT_DIR, 'fixture-scan.ply'), cloud)
console.log(`fixture-scan.ply          ${cloud.count.toLocaleString()} points, ${(plyBytes / 1e6).toFixed(1)} MB`)

const mesh = buildMesh()
const glb = writeGlb(resolve(OUT_DIR, 'fixture-reconstruction.glb'), mesh)
console.log(
  `fixture-reconstruction.glb ${glb.triangles.toLocaleString()} triangles, ${(glb.bytes / 1e3).toFixed(0)} kB`,
)
