// The MeshLayer reveal works by string-replacing named chunks in three's
// MeshStandardMaterial shaders. If a chunk name is wrong — or three renames one
// on a version bump — the replace is a silent no-op: the material still compiles,
// still renders, and the surface simply never reveals. No error anywhere.
// This asserts every hook exists exactly once, and that the GLSL identifiers the
// injected code reads are actually in scope at the injection point.
import * as THREE from 'three'
import { readFileSync } from 'node:fs'
import { fromRoot } from './lib/esbuild-src.mjs'

const lib = THREE.ShaderLib.physical
const fail = []

const VERTEX_HOOKS = ['#include <common>', '#include <project_vertex>']
const FRAGMENT_HOOKS = [
  '#include <common>',
  '#include <clipping_planes_fragment>',
  '#include <opaque_fragment>',
]

const check = (name, source, hooks) => {
  for (const h of hooks) {
    const n = source.split(h).length - 1
    console.log(`${name.padEnd(9)} ${h.padEnd(40)} ${n} occurrence(s)`)
    if (n === 0) fail.push(`${name}: hook ${h} is ABSENT — injection would be a silent no-op`)
    if (n > 1) fail.push(`${name}: hook ${h} appears ${n}x — replace() only hits the first`)
  }
}

check('vertex', lib.vertexShader, VERTEX_HOOKS)
check('fragment', lib.fragmentShader, FRAGMENT_HOOKS)

// Comments are not code. Without stripping them, the identifier scans below
// match the prose that explains why an identifier is deliberately absent and
// report the exact opposite of the truth — which this harness did once, loudly.
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[^\n]*?\/\/.*$/gm, '')

// `transformed` is read by the injected vertex code. It is produced by chunks
// that must run BEFORE project_vertex.
const vsrc = lib.vertexShader
const resolved = vsrc.replace(/#include <(\w+)>/g, (_, n) => THREE.ShaderChunk[n] ?? '')
const idx = resolved.indexOf('#include <project_vertex>') >= 0
  ? resolved.indexOf('#include <project_vertex>')
  : resolved.indexOf('gl_Position = projectionMatrix')
const before = resolved.slice(0, idx)
for (const id of ['transformed']) {
  const declared = new RegExp(`vec[34]\\s+${id}\\b`).test(before)
  console.log(`in scope before project_vertex: ${id.padEnd(14)} ${declared}`)
  if (!declared) fail.push(`${id} is not declared before the injection point`)
}

// Varying names must not collide with three's own, or the shader fails to link.
const src = stripComments(readFileSync(fromRoot('src/scene/MeshLayer.tsx'), 'utf8'))
const ours = [...src.matchAll(/varying\s+\w+\s+(\w+);/g)].map((m) => m[1])
const unique = [...new Set(ours)]
console.log(`\ninjected varyings: ${unique.join(', ')}`)
for (const v of unique) {
  // three declares its varyings in the chunks; check the fully-resolved source.
  const rf = lib.fragmentShader.replace(/#include <(\w+)>/g, (_, n) => THREE.ShaderChunk[n] ?? '')
  if (new RegExp(`varying\\s+\\w+\\s+${v}\\b`).test(rf) || new RegExp(`varying\\s+\\w+\\s+${v}\\b`).test(resolved)) {
    fail.push(`varying ${v} collides with one three already declares`)
  }
}

// Same class of risk in the point cloud shader: `color`/USE_COLOR is three's,
// and re-declaring it is a link error.
const pc = stripComments(readFileSync(fromRoot('src/scene/shaders/pointCloud.ts'), 'utf8'))
if (/attribute\s+vec3\s+color/.test(pc)) {
  fail.push('pointCloud declares `attribute vec3 color`, which three injects under USE_COLOR')
}
console.log(`pointCloud re-declares three's color attribute: ${/attribute\s+vec3\s+color/.test(pc)}`)

console.log('')
if (fail.length === 0) console.log('PASS — every injection hook exists and every identifier is in scope')
else {
  console.log('FAIL')
  for (const f of fail) console.log('  • ' + f)
  process.exitCode = 1
}
