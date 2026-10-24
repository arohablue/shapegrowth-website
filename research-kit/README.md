# Growth fields from non-rigid CPD — reproduction package

Registers a plant's day-*t* point cloud onto its day-*t+1* cloud with non-rigid
Coherent Point Drift, and reports the displacement field and the local volume
change (det J) the fitted map implies. Built on the Pheno4D dataset; runs end
to end with no dataset at all via a synthetic demo plant.

This folder is self-contained: its own Python package, its own viewer, its own
dependencies. Nothing in it imports from the website that surrounds it.

The mathematics is in [METHOD.md](METHOD.md), tied to the exact lines of code
that implement it. The reference for every published number is
[docs/plant_growth_slides.pdf](docs/plant_growth_slides.pdf) — page map below.

## Layout

```
pipeline/           the Python package
  registration.py     CPD: NonRigidCPD, cpd_rigid, jacobian
  growth.py           load, soil removal, subsampling, register_growth, chamfer
  demo.py             synthetic plant in real Pheno4D file format
  export.py           viewer assets; the two-mode validation gate
  cli.py              python -m pipeline {demo,register,validate,export}
  plots.py  ply.py    diagnostic PNG, MeshLab-openable PLY
viewer/             the researcher viewer (React + three.js, one screen)
public/specimens/   staged assets: manifest.json + one .bin per specimen
docs/               the slide deck + the published statistics tables
tests/              pytest suite
```

## Install

Python ≥ 3.9 and Node ≥ 20.

```bash
pip install -r requirements.txt     # numpy, scipy; matplotlib/pandas/pytest optional
npm install
```

## Run

**With no data at all** — a synthetic plant that grows, written in real Pheno4D
format, fitted by the identical pipeline:

```bash
python -m pipeline demo
```

Writes `runs/demo/…/growth_field.{npz,png,ply}` and `stats.json`. The demo is a
test that the code runs and the field points the right way — do not read its
numbers as evidence about real plants (`pipeline/demo.py` says why).

**The viewer** — serves the five published specimens staged in
`public/specimens/`:

```bash
npm run dev          # http://localhost:5174
```

One screen: specimen picker, six representations (both days, day t, day t+1,
registered, displacement, det J), the statistics beside the canvas, orbit
controls always live.

**With real Pheno4D data** (requires the signed-licence dataset, which is NOT
and must not be in this folder):

```bash
python -m pipeline register --data-dir /path/to/Pheno4D --plant M05 --day-a 0324 --day-b 0325
```

## Add your own plant

Any two scans of the same specimen work — Pheno4D naming or plain xyz files:

```bash
# 1. register (rigid pre-alignment is ON by default; every published result used it)
python -m pipeline register --files day_t.txt day_t1.txt --days 1

# 2. export for the viewer — NEW mode: no published row, so the gate is skipped
#    and the manifest says so (validated: false, provenance: "new", note: null)
python -m pipeline export --npz runs/custom_pair/growth_field.npz --id MYPLANT

# 3. look at it
npm run dev
```

The picker lists your specimen marked "— unvalidated". That marking is the
point: a new fit must not inherit the published five's trustworthiness, and it
does not get an invented caveat either — `note: null` means nobody has looked,
which is itself information. If the σ² floor warning prints during the rigid
step, read it: that constant was fitted on one specimen (M06) and your plant is
relying on it untested.

Unlabelled scans have no soil label to remove; use `--z-crop` to cut the pot
and ground out by height, or the soil will dominate the fit.

## Reproducing the published five

The five staged specimens (M01, M04, M05, M06, T02) were exported in
**reproduce** mode: every statistic recomputed from the arrays must match the
published row in `docs/summary.csv` to 1e-9 relative, or nothing ships
(`pipeline/export.py`, `validate_published`). To re-run that gate, or to check
the CPD reimplementation itself against the original run's recorded outputs:

```bash
python -m pipeline validate M05 M04 M06 T02 --npz <ARCHIVE_DIR>
python -m pipeline export M05 M04 M06 M01 T02 --archive <ARCHIVE_DIR>
```

