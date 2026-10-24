/**
 * One screen: specimen picker, representation switch, the numbers, the canvas.
 *
 * The picker is UNFILTERED — it offers exactly what the manifest contains.
 * The exporter decides what is usable, not this view; a selector containing
 * only the specimens that worked cannot be used to find out that one did not,
 * which is why T02 (the study's failure case) is reachable here.
 *
 * The numbers panel is always visible. On the website these statistics are
 * deliberately held back from the narrative copy; for a researcher they ARE
 * the point, so they sit beside the canvas rather than behind a click.
 */
import { useEffect, useMemo, useState } from 'react'

import { cssGradient, coolwarm, detJColoring, displacementColoring, turbo, FOLD_COLOR } from './colors'
import {
  defaultSpecimenId,
  loadManifest,
  loadSpecimen,
  specimenById,
  type GrowthManifest,
  type SpecimenArrays,
  type SpecimenRecord,
} from './manifest'
import { MODE_LABELS, Viewer, type ViewMode } from './Viewer'

const MODES: readonly ViewMode[] = ['both', 'day-t', 'day-t1', 'registered', 'displacement', 'detj']

function fmt(x: number, digits = 3): string {
  if (!Number.isFinite(x)) return String(x)
  const a = Math.abs(x)
  if (a !== 0 && (a >= 10000 || a < 0.001)) return x.toExponential(2)
  return x.toFixed(a >= 100 ? 1 : digits)
}

const pct = (x: number): string => `${(100 * x).toFixed(2)}%`

function Row(props: { k: string; v: string; title?: string }) {
  return (
    <div className="row" title={props.title}>
      <span className="row__k">{props.k}</span>
      <span className="row__v">{props.v}</span>
    </div>
  )
}

function NumbersPanel(props: { manifest: GrowthManifest; specimen: SpecimenRecord }) {
  const { manifest, specimen } = props
  const d = specimen.diagnostics
  const u = manifest.units
  return (
    <section className="panel">
      <div className={`badge ${specimen.validated ? 'badge--ok' : 'badge--warn'}`}>
        {specimen.validated
          ? 'validated — reproduces the published table to 1e-9'
          : 'NOT validated — no published statistics exist for this specimen'}
      </div>
      <Row k="provenance" v={specimen.provenance} title={manifest.provenance[specimen.provenance]?.note} />
      <Row k="points" v={`${d.n_points} per scan`} />
      <Row k="interval" v={`${specimen.interval.days} day${specimen.interval.days === 1 ? '' : 's'}`} />
      <Row
        k="chamfer"
        v={`${fmt(specimen.fit.chamfer_before)} → ${fmt(specimen.fit.chamfer_after)} ${u}`}
        title="Symmetric mean nearest-neighbour distance between the two surfaces — the only available fit score; the scans share no point identity."
      />
      <Row k="" v={`${pct(specimen.fit.chamfer_reduction)} closer`} />
      <Row
        k="|displacement|"
        v={`mean ${fmt(d.displacement.mean)} · median ${fmt(d.displacement.median)} ${u}`}
      />
      <Row k="" v={`p95 ${fmt(d.displacement.p95)} · max ${fmt(d.displacement.max)} ${u}`} />
      <Row k="det J" v={`median ${fmt(d.detJ.median)} · 5–95% [${fmt(d.detJ.p5)}, ${fmt(d.detJ.p95)}]`} />
      <Row
        k=""
        v={`expanding ${pct(d.detJ.frac_expanding)} · compressing ${pct(d.detJ.frac_compressing)}`}
      />
      <Row
        k="folds"
        v={
          d.detJ.count_non_positive === 0
            ? 'none (det J > 0 everywhere)'
            : `${d.detJ.count_non_positive} points (${pct(d.detJ.frac_non_positive)}) with det J ≤ 0 — not invertible there`
        }
      />
      <Row k="units" v={`${u} — calibration: none`} title={manifest.unit_evidence} />
      {specimen.note && <p className="note">{specimen.note}</p>}
      {!specimen.validated && specimen.note === null && (
        <p className="note note--muted">
          No caveat is attached because nobody has written one — not because the fit is clean.
        </p>
      )}
    </section>
  )
}

