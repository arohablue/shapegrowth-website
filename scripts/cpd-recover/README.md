# cpd-recover — the reimplemented CPD behind M01

`plant_growth.py` imports `plant_registration.py`. That dependency does not
exist on this machine and was never recovered, so the CPD it provides was
**reimplemented** here from Myronenko & Song 2010 and from `plant_growth.py`'s
own call signatures.

This directory exists because exactly one specimen on the site —
**maize M01** — was produced by this code rather than by the study's original
run. Deleting it would leave a shipped figure with no reproducible origin.

## Why this can be trusted at all

A reimplementation is a claim until something can falsify it. The staged NPZ in
`data/pheno4d-growth/npz/` carry **both** the inputs (`src`, `tgt`) and the
outputs (`warped`, `displacement`, `detJ`) of the original run. So the recorded
inputs can be fed back in and the results compared against the recorded outputs:

```sh
python3 validate.py           M05 M04 M06 T02   # rigid=False, isolates NonRigidCPD
python3 validate.py --rigid   M05 M04 M06 T02   # the convention the site ships
```

Worst relative error: **7.2e-12** (no-rigid) and **3.3e-12** (rigid) — float64
round-off, not agreement by construction. M06 is the sharpest of the four: its
fit folds (median det J −1.163), and it reproduces to 1e-13.

## Reproducing M01

```sh
python3 run_m01.py
```

Two independent gates. `chamfer_before` depends only on `preprocess` and not on
CPD at all, and matches `summary.csv` to **0.0 absolute error** — the only
available check on the subsampling, since no raw scans exist here for the other
four. Then all 11 published statistics agree to **6.6e-13**, against the
exporter's 1e-9 gate. On success it writes `M01_rigid.npz` into
`data/pheno4d-growth/npz/`, which is what
`scripts/build-plant-growth-assets.py` reads.

## The two constants that were guessed, then pinned

These are the weakest part of this code. Neither was read from source:

| constant | value | how it was pinned |
|---|---|---|
| `tol` | `1e-6` | Three specimens stop on it at three different iterations (M05 at 19, M04 at 61, T02 at 15) and all reproduce to ≤3e-13. Same value in `NonRigidCPD` and `cpd_rigid`. |
| `floor` | `1e-8` | What σ² resets to when it goes non-positive. **Only M06 ever reaches it**, so M06 alone determines it — a one-specimen fit, exact for the case it was fitted on and untested elsewhere. |

`floor` is deliberately a separate parameter from `tol`, even though
`sigma2 = tol` is the obvious way to write it (and was what this had first —
it conflated the two, so changing the tolerance silently moved the floor and
broke M06). `cpd_rigid.floor_hits` counts how often the floor is applied;
`run_m01.py` prints it, and M01's is **0**.

## Paths

Neither `plant_growth.py` nor the raw Pheno4D scans live in this repo:

- `PLANT_GROWTH_DIR` — where `plant_growth.py` is (default `~/Downloads`)
- `PHENO4D_RAW` — the raw `M01_*.txt` scans

## Two traps, recorded so they are not rediscovered

1. **Displacement is non-monotonic in iteration count.** It peaks early and
   decays, so "run it longer" makes the answer worse, and the error-vs-iteration
   minimum is a **one-iteration spike**. A coarse sweep grid steps straight over
   it; both 19 and 62 were missed exactly this way.

2. **`plant_growth.py` does `from plant_registration import cpd_rigid`,** which
   binds the name at import time. Patching `plant_registration.cpd_rigid` is a
   **silent no-op** that returns plausible unchanged numbers. Patch
   `plant_growth.cpd_rigid`, and assert the patch was actually called.