Both need the `<PLANT>_rigid.npz` archives, which carry the original run's
inputs *and* outputs. They are not inside this folder (default path:
`../data/pheno4d-growth/npz`, the parent repository's data directory). Without
them you can still run the demo, view the staged five, and register your own
plants — you just cannot re-derive the published assets. The reimplementation
reproduces all four archive specimens to 3.3e-12 relative; `validate` is the
command that proves it on your machine rather than asking you to believe it.

## What this package refuses to claim

These are asserted in code, not stated in prose and hoped for:

- **No physical units.** Everything is in "scan units". Pheno4D never states a
  unit; millimetres is a recorded inference (`pipeline/__init__.py`,
  `UNITS`) and is deliberately never applied.
- **No point-to-point correspondence.** The two scans are independent
  samplings. `displacement[i]` is where the fitted map sends source point i —
  an estimate about a surface, not an observation of a particle. Much of it is
  leaf bending and droop, not growth.
- **Chamfer is the only fit score, and it is weak.** It asks whether the two
  surfaces ended up in the same place — the only question that can be answered
  without correspondence. A good Chamfer does not certify the vectors
  (`pipeline/growth.py`, `chamfer` docstring).
- **det J ≤ 0 is a fold, not "strong compression".** The map is not invertible
  there and carries no readable expansion or compression. Folds get their own
  band everywhere — exporter, viewer, plots — never clipped into the scale.
- **`validated: false` means exactly that.** Nothing has checked the fit; the
  numbers shown are the fit describing itself.

## The reference deck — which page carries which number

`docs/plant_growth_slides.pdf` (43 pages) is the source the validation gate's
CSV derives from. If the deck and `public/specimens/manifest.json` ever
disagree, this package is shipping two conflicting sources of truth — stop and
find out why.

| page | what is on it |
|---|---|
| 2 | Key findings: median Chamfer 13.6 → 2.1 over 14 plants (81%), 13 of 14 clean, T02 at 6.5 / 2.7%, M06 folding 90% without rigid |
| 4, 13 | Pipeline and algorithm, incl. shared centre/scale and the parameters β 1.2, λ 30, w 0.2, 3000 points |
| 5, 9, 10 | Notation; E-step derivation; M-step derivation for W |
| 12 | Rigid pre-alignment (no scale — plants grow, scale is not a nuisance) |
| 15 | What det J measures, incl. det J ≤ 0 |
| 19, 20 | All-14 figure; the metrics table transcribed as `docs/summary.csv` |
| 21 | Default vs rigid table — the source of `docs/summary_default.csv` |
| 22–25 | Case studies: M05 cleanest, M04 folding leaf tip, M06 rescued by rigid, T02 the failure |
| 27 | Limitations |
| 30–43 | Per-plant pages (M01 p30, M04 p33, M05 p34, M06 p35, T02 p38) |

## Provenance, honestly

`pipeline/registration.py` is a **reimplementation** — the original CPD module
behind the deck was lost. What makes it usable is `validate`: the archived
`.npz` carry the original run's inputs and outputs, and feeding the inputs
back through this code reproduces the outputs to 3.3e-12. Two constants were
recovered from that comparison rather than read from source, and `cpd_rigid`'s
docstring documents exactly how weak each one's determination is.

Two files here (`registration.py`, `growth.py`) duplicate code that also lives
in the parent repository under `scripts/cpd-recover/`, where it serves as the
provenance record for specimen M01. The duplication is deliberate — this
folder must be shareable without the repository around it — and is stated here
rather than pretended away. If the copies drift, this one is the maintained
one.

## Tests

```bash
python -m pytest tests/        # ~1 s, no dataset needed
```

Covers the demo format, soil removal, chamfer properties, the registration
contract, det J on known deformations, both export modes, the 1e-9 gate
actually firing on tampered arrays, and the refusal to ship a new fit under a
published plant's name.
