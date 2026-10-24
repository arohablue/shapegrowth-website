#!/usr/bin/env python3
"""
A synthetic plant that grows, written out in real Pheno4D file format.

This is what makes the package runnable by someone who has no data. Pheno4D
requires a signed licence agreement, so its scans are not redistributable and
are not in this repository. `python -m pipeline demo` generates a pair of scans
here instead and runs the identical pipeline over them.

It is also the only place in this package where GROUND TRUTH EXISTS. Row order
is stable between stages -- soil, stem, leaf 0, leaf 1, ... -- and new leaves
are appended rather than inserted, so point i at stage g really is point i at
stage g+1. Real Pheno4D scans have no such property: the two days are
independently sampled and share no point identity, which is the reason the whole
pipeline estimates correspondence instead of looking it up.

Do not read demo results as evidence about real plants. The synthetic plant
bends and extends by construction; it is a test that the code runs and that the
recovered field points the right way, not a measurement.
"""
import os

import numpy as np


def make_growing_plant(g, seed=0, n_leaves=6, n_leaf_pts=1500):
    """Plant at growth stage `g`.

    Returns (points, labels) with label 0 = soil, 1 = stem, 2.. = leaves.
    Label 0 matters: the pipeline drops it, exactly as it drops Pheno4D's soil.
    """
    rng = np.random.default_rng(seed)
    pts, lab = [], []

    # Soil disc. Present so that soil removal has something to remove.
    r = 0.25 * np.sqrt(rng.uniform(0, 1, 2000))
    a = rng.uniform(0, 2 * np.pi, 2000)
    pts.append(np.c_[r * np.cos(a), r * np.sin(a), np.zeros(2000)])
    lab.append(np.zeros(2000, int))

    # Stem: taller and more bent with age.
    H = 0.3 + 0.2 * g
    zu = rng.uniform(0, 1, 3000)
    th = rng.uniform(0, 2 * np.pi, 3000)
    bend = 0.05 * g * zu ** 2
    pts.append(np.c_[0.02 * np.cos(th) + bend, 0.02 * np.sin(th), H * zu])
    lab.append(np.ones(3000, int))

    for k in range(n_leaves):
        # Same (u, v) draw at every stage -> the k-th leaf is sampled at the
        # same parametric positions as it grows. This is the ground truth.
        u = rng.uniform(0, 1, n_leaf_pts)
        v = rng.uniform(-1, 1, n_leaf_pts)
        age = g - 0.7 * k
        if age < 0:
            continue                      # leaf not emerged yet at this stage
        L = 0.1 + 0.18 * age
        z0 = H * min(0.3 + 0.1 * k, 0.95)
        phi = 2.4 * k
        out = L * u
        width = 0.05 * np.sin(np.pi * np.clip(u, 0.03, 1)) ** 0.7
        zl = z0 + 0.35 * out - 0.9 * out ** 2
        xl, yl = out, v * width
        c_, s_ = np.cos(phi), np.sin(phi)
        x = c_ * xl - s_ * yl + 0.05 * g * (z0 / H) ** 2
        y = s_ * xl + c_ * yl
        pts.append(np.c_[x, y, zl])
        lab.append(np.full(n_leaf_pts, 2 + k))

    return np.vstack(pts), np.concatenate(lab)


def write_demo_files(out_dir, plant="M01", stages=((313, 2.0), (314, 3.0))):
    """Write two scans named the way Pheno4D names them: M01_0313_a.txt.

    The `_a` suffix marks a labelled scan, and the five columns are
    `x y z label label` -- maize style, where Pheno4D carries a collar label and
    a tip label. Only the first label column is read.

    A little noise is added so the two scans are not related by an exact
    transform. It uses a FIXED seed independent of the stage, so repeated runs
    are reproducible.
    """
    os.makedirs(out_dir, exist_ok=True)
    paths = []
    for day, g in stages:
        P, L = make_growing_plant(g)
        P = P + np.random.default_rng(5).normal(0, 0.002, P.shape)
        arr = np.c_[P, L, L]
        path = os.path.join(out_dir, f"{plant}_{day:04d}_a.txt")
        np.savetxt(path, arr, fmt=["%.5f"] * 3 + ["%d", "%d"])
        paths.append(path)
    return out_dir, paths