function Legend(props: { mode: ViewMode; dispMax: number; dispMin: number; detjV: number; nFold: number; units: string }) {
  if (props.mode === 'displacement') {
    return (
      <div className="legend">
        <div className="legend__bar" style={{ background: cssGradient(turbo) }} />
        <div className="legend__labels">
          <span>{fmt(props.dispMin)}</span>
          <span>|displacement| ({props.units})</span>
          <span>{fmt(props.dispMax)}</span>
        </div>
        <p className="legend__note">
          Vectors drawn at true length — each tip is a point of the warped cloud.{' '}
          <span className="legend__swatch" style={{ background: '#4f9cf9' }} /> day t is the blue
          surface the vectors leave; <span className="legend__swatch" style={{ background: '#f25757' }} />{' '}
          day t+1 is the faint red backdrop the tips should land on (never on a specific point of
          it — the scans share no correspondence).
        </p>
      </div>
    )
  }
  if (props.mode === 'detj') {
    const [fr, fg, fb] = FOLD_COLOR
    return (
      <div className="legend">
        <div className="legend__bar" style={{ background: cssGradient(coolwarm) }} />
        <div className="legend__labels">
          <span>{fmt(1 / props.detjV, 2)}×</span>
          <span>det J (log scale, 1 = no change)</span>
          <span>{fmt(props.detjV, 2)}×</span>
        </div>
        <p className="legend__note">
          {props.nFold > 0 ? (
            <>
              <span
                className="legend__swatch"
                style={{ background: `rgb(${fr * 255},${fg * 255},${fb * 255})` }}
              />{' '}
              {props.nFold} folded points (det J ≤ 0): the map is not invertible there and carries no
              readable expansion or compression.
            </>
          ) : (
            'No folds: det J > 0 at every point.'
          )}
        </p>
      </div>
    )
  }
  return (
    <div className="legend">
      <p className="legend__note">
        <span className="legend__swatch" style={{ background: '#4f9cf9' }} /> day t
        {props.mode === 'registered' ? ' (warped)' : ''} ·{' '}
        <span className="legend__swatch" style={{ background: '#f25757' }} /> day t+1
      </p>
    </div>
  )
}

export default function App() {
  const [manifest, setManifest] = useState<GrowthManifest | null>(null)
  const [specimenId, setSpecimenId] = useState<string | null>(null)
  const [arrays, setArrays] = useState<SpecimenArrays | null>(null)
  const [mode, setMode] = useState<ViewMode>('both')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    loadManifest()
      .then((m) => {
        if (!alive) return
        setManifest(m)
        setSpecimenId(defaultSpecimenId(m))
      })
      .catch((err: unknown) => alive && setError(String(err)))
    return () => {
      alive = false
    }
  }, [])

  const specimen = useMemo(
    () => (manifest && specimenId ? specimenById(manifest, specimenId) : null),
    [manifest, specimenId],
  )

  useEffect(() => {
    if (!specimen) return
    let alive = true
    setArrays(null)
    loadSpecimen(specimen)
      .then((a) => alive && setArrays(a))
      .catch((err: unknown) => alive && setError(String(err)))
    return () => {
      alive = false
    }
  }, [specimen])

  const dispColoring = useMemo(
    () => (arrays ? displacementColoring(arrays.src, arrays.displacement) : null),
    [arrays],
  )
  const detjColoring = useMemo(() => (arrays ? detJColoring(arrays.detJ) : null), [arrays])

  if (error) {
    return (
      <div className="app app--message">
        <div>
          <h1>Growth fields — non-rigid CPD</h1>
          <p className="error">{error}</p>
          <p className="note">
            Is <code>public/specimens/manifest.json</code> present? Run{' '}
            <code>python -m pipeline export …</code> to produce it.
          </p>
        </div>
      </div>
    )
  }
  if (!manifest || !specimen) return <div className="app app--message">loading manifest…</div>

  return (
    <div className="app">
      <aside className="sidebar">
        <header>
          <h1>Growth fields — non-rigid CPD</h1>
          <p className="note note--muted">
            {manifest.dataset} · {manifest.method}
          </p>
        </header>

        <section>
          <label className="label" htmlFor="specimen">
            specimen
          </label>
          <select
            id="specimen"
            value={specimen.id}
            onChange={(e) => setSpecimenId(e.target.value)}
          >
            {manifest.specimens.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
                {s.validated ? '' : ' — unvalidated'}
              </option>
            ))}
          </select>
        </section>

        <section>
          <span className="label">representation</span>
          <div className="modes">
            {MODES.map((m) => (
              <button
                key={m}
                className={m === mode ? 'mode mode--active' : 'mode'}
                onClick={() => setMode(m)}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>
        </section>

        <NumbersPanel manifest={manifest} specimen={specimen} />

        {arrays && dispColoring && detjColoring && (
          <Legend
            mode={mode}
            dispMin={dispColoring.min}
            dispMax={dispColoring.max}
            detjV={detjColoring.v}
            nFold={detjColoring.nFold}
            units={manifest.units}
          />
        )}

        <section className="caveats">
          <span className="label">caveats — these travel with the data</span>
          <ul>
            {manifest.caveats.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </section>

        <footer className="note note--muted">
          {manifest.coverage.note} Reference: {manifest.reference}.
        </footer>
      </aside>

      <main className="stage">
        {arrays && dispColoring && detjColoring ? (
          <Viewer
            specimen={specimen}
            arrays={arrays}
            mode={mode}
            displacementColoring={dispColoring}
            detJColoring={detjColoring}
          />
        ) : (
          <div className="app--message">loading {specimen.id}…</div>
        )}
      </main>
    </div>
  )
}
