#!/usr/bin/env python3
"""
Growth (displacement) field between day t and day t+1 for Pheno4D plants.

This is the half of the pipeline either side of the CPD solver in
`registration.py`: reading scans, deciding which points go in, putting both
scans in one frame, and turning the fitted map into a displacement field and a
det J per point.

Four decisions here are load-bearing, and each is a decision about honesty
rather than about accuracy:

  * Soil (label 0) is removed. It is a large, flat, unchanging surface; left in,
    it dominates the fit and the plant is registered as an afterthought.

  * ONE shared centre and scale for both scans, never per-scan. This is the
    single most important line in the file (see `register_growth`). Normalising
    each scan to its own size divides the growth out -- the plant would be the
    same size on both days by construction, and the thing being measured would
    be gone before the solver started.

  * Outlier weight `w` is high (0.2). New tissue at t+1 has no counterpart at t
    and must be allowed to go unexplained. A low `w` forces the solver to drag
    day-t points onto leaves that did not exist yet.

  * Displacement is reported per day. Every pair shipped here is one day apart,
    so rate and displacement are the same numbers; the division is kept so that
    a pair at a different interval cannot be silently read as if it were daily.

WHAT THIS CANNOT TELL YOU. The two scans are independently sampled and share no
point identity. Nothing here tracks a point. `displacement[i]` is where the
fitted map sends source point i -- an estimate about a surface, not an
observation of a particle. Large values are frequently leaf droop and swing
rather than tissue growth.

Pheno4D file naming (https://www.ipb.uni-bonn.de/data/pheno4d/):
    M01_0313_a.txt   labelled scan   (x y z [label ...])
    M01_0314.txt     unlabelled scan (x y z)
  M = maize, T = tomato; 01..07 plant id; MMDD scan date.
"""
import datetime as dt
import glob
import os
import re

import numpy as np
from scipy.spatial.distance import cdist

from .registration import NonRigidCPD, cpd_rigid

# ----------------------------------------------------------------------------
# Loading
# ----------------------------------------------------------------------------
SCAN_RE = re.compile(r"^([MT]\d+)_(\d{4})(_a)?\.(txt|xyz)$", re.I)


def find_scans(data_dir, plant):
    """-> sorted list of (MMDD, path) for one plant, searched recursively."""
    found = {}
    for p in glob.glob(os.path.join(data_dir, "**", "*"), recursive=True):
        m = SCAN_RE.match(os.path.basename(p))
        if m and m.group(1).upper() == plant.upper():
            found[m.group(2)] = p
    return sorted(found.items())


def days_between(day_a, day_b):
    f = lambda s: dt.date(2001, int(s[:2]), int(s[2:]))
    return (f(day_b) - f(day_a)).days


def load_scan(path):
    """Return (points (N,3), labels (N,) int or None).  Label = first label column."""
    try:
        import pandas as pd
        arr = pd.read_csv(path, sep=r"\s+", header=None, dtype=np.float64).to_numpy()
    except ImportError:
        arr = np.loadtxt(path)
    pts = arr[:, :3]
    lab = arr[:, 3].astype(int) if arr.shape[1] > 3 else None
    return pts, lab


# ----------------------------------------------------------------------------
# Pre-processing
# ----------------------------------------------------------------------------
def _voxel_first_idx(P, voxel):
    k = np.floor((P - P.min(0)) / voxel).astype(np.int64)
    n = k.max(0) + 1
    key = (k[:, 0] * n[1] + k[:, 1]) * n[2] + k[:, 2]
    return np.unique(key, return_index=True)[1]


def subsample_uniform(P, n, rng):
    """Voxel-thin to even density (scanner overlap makes density very uneven),
    then random-pick n.  Returns indices into P."""
    if len(P) <= n:
        return np.arange(len(P))
    diag = np.linalg.norm(np.ptp(P, axis=0))
    voxel = diag / np.sqrt(n) / 1.5
    for _ in range(12):
        idx = _voxel_first_idx(P, voxel)
        if len(idx) > 1.5 * n:
            voxel *= 1.25
        elif len(idx) < n:
            voxel /= 1.15
        else:
            break
    if len(idx) > n:
        idx = rng.choice(idx, n, replace=False)
    return idx


def preprocess(pts, lab, n, soil_label=0, z_crop=None, up_axis=2, seed=0):
    """Drop soil, subsample.  Returns (points, labels-or-None)."""
    rng = np.random.default_rng(seed)
    keep = np.ones(len(pts), bool)
    if lab is not None:
        if not (lab == soil_label).any():
            print(f"  warning: no points with soil label {soil_label}; nothing removed by label")
        keep &= lab != soil_label
    if z_crop is not None:
        keep &= pts[:, up_axis] > z_crop
    pts = pts[keep]
    lab = lab[keep] if lab is not None else None
    idx = subsample_uniform(pts, n, rng)
    return pts[idx], (lab[idx] if lab is not None else None)


