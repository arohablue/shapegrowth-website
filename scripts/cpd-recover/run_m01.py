#!/usr/bin/env python3
"""M01 0324 -> 0325 through the original pipeline.

Two independent gates:
  1. chamfer_before depends ONLY on preprocess (src, tgt) and not on CPD at all.
     If it matches summary.csv, the subsampling path is confirmed -- which cannot
     be checked any other way, since no raw scans exist for M04/M05/M06/T02.
  2. everything else then tests the registration.
"""
import sys, time
import numpy as np
from scipy.spatial.distance import cdist

import os
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
# plant_growth.py is not in this repo. Override with PLANT_GROWTH_DIR if it moves.
GROWTH_DIR = os.environ.get('PLANT_GROWTH_DIR', os.path.expanduser('~/Downloads'))

sys.path.insert(0, HERE)
sys.path.insert(0, GROWTH_DIR)

import plant_registration as pr
from plant_growth import load_scan, preprocess, register_growth

# Raw Pheno4D scans; not in this repo. Override with PHENO4D_RAW.
RAW = os.environ.get('PHENO4D_RAW',
    os.path.join(os.path.dirname(REPO), 'SG-ideas', '3d-2d-morphology', 'data'))

PUBLISHED = dict(
    n_src=3000, n_tgt=3000, days=1,
    chamfer_before=20.245789207685412, chamfer_after=1.9790090544758772,
    disp_mean=28.55669992306476, disp_max=172.0940515960314,
    detJ_median=1.4467222148885492, detJ_p5=0.855280278200744,
    detJ_p95=2.297104131967016, detJ_frac_negative=0.0,
)

t0 = time.time()
Pa, La = load_scan(f'{RAW}/M01_0324_a.txt')
Pb, Lb = load_scan(f'{RAW}/M01_0325_a.txt')
print(f"raw points: {len(Pa)} -> {len(Pb)}   ({time.time()-t0:.0f}s)", flush=True)

src, ls = preprocess(Pa, La, 3000, 0, None, 2, seed=0)
tgt, lt = preprocess(Pb, Lb, 3000, 0, None, 2, seed=1)
print(f"after preprocess: {len(src)} -> {len(tgt)}", flush=True)

cd = lambda A, B: 0.5 * (cdist(A, B).min(1).mean() + cdist(B, A).min(1).mean())
cb = cd(src, tgt)
print(f"\nGATE 1 (preprocess only, no CPD):")
print(f"  chamfer_before  got {cb!r}")
print(f"                 want {PUBLISHED['chamfer_before']!r}")
print(f"  abs err {abs(cb - PUBLISHED['chamfer_before']):.3e}", flush=True)

print("\nrunning CPD (rigid=True)...", flush=True)
res = register_growth(src, tgt, beta=1.2, lam=30.0, w=0.2, rigid=True, verbose=False)
print(f"  sigma2 floor hits in cpd_rigid: {pr.cpd_rigid.floor_hits}", flush=True)

disp, detJ, warped = res['displacement'], res['detJ'], res['warped']
mag = np.linalg.norm(disp, axis=1)
got = dict(
    n_src=len(src), n_tgt=len(tgt), days=1,
    chamfer_before=cb, chamfer_after=cd(warped, tgt),
    disp_mean=float(mag.mean()), disp_max=float(mag.max()),
    detJ_median=float(np.median(detJ)),
    detJ_p5=float(np.percentile(detJ, 5)),
    detJ_p95=float(np.percentile(detJ, 95)),
    detJ_frac_negative=float((detJ < 0).mean()),
)

print("\nGATE 2 (full pipeline vs summary.csv, exporter tolerance 1e-9 relative):")
worst = 0.0
for k, want in PUBLISHED.items():
    g = got[k]
    err = abs(g - want) / max(1.0, abs(want))
    worst = max(worst, err)
    print(f"  {'OK ' if err <= 1e-9 else 'BAD'} {k:20s} got {g!r:26s} want {want!r}   rel {err:.3e}")
print(f"\nworst relative error {worst:.3e}   (exporter gate: 1e-9)")
print("VERDICT:", "M01 REPRODUCES" if worst <= 1e-9 else "M01 DOES NOT REPRODUCE -- do not ship")

if worst <= 1e-9:
    out = os.path.join(NPZ, 'M01_rigid.npz')
    np.savez(out, src=src, tgt=tgt, warped=warped, displacement=disp,
             detJ=detJ, rate_per_day=disp / 1, days=1)
    print("staged ->", out)
