import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const BUNDLE_DIR = resolve(ROOT, 'tmp/verify-bundles')

mkdirSync(BUNDLE_DIR, { recursive: true })

export const fromRoot = (...parts) => resolve(ROOT, ...parts)

/** Bundle a `src/` entry into a throwaway ESM file and import it. */
export const buildSrc = (entry, name) => {
  const out = resolve(BUNDLE_DIR, name)
  execFileSync(
    'npx',
    [
      'esbuild',
      fromRoot(entry),
      '--bundle',
      '--format=esm',
      `--alias:@=${fromRoot('src')}`,
      `--outfile=${out}`,
    ],
    { stdio: 'inherit', cwd: ROOT },
  )
  return import(`${pathToFileURL(out).href}?t=${Date.now()}`)
}