# ----------------------------------------------------------------------------
# Registration for growth
# ----------------------------------------------------------------------------
def register_growth(src, tgt, beta=1.2, lam=30.0, w=0.2, rigid=True, verbose=True):
    """src = scan at t, tgt = scan at t+1 (both in the same world frame).

    Returns dict: src, tgt, warped, displacement, field(q), detJ, nonrigid.

    `rigid` DEFAULTS TO TRUE HERE, and that is a change from the source this was
    ported from, where it defaulted to False on the reasoning that Pheno4D scans
    already share a frame across days. Changed because every published result
    used rigid=True, so the old default silently handed a caller a different
    method than the one in `docs/plant_growth_slides.pdf`.

    It is not a cosmetic difference. On M06 the same fit folds over 90% of its
    points without the rigid step (median det J -1.163) and is clean with it
    (median 1.228). One specimen in fourteen -- but there is no way to know in
    advance which one, so it is applied to all of them.

    SHARED CENTRE AND SCALE
    -----------------------
    `c` and `s` below are computed over BOTH scans stacked together, and this is
    the line the whole measurement rests on. Normalising each scan separately
    would make the plant the same size on both days by definition and divide out
    exactly the growth being measured. Fitting a similarity scale inside CPD
    would do the same thing more slowly.
    """
    both = np.vstack([src, tgt])
    c = both.mean(0)
    s = np.sqrt(((both - c) ** 2).sum(1).mean())      # SHARED scale: growth is preserved
    Y, X = (src - c) / s, (tgt - c) / s

    if rigid:
        rg = cpd_rigid(X, Y, w=w, with_scale=False)
        pre = lambda Z: Z @ rg["R"].T + rg["t"]
    else:
        pre = lambda Z: Z
    Yp = pre(Y)

    nr = NonRigidCPD(beta=beta, lam=lam, w=w, verbose=verbose).fit(X, Yp)
    warped = nr.transform() * s + c

    def field(q):
        """Displacement at arbitrary points q (world coords) in the t -> t+1 map."""
        qn = (np.asarray(q) - c) / s
        return nr.transform(pre(qn)) * s + c - np.asarray(q)

    # det of Jacobian of x -> x + u(x), evaluated at the source points.
    # Shared isotropic scale means the normalised-frame Jacobian equals the world one;
    # a rigid pre-rotation has det = +1, so it does not change the determinant.
    detJ = np.linalg.det(nr.jacobian())

    return dict(src=src, tgt=tgt, warped=warped, displacement=warped - src, field=field,
                detJ=detJ, nonrigid=nr)


def chamfer(a, b):
    """Symmetric mean nearest-neighbour distance between two point sets.

    For every point in `a` take the distance to its nearest point in `b` and
    average; do the same from `b` to `a`; average the two.

    THIS IS THE ONLY FIT SCORE AVAILABLE, and it is a weak one. The two scans
    are independent samplings with no shared point identity, so the obvious
    question -- did point i land on point i -- cannot be asked. Chamfer asks
    whether the two SURFACES ended up in the same place, which is the question
    that can actually be answered.

    Consequence worth stating plainly: a good Chamfer does not mean the
    displacement vectors are right. A map that slid every point sideways along
    the surface would score identically to the correct one.

    The symmetric form matters. One direction alone is cheatable -- collapse
    every warped point onto a single spot on the target and the a->b mean looks
    excellent, while b->a exposes it.
    """
    return 0.5 * (cdist(a, b).min(1).mean() + cdist(b, a).min(1).mean())


def label_check(res, ls, lt):
    """Per-organ centroid distance to the t+1 organ centroid, before vs after."""
    labs = sorted(set(np.unique(ls)) & set(np.unique(lt)) - {0})
    if not labs:
        return
    print("\n  organ  n_src n_tgt  centroid err before -> after")
    eb, ea = [], []
    for l in labs:
        s_, t_, w_ = res["src"][ls == l], res["tgt"][lt == l], res["warped"][ls == l]
        b = np.linalg.norm(s_.mean(0) - t_.mean(0))
        a = np.linalg.norm(w_.mean(0) - t_.mean(0))
        eb.append(b); ea.append(a)
        print(f"  {l:5d} {len(s_):5d} {len(t_):5d}   {b:.4f} -> {a:.4f}")
    print(f"  mean   {'':11s}   {np.mean(eb):.4f} -> {np.mean(ea):.4f}")


