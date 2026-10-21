#!/usr/bin/env python3
"""
Does the reimplemented CPD reproduce the published arrays?

The staged NPZ carry BOTH the inputs (src, tgt) and the outputs (warped,
displacement, detJ). So this is not a plausibility check: feed the recorded
inputs to the reimplementation and compare against the recorded outputs.

The _default NPZ are the rigid=False run, which isolates NonRigidCPD from
cpd_rigid. Run those first.
"""
import sys
import numpy as np

import os
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
# plant_growth.py is not in this repo. Override with PLANT_GROWTH_DIR if it moves.
GROWTH_DIR = os.environ.get('PLANT_GROWTH_DIR', os.path.expanduser('~/Downloads'))

sys.path.insert(0, HERE)
sys.path.insert(0, GROWTH_DIR)

from plant_growth import register_growth  # noqa: E402

NPZ = os.path.join(REPO, 'data', 'pheno4d-growth', 'npz')


def report(tag, got, want, unit=''):
    err = np.abs(got - want)
    scale = max(np.abs(want).max(), 1e-12)
    print(f"    {tag:22s} max abs err {err.max():.3e}   rel {err.max()/scale:.3e} {unit}")
    return err.max() / scale


def check(plant, rigid):
    suffix = 'rigid' if rigid else 'default'
    d = np.load(f'{NPZ}/{plant}_{suffix}.npz')
    src, tgt = d['src'], d['tgt']
    print(f"\n  {plant}_{suffix}  n={len(src)}  rigid={rigid}")

    res = register_growth(src, tgt, beta=1.2, lam=30.0, w=0.2, rigid=rigid, verbose=False)

    r = []
    r.append(report('warped', res['warped'], d['warped']))
    r.append(report('displacement', res['displacement'], d['displacement']))
    r.append(report('detJ', res['detJ'], d['detJ']))

    print(f"    detJ median  got {np.median(res['detJ']):.6f}  want {np.median(d['detJ']):.6f}")
    print(f"    disp mean    got {np.linalg.norm(res['displacement'],axis=1).mean():.6f}"
          f"  want {np.linalg.norm(d['displacement'],axis=1).mean():.6f}")
    return max(r)


if __name__ == '__main__':
    rigid = '--rigid' in sys.argv
    plants = [a for a in sys.argv[1:] if not a.startswith('--')] or ['M05']
    worst = 0.0
    for p in plants:
        worst = max(worst, check(p, rigid=rigid))
    print(f"\n  worst relative error across {plants} (rigid={rigid}): {worst:.3e}")
