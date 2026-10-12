#!/usr/bin/env python3
"""
build-leaf-dynamics-plates.py
================================================================================
WHAT
----
Builds everything the "Leaf Dynamics & Conformal Growth" offering shows, from
genuine PhenoLeaf-TS frames. Two jobs:

  1. The four STATIC plates, 03–06 of the six-plate chain:

       leaf-tracking.jpg          one identity across frames, with the shape
                                  descriptors computed from its masks
       conformal-mapping.jpg      the growth map leaf(t) -> leaf(t+dt), by the
                                  Riemann construction, with the correspondence
                                  it induces made visible
       growth-field.jpg           the displacement that map predicts, beside the
                                  measurement that was supposed to check it and
                                  the diagnostic that disqualified it
       quantitative-validation.jpg  the held-out test that replaced it

  2. The WEB ASSETS for the two interactive plates, 01–02, which are React
     components rather than images:

       observe-f{n}.jpg           sprite atlas of all frames, one request
       observe-poster.jpg         frame 0, painted before the atlas resolves
       leaf-dynamics.json         timestamps, palette, contours — the manifest

WHERE
-----
  reads:  data/leaf-morphology/01_raw_dataset/<genotype>/<rep>/*.png
          data/leaf-morphology/02_leaf_labels/<genotype>/<rep>/*.png
  writes: public/evidence/leaf-dynamics/

  run with the isolated venv (numpy/scipy/scikit-image/matplotlib/pillow/
  triangle; none of this is in system Python):

      ~/.cache/phenotyping-leaf-venv/bin/python scripts/build-leaf-dynamics-plates.py

  to regenerate for a different specimen, change SPECIMEN below — everything
  downstream, including the leaf choice and the growth pair, is derived.

WHAT CHANGED, AND WHY
---------------------
The previous version of this script shipped a plate called "conformal mapping"
that was `harmonic_map_to_disk`: pin the boundary to a circle at equal angular
spacing, solve Laplace for the interior. That is a harmonic parameterisation of
ONE leaf at ONE time. It is not conformal — the Riemann map's boundary
correspondence is determined by the domain, not chosen by a `linspace` — and it
is not a statement about growth at all.

Alim, Armon, Shraiman & Boudaoud (2016), "Leaf growth is conformal", Phys. Biol.
13(5) 05LT01, map leaf(t) onto leaf(t+dt) and ask whether the displacement that
map predicts matches a displacement independently measured. The geometry for
that now lives in `conformal_growth.py`, which also carries the asserts; this
file is rendering and asset export, and it imports rather than reimplements.

The PIV port of `../leaf mophology code/conformal.m` stays, but its job has
changed. It is no longer the validation — see `conformal_growth.py`'s docstring
for the measurements showing PhenoLeaf-TS cannot support that comparison, and
plate 05, which shows the diagnostic rather than hiding the retraction.

The tracking plate's leaf-to-leaf correspondence is NOT a tracking algorithm
this project runs. It is the dataset's own ground-truth instance colours, keyed
to `leaves_unique_colours.xlsx`. That is stated on the plate and in the site
copy, never implied as tracking.

UNITS
-----
px and px^2 throughout. PhenoLeaf-TS ships no spatial calibration, so there is
no mm/px, and nothing here returns a physical rate.
"""

from __future__ import annotations

import json
import re
import textwrap
from collections import OrderedDict
from datetime import datetime
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage
from skimage.exposure import equalize_adapthist
from skimage.feature import match_template
from skimage.measure import approximate_polygon, find_contours

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

import conformal_growth as cg  # noqa: E402

# ============================================================================
# SPECIMEN AND PATHS
# ============================================================================

# Changed by editing this line; there is no flag for it. Everything downstream —
# the atlas, the manifest, all six plates — is derived from this one pair, and a
# figure on the page that could have come from a different plant depending on how
# the script was invoked is not evidence of anything.
#
# WHY THIS SPECIMEN, AND THE DISSENT AGAINST IT
# ---------------------------------------------
# `scan-leaf-candidates.py` was re-run over all 318 replicates with the extended
# criteria (focus, clipping, mask-edge agreement, contour roughness, identity
# continuity, growth-pair availability). It did not pick this one:
#
#     Cvi-0/rep_08   total 0.634   max frame-to-frame |dA|/A  0.420   120 pairs
#     Col-0/rep_21   total 0.615   max frame-to-frame |dA|/A  0.134   203 pairs
#
# The incumbent was kept anyway, and the reason is worth more than the margin.
# That 0.019 separating them is the output of a weighting this repository chose;
# it is not a measurement. The max frame-to-frame area step is a measurement, and
# on it the two specimens are not close: Cvi-0's focus leaf changes area by 42%
# between two consecutive six-hour frames. A leaf does not do that. It is the
# signature of an occlusion or a label glitch — and it sits directly underneath
# plate 03, whose entire claim is that one identity persists across the series,
# and underneath the frame-pair selection that plates 04-06 depend on.
#
# So the tie was broken on the criterion the method actually requires rather than
# on the scalar that blends it with four other things. Rerunning the scan will
# keep reporting Cvi-0/rep_08 as its winner; that disagreement is expected, and
# this comment is the record of it rather than something to be "fixed" by
# reweighting the scanner until it agrees.
SPECIMEN = ("Col-0", "rep_21")

ROOT = Path(__file__).resolve().parent.parent
SRC_RAW = ROOT / "data" / "leaf-morphology" / "01_raw_dataset" / SPECIMEN[0] / SPECIMEN[1]
SRC_LABELS = ROOT / "data" / "leaf-morphology" / "02_leaf_labels" / SPECIMEN[0] / SPECIMEN[1]
OUT_DIR = ROOT / "public" / "evidence" / "leaf-dynamics"

# The dataset's instance palette, transcribed from `leaves_unique_colours.xlsx`
# (sheet "Leaf Colour Palette", 31 populated rows). It is inlined rather than
# read because the spreadsheet lives outside this repo with the 5.2 GB dataset,
# and the site's leaf tags must not depend on a path nobody checked out.
LEAF_PALETTE = {
    1: (244, 64, 14), 2: (48, 57, 249), 3: (234, 250, 37), 4: (24, 193, 65),
    5: (245, 130, 49), 6: (231, 80, 219), 7: (0, 182, 173), 8: (115, 0, 218),
    9: (191, 239, 69), 10: (255, 250, 200), 11: (250, 190, 212), 12: (66, 212, 244),
    13: (155, 99, 36), 14: (220, 190, 255), 15: (69, 158, 220), 16: (255, 216, 177),
    17: (98, 2, 37), 18: (227, 213, 12), 19: (79, 159, 83), 20: (170, 23, 101),
    21: (170, 255, 195), 22: (169, 169, 169), 23: (181, 111, 119), 24: (144, 121, 171),
    25: (9, 125, 244), 26: (184, 70, 30), 27: (154, 35, 246), 28: (229, 225, 238),
    29: (141, 254, 82), 30: (31, 200, 209), 31: (194, 217, 105),
}
PALETTE_BY_RGB = {v: k for k, v in LEAF_PALETTE.items()}

# ============================================================================
# PARAMETERS
# ============================================================================

# PIV — mirrors conformal.m's SETTINGS block.
WIN, STEP, SEARCH = 16, 4, 12
MIN_CORR, MIN_MASK = 0.60, 0.50
MEDIAN_WINDOW, OUTLIER_MAD_FACTOR = 3, 3

ZOOM_PAD = 18

# A leaf instance is REAL only if it survives this many frames. Leaf 10 of the
# palette appears in exactly one frame of this replicate — an annotation blip,
# not an organ — and would otherwise be drawn and tagged like the rest. The rule
# is applied here and stated on the plate rather than silently filtered.
MIN_INSTANCE_FRAMES = 3

# Alim et al. work at 10–42% area growth per interval. Pairs outside that are
# either too small to measure against the rasterisation or large enough that the
# linear interpolation in the held-out test stops being a fair question.
GROWTH_RANGE = (0.10, 0.42)

FIG_W_IN, FIG_H_IN, DPI = 12, 6.75, 160  # 1920x1080, 16:9
JPEG_QUALITY = 85

# Atlas. Every frame ships — the 6 h cadence IS the observation, and dropping
# every other frame erases the diurnal movement the plate exists to show.
ATLAS_COLS = 10
ATLAS_TILE_SCALE = 1.0
ATLAS_QUALITY = 78
CONTOUR_TOLERANCE = 1.2  # Douglas–Peucker, px

# Year, month, day, hour, MINUTE, SECOND. The minutes are not decoration: the
# capture clock drifts, so the nominal six-hourly cadence is really 4.99-7.00 h
# and the sequence starts at 17:03:10 rather than 17:00. Truncating at the hour
# — which this did — made every timestamp on every plate and in the manifest
# disagree with the filename it came from, and flattened the irregular cadence
# into a tidy 5/6/7 that the experiment never actually ran at. Both of those are
# the page quietly improving on its own data.
TIMESTAMP_RE = re.compile(r"(\d{4})_(\d{2})_(\d{2})_(\d{2})_(\d{2})_(\d{2})")

INK = "#15161a"
ACCENT = "#e2434d"
PREDICT = "#2f6fdb"
MUTED = "#9aa0a6"


# ============================================================================
# DATA LOADING
# ============================================================================


def parse_timestamp(name: str) -> tuple:
    m = TIMESTAMP_RE.search(name)
    if not m:
        raise ValueError(f"could not parse timestamp from filename: {name}")
    return tuple(int(g) for g in m.groups())


def load_frame_pairs():
    """Raw and label files, chronological, and asserted to be the same frames.

    The two directories are sorted independently and then checked timestamp by
    timestamp. Silently zipping two sorted listings is how a raw frame ends up
    paired with the wrong mask, which no plate would look wrong enough to catch.
    """
    raw_files = sorted(SRC_RAW.glob("*.png"), key=lambda p: parse_timestamp(p.name))
    label_files = sorted(SRC_LABELS.glob("*.png"), key=lambda p: parse_timestamp(p.name))
    n = min(len(raw_files), len(label_files))
    raw_files, label_files = raw_files[:n], label_files[:n]

    stamps = [parse_timestamp(p.name) for p in raw_files]
    for i, (r, l) in enumerate(zip(raw_files, label_files)):
        if parse_timestamp(r.name) != parse_timestamp(l.name):
            raise RuntimeError(
                f"frame {i}: raw {r.name} and label {l.name} are different timepoints"
            )
    for i in range(1, len(stamps)):
        if stamps[i] <= stamps[i - 1]:
            raise RuntimeError(f"frame {i} does not come after frame {i - 1}")
    return raw_files, label_files


def load_rgb(path: Path) -> np.ndarray:
    return np.array(Image.open(path).convert("RGB"))


def frame_datetime(path: Path) -> datetime:
    return datetime(*parse_timestamp(path.name))


# ============================================================================
# MASKS
# ============================================================================


def leaf_mask(label_arr: np.ndarray, color: tuple) -> np.ndarray:
    mask = np.all(label_arr == np.array(color), axis=-1)
    if not mask.any():
        return mask
    mask = ndimage.binary_fill_holes(mask)
    labeled, n = ndimage.label(mask, structure=np.ones((3, 3)))
    if n > 1:
        sizes = ndimage.sum(mask, labeled, index=range(1, n + 1))
        mask = labeled == (int(np.argmax(sizes)) + 1)
    return mask


def plant_mask(label_arr: np.ndarray) -> np.ndarray:
    """Every annotated pixel. The background is white, not black, in this set."""
    return ~np.all(label_arr >= 250, axis=-1) & ~np.all(label_arr == 0, axis=-1)


def bbox_from_mask(mask: np.ndarray, pad: int) -> tuple:
    ys, xs = np.where(mask)
    h, w = mask.shape
    if len(xs) == 0:
        return 0, w, 0, h
    x0, x1 = max(0, int(xs.min()) - pad), min(w, int(xs.max()) + pad)
    y0, y1 = max(0, int(ys.min()) - pad), min(h, int(ys.max()) + pad)
    return x0, x1, y0, y1


def union_bbox(boxes: list) -> tuple:
    return (min(b[0] for b in boxes), max(b[1] for b in boxes),
            min(b[2] for b in boxes), max(b[3] for b in boxes))


# ============================================================================
# THE INSTANCE CENSUS — which palette colours are real organs here
# ============================================================================


def instance_census(label_files: list) -> dict:
    """Per palette colour: the frames it occupies and the area it covers.

    Returns only instances that clear `MIN_INSTANCE_FRAMES`, with the rejects
    reported. `frames_present` is counted separately from the span, because the
    difference between them is a gap, and a leaf with a gap cannot carry a claim
    about continuous identity even though its colour is the same on both sides.
    """
    areas = {leaf: [] for leaf in LEAF_PALETTE}
    for path in label_files:
        arr = load_rgb(path)
        present = {tuple(int(x) for x in c) for c in np.unique(arr.reshape(-1, 3), axis=0)}
        for leaf, rgb in LEAF_PALETTE.items():
            areas[leaf].append(int(np.all(arr == np.array(rgb), axis=-1).sum())
                               if rgb in present else 0)

    census, rejected = {}, []
    for leaf, series in areas.items():
        a = np.array(series)
        idx = np.nonzero(a)[0]
        if len(idx) == 0:
            continue
        if len(idx) < MIN_INSTANCE_FRAMES:
            rejected.append((leaf, len(idx), int(a.max())))
            continue
        census[leaf] = {
            "rgb": LEAF_PALETTE[leaf],
            "areas": a,
            "first": int(idx[0]),
            "last": int(idx[-1]),
            "frames_present": int(len(idx)),
            "span": int(idx[-1] - idx[0] + 1),
            "peak_px2": int(a.max()),
        }
    return census, rejected


# A mask below this cannot carry a Riemann mesh at DEFAULT_EDGE: it has too
# little perimeter to reach the module's 40-boundary-vertex floor. Frames under
# it are not "the leaf, small" — they are frames the map plates cannot use.
MIN_MAPPABLE_PX2 = 900


def select_tracked_leaf(census: dict) -> int:
    """The leaf every plate follows. Three gates, then one score.

    GAPLESS. Not traded off against anything, because it is the only criterion
    whose failure makes a claim on the page false rather than a plate small. A
    leaf that vanishes for eleven frames and returns — leaf 1 here — has not
    been shown to be the same leaf by anything this page can point at.

    EMERGES AFTER THE FIRST FRAME. An instance already present when imaging
    began had its early development happen off-camera, so the observation plate
    would open mid-story and the growth plates could never show the fast phase.
    On this replicate that gate is what separates the two cotyledons, which are
    present at frame 0 and peak around 1800 px2, from the rosette leaves, which
    emerge in sequence and reach 4200–4800. It is a measurable rule rather than
    a botanical assertion, and it happens to pick out the same set.

    MAPPABLE. Counted in frames above `MIN_MAPPABLE_PX2`, because a leaf's
    useful span is the part of it the Riemann map can actually be built on, not
    the part where its colour exists.

    The score is then that mappable span, tie-broken on peak area.
    """
    pool = [
        k for k, v in census.items()
        if v["frames_present"] == v["span"]
        and v["first"] > 0
        and int((v["areas"] >= MIN_MAPPABLE_PX2).sum()) > 0
    ]
    if not pool:
        raise RuntimeError("no gapless instance emerges during the recording")
    return max(pool, key=lambda k: (int((census[k]["areas"] >= MIN_MAPPABLE_PX2).sum()),
                                    census[k]["peak_px2"]))


# ============================================================================
# PIV — a direct port of conformal.m's simplePIV + cleaning pipeline
# ============================================================================


def simple_piv(g0: np.ndarray, g1: np.ndarray, mask: np.ndarray):
    h, w = g0.shape
    hw = WIN // 2
    xs = np.arange(hw + SEARCH, w - hw - SEARCH, STEP)
    ys = np.arange(hw + SEARCH, h - hw - SEARCH, STEP)
    X, Y = np.meshgrid(xs, ys)
    U = np.full(X.shape, np.nan)
    V = np.full(X.shape, np.nan)
    C = np.full(X.shape, np.nan)

    for j in range(X.shape[0]):
        for i in range(X.shape[1]):
            xc, yc = int(X[j, i]), int(Y[j, i])
            m = mask[yc - hw : yc + hw, xc - hw : xc + hw]
            if m.size == 0 or m.mean() < MIN_MASK:
                continue
            patch = g0[yc - hw : yc + hw, xc - hw : xc + hw]
            if patch.std() < 0.005:
                continue
            search_img = g1[
                yc - hw - SEARCH : yc + hw + SEARCH,
                xc - hw - SEARCH : xc + hw + SEARCH,
            ]
            if search_img.shape[0] < patch.shape[0] + 1 or search_img.shape[1] < patch.shape[1] + 1:
                continue
            result = match_template(search_img, patch)
            peak_idx = np.unravel_index(np.argmax(result), result.shape)
            peak = result[peak_idx]
            if peak < MIN_CORR:
                continue
            py, px = peak_idx
            U[j, i] = px - SEARCH
            V[j, i] = py - SEARCH
            C[j, i] = peak
    return X, Y, U, V, C


def rigid_motion_removal(X, Y, U, V):
    valid = np.isfinite(U) & np.isfinite(V)
    xv, yv, uv, vv = X[valid], Y[valid], U[valid], V[valid]
    xc, yc = xv.mean(), yv.mean()
    Xc, Yc = xv - xc, yv - yc
    n = len(xv)
    A = np.zeros((2 * n, 3))
    b = np.zeros(2 * n)
    A[0::2, 0] = 1
    A[0::2, 2] = -Yc
    A[1::2, 1] = 1
    A[1::2, 2] = Xc
    b[0::2] = uv
    b[1::2] = vv
    p, *_ = np.linalg.lstsq(A, b, rcond=None)
    tx, ty, omega = p
    return U - (tx - omega * (Y - yc)), V - (ty + omega * (X - xc)), (float(tx), float(ty), float(omega))


def fill_nearest(arr: np.ndarray) -> np.ndarray:
    mask = np.isnan(arr)
    if not mask.any():
        return arr.copy()
    if mask.all():
        return np.zeros_like(arr)
    idx = ndimage.distance_transform_edt(mask, return_distances=False, return_indices=True)
    return arr[tuple(idx)]


def local_outlier_rejection(U_res, V_res):
    valid = np.isfinite(U_res) & np.isfinite(V_res)
    U_med = ndimage.median_filter(fill_nearest(U_res), size=MEDIAN_WINDOW, mode="nearest")
    V_med = ndimage.median_filter(fill_nearest(V_res), size=MEDIAN_WINDOW, mode="nearest")
    dev = np.hypot(U_res - U_med, V_res - V_med)
    d = dev[valid]
    if d.size == 0:
        threshold = np.inf
    else:
        med = np.median(d)
        threshold = med + OUTLIER_MAD_FACTOR * np.median(np.abs(d - med))
    outlier = valid & (dev > threshold)
    U_clean, V_clean = U_res.copy(), V_res.copy()
    U_clean[outlier] = np.nan
    V_clean[outlier] = np.nan
    return U_clean, V_clean, int(valid.sum()), int(outlier.sum()), int((valid & ~outlier).sum())


def run_piv_pipeline(raw0, raw1, mask0):
    g0 = equalize_adapthist(np.asarray(raw0.mean(axis=-1) / 255.0, dtype=float))
    g1 = equalize_adapthist(np.asarray(raw1.mean(axis=-1) / 255.0, dtype=float))
    X, Y, U, V, _ = simple_piv(g0, g1, mask0)
    if (np.isfinite(U) & np.isfinite(V)).sum() < 4:
        return None
    U_res, V_res, rigid = rigid_motion_removal(X, Y, U, V)
    U_clean, V_clean, n_raw, n_rejected, n_clean = local_outlier_rejection(U_res, V_res)
    return {"X": X, "Y": Y, "U_clean": U_clean, "V_clean": V_clean, "rigid": rigid,
            "n_raw": n_raw, "n_rejected": n_rejected, "n_clean": n_clean, "gray0": g0}


def piv_vectors(piv):
    ok = np.isfinite(piv["U_clean"]) & np.isfinite(piv["V_clean"])
    return (np.stack([piv["X"][ok], piv["Y"][ok]], axis=1),
            np.stack([piv["U_clean"][ok], piv["V_clean"][ok]], axis=1), ok)


# ============================================================================
# FRAME SELECTION
# ============================================================================


def rosette_centre(label_arr: np.ndarray) -> np.ndarray:
    ys, xs = np.nonzero(plant_mask(label_arr))
    return np.array([xs.mean(), ys.mean()])


def choose_growth_pair(label_files, leaf_rgb, census_entry, max_gap: int = 6):
    """The frame pair the map plates are built on.

    Alim's own regime (10–42% area growth) first, then — among the pairs that
    qualify — the one whose two Riemann maps both pass their asserts and whose
    boundary offsets agree most tightly. Rejecting on map quality is the point:
    a plate drawn from a map that is not a bijection is a picture of a bug.
    """
    areas = census_entry["areas"]
    lo, hi = census_entry["first"], census_entry["last"]
    candidates = []
    for a in range(lo, hi + 1):
        if areas[a] < 400:
            continue
        for b in range(a + 2, min(a + max_gap, hi) + 1):
            if areas[b] <= 0:
                continue
            g = areas[b] / areas[a] - 1.0
            if GROWTH_RANGE[0] <= g <= GROWTH_RANGE[1]:
                candidates.append((a, b, g))
    if not candidates:
        raise RuntimeError("no frame pair falls in Alim's growth regime for this leaf")

    centre = rosette_centre(load_rgb(label_files[(lo + hi) // 2]))
    best = None
    for a, b, g in sorted(candidates, key=lambda c: -areas[c[0]])[:24]:
        try:
            ma = leaf_mask(load_rgb(label_files[a]), leaf_rgb)
            mb = leaf_mask(load_rgb(label_files[b]), leaf_rgb)
            mesh_a, mesh_b = cg.build_mesh(ma), cg.build_mesh(mb)
            phi_a, rep_a = cg.riemann_map(*mesh_a)
            phi_b, rep_b = cg.riemann_map(*mesh_b)
            theta, align = cg.align_disk(
                phi_a, phi_b, mesh_a[0], mesh_b[0], mesh_a[2], mesh_b[2],
                cg.leaf_landmarks(mesh_a[0], mesh_a[2], centre),
                cg.leaf_landmarks(mesh_b[0], mesh_b[2], centre),
            )
        except cg.MapQualityError as exc:
            print(f"    pair {a}->{b} ({g * 100:+.1f}%) rejected: {exc}")
            continue
        score = align["boundary_concentration"] * np.sqrt(ma.sum())
        print(f"    pair {a}->{b} ({g * 100:+.1f}%)  concentration "
              f"{align['boundary_concentration']:.3f}  theta {align['theta_deg']:+.2f} deg")
        if best is None or score > best["score"]:
            best = {"score": score, "a": a, "b": b, "growth": g, "centre": centre,
                    "mask_a": ma, "mask_b": mb, "mesh_a": mesh_a, "mesh_b": mesh_b,
                    "phi_a": phi_a, "phi_b": phi_b, "rep_a": rep_a, "rep_b": rep_b,
                    "theta": theta, "align": align}
    if best is None:
        raise RuntimeError("every candidate pair failed its Riemann-map asserts")
    return best


def choose_tracking_pair(census_entry):
    """Two frames the descriptor table has something to say about.

    The earlier one is the first frame the leaf is mappable at, not the first
    frame its colour appears: a 154 px2 speck is a true observation and a
    useless panel, and the descriptors computed from it are dominated by the
    rasterisation. The later one is where growth has visibly flattened, found
    from the area series rather than fixed, so the pair still spans the
    expansion when a different specimen is substituted.
    """
    areas = census_entry["areas"]
    lo, hi = census_entry["first"], census_entry["last"]
    mappable = np.nonzero(areas >= MIN_MAPPABLE_PX2)[0]
    a = int(mappable[0]) if len(mappable) else lo
    plateau = np.nonzero(areas >= areas.max() * 0.92)[0]
    b = int(plateau[0]) if len(plateau) and plateau[0] > a else hi
    return a, b


def heldout_triples(census_entry, around: int, n: int = 8, gap: int = 3):
    """Evenly spaced (t0, t1, t2) triples inside the leaf's readable span."""
    lo, hi = census_entry["first"], census_entry["last"]
    areas = census_entry["areas"]
    start = max(lo, int(np.argmax(areas > areas.max() * 0.15)))
    end = min(hi - 2 * gap, start + 40)
    if end <= start:
        start, end = lo, hi - 2 * gap
    bases = np.unique(np.round(np.linspace(start, end, n)).astype(int))
    return [(int(t), int(t + gap), int(t + 2 * gap)) for t in bases]


# ============================================================================
# FIGURE OUTPUT
# ============================================================================


def new_figure():
    fig = plt.figure(figsize=(FIG_W_IN, FIG_H_IN), dpi=DPI)
    fig.patch.set_facecolor("white")
    return fig


def save_figure(fig, name: str):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / name
    fig.savefig(path, dpi=DPI, pil_kwargs={"quality": JPEG_QUALITY})
    plt.close(fig)
    with Image.open(path) as im:
        w, h = im.size
    print(f"  wrote {path.relative_to(ROOT)}  {w}x{h}  {path.stat().st_size / 1024:.0f} KB")


def style_axis(ax, title: str = "", size: float = 8.5):
    ax.set_xticks([])
    ax.set_yticks([])
    for spine in ax.spines.values():
        spine.set_visible(False)
    if title:
        ax.set_title(wrap_to_axis(ax, title, size), fontsize=size, family="monospace",
                     color=INK, linespacing=1.5)


# ---------------------------------------------------------------------------
# LAYOUT
# ---------------------------------------------------------------------------
# `tight_layout` is not used anywhere in this file, and the four warnings it used
# to emit were telling the truth: every panel here is an `aspect="equal"` image
# or triangulation, so matplotlib shrinks the axes inside its cell AFTER the
# layout engine has run. tight_layout then reserved space for a box that no
# longer exists, which is where the clipped headers, the colliding panel titles
# and the 250 px of dead white band above and below the content came from.
#
# So the plate reserves its bands explicitly instead: a header at the top, an
# optional footnote at the bottom, and whatever is left over handed to the
# gridspec. Both text blocks are wrapped to a character budget computed from the
# figure's real width, because a 1920 px plate at 9 pt monospace fits 160
# characters and a 215-character sentence silently runs off both edges.

SIDE_MARGIN = 0.028


def _char_budget(size: float, fraction: float = 1.0) -> int:
    """How many monospace characters fit across `fraction` of the figure."""
    char_in = 0.601 * size / 72.0  # DejaVu Sans Mono advance width
    return max(16, int(FIG_W_IN * (1 - 2 * SIDE_MARGIN) * fraction / char_in))


def _line_height(size: float) -> float:
    return size * 1.45 / 72.0 / FIG_H_IN


def wrap_to_axis(ax, text: str, size: float) -> str:
    """Wrap a panel title to the width of the cell it sits over.

    Line breaks already in the string are kept — a title that chose to put the
    fitted rotation on its own line meant it.
    """
    width = _char_budget(size, ax.get_position().width / (1 - 2 * SIDE_MARGIN) * 0.98)
    return "\n".join("\n".join(textwrap.wrap(line, width) or [line])
                     for line in text.split("\n"))


def plate_bands(fig, header: str, footer: str = "", title_lines: int = 1,
                header_size: float = 8.6, footer_size: float = 7.4) -> dict:
    """Draw the header and footnote, and return the gridspec extent left over.

    Returns kwargs for `add_gridspec`, so the caller never guesses a `top` or a
    `bottom` and the two text blocks can never be overdrawn by a panel.

    `title_lines` is the tallest panel title in the row. A panel title is drawn
    ABOVE its axes but is not part of the gridspec cell, so a `top` that only
    clears the header leaves the titles to be written straight through it — which
    is what happened on the first pass of all four plates.
    """
    head = textwrap.wrap(header, _char_budget(header_size)) or [""]
    fig.text(0.5, 0.985, "\n".join(head), ha="center", va="top", fontsize=header_size,
             family="monospace", color=INK, linespacing=1.5)
    top = (0.985
           - len(head) * _line_height(header_size) * 1.5
           - title_lines * _line_height(8.5) * 1.6
           - 0.018)

    bottom = 0.03
    if footer:
        foot = textwrap.wrap(footer, _char_budget(footer_size)) or [""]
        fig.text(0.5, 0.018, "\n".join(foot), ha="center", va="bottom", fontsize=footer_size,
                 family="monospace", color="#555a60", linespacing=1.6)
        bottom = 0.018 + len(foot) * _line_height(footer_size) * 1.6 + 0.018

    return dict(left=SIDE_MARGIN, right=1 - SIDE_MARGIN, top=top, bottom=bottom)


def anchor_top(*axes):
    """Pin aspect-equal panels to the top of their cells.

    An `aspect="equal"` axis that cannot fill its cell is centred by default, so
    a row of panels of different shapes floats at different heights and their
    titles end up on different lines. Pinning north aligns the titles and
    collects the slack in one place at the bottom instead of splitting it.
    """
    for ax in axes:
        ax.set_anchor("N")


def draw_contours(ax, mask, offset=(0, 0), **kw):
    for c in find_contours(mask.astype(float), 0.5):
        ax.plot(c[:, 1] - offset[0], c[:, 0] - offset[1], **kw)


# ============================================================================
# PLATE 03 — leaf-tracking
# ============================================================================


def make_tracking_plate(raw_files, label_files, leaf_id, census, frames):
    """One identity across frames, and the descriptors its masks give up.

    The contour overlay is translated to each frame's own centroid and rotated
    onto the attachment->tip axis, and NOT scaled. Scaling out the size would
    erase the growth the plate exists to show and leave a comparison of outline
    alone; the normalisation is stated on the plate for that reason.
    """
    leaf_rgb = LEAF_PALETTE[leaf_id]
    centre = rosette_centre(load_rgb(label_files[frames[1]]))
    masks = [leaf_mask(load_rgb(label_files[i]), leaf_rgb) for i in frames]
    x0, x1, y0, y1 = union_bbox([bbox_from_mask(m, ZOOM_PAD) for m in masks])

    elapsed = (frame_datetime(label_files[frames[1]])
               - frame_datetime(label_files[frames[0]])).total_seconds() / 3600
    live = sum(1 for v in census.values() if v["frames_present"] == v["span"])

    fig = new_figure()
    band = plate_bands(
        fig,
        f"{SPECIMEN[0]} / {SPECIMEN[1]} — leaf {leaf_id}, {elapsed:.0f} h apart. "
        f"Correspondence is the dataset's own instance labels, not a tracker run here. "
        f"{len(census)} instances pass the {MIN_INSTANCE_FRAMES}-frame filter, {live} without gaps.")
    gs = fig.add_gridspec(1, 3, width_ratios=[1, 1, 1.25], wspace=0.08, **band)
    desc = []
    panels = []
    for k, (i, mask) in enumerate(zip(frames, masks)):
        ax = fig.add_subplot(gs[0, k])
        panels.append(ax)
        raw = load_rgb(raw_files[i]).astype(float)
        label = load_rgb(label_files[i])
        blend = raw.copy()
        pm = plant_mask(label)
        blend[pm] = 0.62 * raw[pm] + 0.38 * label[pm]
        ax.imshow(blend.astype(np.uint8)[y0:y1, x0:x1])
        draw_contours(ax, mask[y0:y1, x0:x1], color="#f5c518", linewidth=1.6)
        ys, xs = np.nonzero(mask)
        ax.annotate(f"L{leaf_id}", (xs.mean() - x0, ys.mean() - y0), color="white",
                    fontsize=9, fontweight="bold", ha="center", va="center",
                    bbox=dict(boxstyle="round,pad=0.2", fc="black", alpha=0.6, lw=0))
        ts = frame_datetime(label_files[i])
        style_axis(ax, f"frame {i}   {ts:%d %b %H:%M}")
        desc.append(cg.shape_descriptors(mask, centre))

    ax = fig.add_subplot(gs[0, 2])
    panels.append(ax)
    for d, colour, lab in zip(desc, [MUTED, ACCENT], ["earlier", "later"]):
        c = np.vstack([d["normalised_contour"], d["normalised_contour"][:1]])
        ax.plot(c[:, 0], c[:, 1], color=colour, linewidth=1.8, label=lab)
    ax.set_aspect("equal")
    ax.invert_yaxis()
    legend = ax.legend(loc="lower right", fontsize=8, frameon=True,
                       prop={"family": "monospace"})
    legend.get_frame().set(facecolor="white", edgecolor="none")  # the outline runs under it
    style_axis(ax, "contours on a common centroid and axis — not rescaled")

    rows = [
        ("area",      f"{desc[0]['area_px2']:.0f}",      f"{desc[1]['area_px2']:.0f}",      "px2"),
        ("perimeter", f"{desc[0]['perimeter_px']:.0f}",  f"{desc[1]['perimeter_px']:.0f}",  "px"),
        ("bbox w",    f"{desc[0]['bbox_w_px']:.0f}",     f"{desc[1]['bbox_w_px']:.0f}",     "px"),
        ("bbox h",    f"{desc[0]['bbox_h_px']:.0f}",     f"{desc[1]['bbox_h_px']:.0f}",     "px"),
    ]
    # The table goes under the two photographs, not under the contour panel: its
    # two numeric columns ARE those two frames, and the aspect-equal contour axis
    # cannot say in advance how tall it will end up, so a box pinned inside it
    # lands on the outline it annotates.
    anchor_top(*panels)
    rows.insert(0, ("", f"frame {frames[0]}", f"frame {frames[1]}", ""))
    table = "\n".join(f"{n:<10}{a:>8}{b:>9}  {u}" for n, a, b, u in rows)
    left, right = gs[0, 0].get_position(fig), gs[0, 1].get_position(fig)
    fig.text((left.x0 + right.x1) / 2, band["bottom"] + 0.02, table,
             family="monospace", fontsize=10, va="bottom", ha="center",
             multialignment="left", color=INK,
             bbox=dict(boxstyle="square,pad=0.6", fc="white", ec="#d8dade", lw=0.8))
    save_figure(fig, "leaf-tracking.jpg")
    print(f"  frames {frames}, {elapsed:.0f} h apart; "
          f"area {desc[0]['area_px2']:.0f} -> {desc[1]['area_px2']:.0f} px2")


# ============================================================================
# PLATE 04 — conformal-mapping
# ============================================================================


def make_conformal_plate(pair, label_files):
    """The growth map, and the correspondence it induces, made visible.

    Three panels sharing ONE colour scale: hue is the angle in the disk, so the
    same hue means the same point of the Riemann image in all three. A band that
    is narrow on the earlier leaf and wide on the later one is where the map says
    the blade expanded, and it can be read off the picture rather than asserted.
    """
    mesh_a, mesh_b = pair["mesh_a"], pair["mesh_b"]
    phi_a, phi_b, theta = pair["phi_a"], pair["phi_b"], pair["theta"]
    pts_a, tris_a, nb_a = mesh_a
    pts_b, tris_b, nb_b = mesh_b

    hue_a = (np.angle(phi_a) + np.pi) / (2 * np.pi)
    hue_b = (np.angle(phi_b * np.exp(1j * theta)) + np.pi) / (2 * np.pi)
    cmap = plt.get_cmap("twilight")

    hours = (frame_datetime(label_files[pair["b"]])
             - frame_datetime(label_files[pair["a"]])).total_seconds() / 3600
    fig = new_figure()
    band = plate_bands(
        fig,
        f"Riemann map of each blade onto the unit disk, after Alim et al. (2016). "
        f"Frames {pair['a']}->{pair['b']}, {hours:.0f} h, {pair['growth'] * 100:+.1f}% area. "
        f"Matching hue is the same point of the shared disk.",
        "Alim et al. pin three landmarks and exhaust the Mobius group. These masks give two — "
        "petiole attachment and tip — so the remaining rotation is least-squares fitted over the "
        f"margin instead of pinned (it lands {pair['align']['landmark_disagreement_deg']:.1f} deg "
        "from the landmarks' own answer). The composed map is therefore harmonic-exact and only "
        "approximately conformal.", title_lines=2)
    gs = fig.add_gridspec(1, 3, width_ratios=[1, 0.95, 1], wspace=0.1, **band)

    ax = fig.add_subplot(gs[0, 0])
    panels = [ax]
    ax.tripcolor(pts_a[:, 0], pts_a[:, 1], tris_a, hue_a, cmap=cmap, shading="gouraud")
    ax.triplot(pts_a[:, 0], pts_a[:, 1], tris_a, color="white", linewidth=0.18, alpha=0.5)
    ax.set_aspect("equal")
    ax.invert_yaxis()
    style_axis(ax, f"leaf at t   {rep_line(pair['rep_a'])}")

    ax = fig.add_subplot(gs[0, 1])
    panels.append(ax)
    disk = phi_a
    ax.tripcolor(disk.real, disk.imag, tris_a, hue_a, cmap=cmap, shading="gouraud")
    circle = np.exp(1j * np.linspace(0, 2 * np.pi, 400))
    ax.plot(circle.real, circle.imag, color=INK, linewidth=1.0)
    ax.set_aspect("equal")
    style_axis(ax, "the shared Riemann image, with both disks aligned\n"
                   f"rotation fitted over the margin: {np.degrees(theta):+.1f} deg")

    ax = fig.add_subplot(gs[0, 2])
    panels.append(ax)
    ax.tripcolor(pts_b[:, 0], pts_b[:, 1], tris_b, hue_b, cmap=cmap, shading="gouraud")
    ax.triplot(pts_b[:, 0], pts_b[:, 1], tris_b, color="white", linewidth=0.18, alpha=0.5)
    ax.set_aspect("equal")
    ax.invert_yaxis()
    style_axis(ax, f"leaf at t+dt   {rep_line(pair['rep_b'])}")

    anchor_top(*panels)
    save_figure(fig, "conformal-mapping.jpg")
    print(f"  frames {pair['a']}->{pair['b']}  theta {np.degrees(theta):+.2f} deg  "
          f"concentration {pair['align']['boundary_concentration']:.3f}")


def rep_line(rep) -> str:
    return (f"{rep['vertices']} verts, winding {rep['winding']:.3f}, "
            f"{rep['folded_area_fraction'] * 100:.3f}% inverted")


# ============================================================================
# PLATE 05 — growth-field
# ============================================================================


def make_growth_plate(pair, raw_files, label_files, piv, piv_short, diag):
    """The predicted field, the measured one, and why the measured one was dropped.

    The honest version of this plate is not the predicted field alone. The
    published method validates against a measurement, we implemented that
    measurement, and it failed its own noise floor — so the retraction is shown
    here rather than left as an absence nobody can interrogate.
    """
    mask_a = pair["mask_a"]
    x0, x1, y0, y1 = bbox_from_mask(mask_a, ZOOM_PAD)
    raw = load_rgb(raw_files[pair["a"]])
    pos_p, disp_p, prep = cg.predicted_field(
        pair["mesh_a"], pair["phi_a"], pair["mesh_b"], pair["phi_b"], pair["theta"])
    good = np.isfinite(disp_p).all(axis=1)
    pos_p, disp_p = pos_p[good], disp_p[good]
    pos_o, disp_o, _ = piv_vectors(piv)

    _, _, ok_s = piv_vectors(piv_short)
    both = ok_s & np.isfinite(piv["U_clean"]) & np.isfinite(piv["V_clean"])
    dl = np.stack([piv["U_clean"][both], piv["V_clean"][both]], axis=1)
    ds = np.stack([piv_short["U_clean"][both], piv_short["V_clean"][both]], axis=1)
    consistency = cg.nested_interval_consistency(ds, dl)
    hours_long = (frame_datetime(label_files[pair["b"]])
                  - frame_datetime(label_files[pair["a"]])).total_seconds() / 3600
    hours_short = (frame_datetime(label_files[(pair["a"] + pair["b"]) // 2])
                   - frame_datetime(label_files[pair["a"]])).total_seconds() / 3600
    scaling = cg.nested_interval_scaling(ds, dl, hours_short, hours_long)

    fig = new_figure()
    band = plate_bands(
        fig,
        f"Predicted and measured displacement over frames {pair['a']}->{pair['b']}, "
        f"rigid motion removed from both.",
        "Right: both measured fields start at the same frame, so the longer interval must come out "
        f"about {scaling['expected_ratio']:.0f}x larger. It comes out "
        f"{scaling['measured_ratio']:.2f}x — the points sit on the dashed line, not the solid one. "
        "A displacement that barely depends on how long you waited is not measuring a rate, and the "
        f"direction agreement beside it (r = {consistency:+.2f}) is the two intervals reproducing "
        "the same artefact rather than the same growth. "
        f"At this magnification the blade spans {int(np.ptp(np.nonzero(mask_a)[1]) + 1)} by "
        f"{int(np.ptp(np.nonzero(mask_a)[0]) + 1)} px with no resolvable venation, so block matching "
        f"finds a peak (median {diag['peak_median']:.2f}) it cannot localise: it clears its nearest "
        f"rival by {diag['margin_median']:.2f}, ambiguous at "
        f"{diag['ambiguous_fraction'] * 100:.0f}% of sites. The measured field is shown because it "
        "was run, not because it is evidence.", title_lines=2)
    gs = fig.add_gridspec(1, 3, width_ratios=[1.15, 1.15, 1], wspace=0.14, **band)

    ax = fig.add_subplot(gs[0, 0])
    panels = [ax]
    ax.imshow(raw[y0:y1, x0:x1], extent=[x0, x1, y1, y0])
    draw_contours(ax, mask_a, color="#f5c518", linewidth=1.2)
    step = max(1, len(pos_p) // 260)
    ax.quiver(pos_p[::step, 0], pos_p[::step, 1], disp_p[::step, 0], disp_p[::step, 1],
              color=PREDICT, angles="xy", scale_units="xy", scale=0.6, width=0.004)
    ax.set_xlim(x0, x1)
    ax.set_ylim(y1, y0)
    style_axis(ax, f"PREDICTED by the conformal map\n{prep['landed']}/{prep['evaluated']} vertices")

    ax = fig.add_subplot(gs[0, 1])
    panels.append(ax)
    ax.imshow(raw[y0:y1, x0:x1], extent=[x0, x1, y1, y0])
    draw_contours(ax, mask_a, color="#f5c518", linewidth=1.2)
    ax.quiver(pos_o[:, 0], pos_o[:, 1], disp_o[:, 0], disp_o[:, 1],
              color=ACCENT, angles="xy", scale_units="xy", scale=0.6, width=0.004)
    ax.set_xlim(x0, x1)
    ax.set_ylim(y1, y0)
    style_axis(ax, f"MEASURED by block matching\n{piv['n_clean']}/{piv['n_raw']} vectors kept")

    ax = fig.add_subplot(gs[0, 2])
    lim = float(np.percentile(np.abs(np.concatenate([ds.ravel(), dl.ravel()])), 98)) * 1.15
    guide = np.array([-lim, lim])
    ax.plot(guide, guide * scaling["expected_ratio"], color=INK, lw=1.0,
            label=f"if it scaled with time ({scaling['expected_ratio']:.0f}x)")
    ax.plot(guide, guide, color=MUTED, lw=1.0, ls="--", label="if it did not scale at all (1x)")
    ax.scatter(np.concatenate([ds[:, 0], ds[:, 1]]),
               np.concatenate([dl[:, 0], dl[:, 1]]),
               s=10, color=ACCENT, alpha=0.6, linewidths=0)
    ax.set_xlim(-lim, lim)
    ax.set_ylim(-lim * 1.2, lim * 1.2)
    ax.set_xlabel(f"displacement over {hours_short:.0f} h, px", fontsize=8, family="monospace")
    ax.set_ylabel(f"displacement over {hours_long:.0f} h, px", fontsize=8, family="monospace")
    ax.tick_params(labelsize=7)
    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)
    ax.legend(fontsize=7, frameon=False, loc="lower right",
              prop={"family": "monospace", "size": 7})
    title = (f"the measurement against itself\ndirection r = {consistency:+.2f},  "
             f"magnitude {scaling['measured_ratio']:.2f}x")
    ax.set_title(wrap_to_axis(ax, title, 8.5), fontsize=8.5, family="monospace",
                 color=INK, linespacing=1.5)

    anchor_top(*panels)
    save_figure(fig, "growth-field.jpg")
    print(f"  predicted {prep['landed']}/{prep['evaluated']} vertices; PIV {piv['n_clean']}/{piv['n_raw']}; "
          f"direction r = {consistency:+.3f}; magnitude {scaling['measured_ratio']:.2f}x "
          f"of an expected {scaling['expected_ratio']:.1f}x")
    return consistency, scaling


# ============================================================================
# PLATE 06 — quantitative-validation
# ============================================================================


def make_validation_plate(label_files, leaf_rgb, triples, results, centre):
    """The held-out test, and the three baselines that decide what it means.

    A score with no baseline is unreadable: 0.77 IoU sounds good until the mask
    compared against itself scores 0.51. The arc-length null is the one that
    matters — it is the correspondence the conformal map exists to improve on.
    """
    show = max(results, key=lambda r: r["iou_conformal"] - r["iou_no_growth"])
    i = results.index(show)
    t0, t1, t2 = triples[i]
    m0 = leaf_mask(load_rgb(label_files[t0]), leaf_rgb)
    m1 = leaf_mask(load_rgb(label_files[t1]), leaf_rgb)
    m2 = leaf_mask(load_rgb(label_files[t2]), leaf_rgb)
    x0, x1, y0, y1 = union_bbox([bbox_from_mask(m, ZOOM_PAD) for m in (m0, m1, m2)])

    c = np.array([r["iou_conformal"] for r in results])
    a = np.array([r["iou_arc_length"] for r in results])
    n = np.array([r["iou_no_growth"] for r in results])

    fig = new_figure()
    band = plate_bands(
        fig,
        f"Held-out test: build the map from t0 to t2, predict t1, score against t1's real mask. "
        f"Median IoU {np.median(c):.3f} conformal, {np.median(a):.3f} arc-length, "
        f"{np.median(n):.3f} no growth.",
        f"The conformal map beats the static baseline by {np.mean(c - n):+.3f} IoU across "
        f"{len(results)} triples, and the arc-length correspondence it was meant to improve on by "
        f"{np.mean(c - a):+.3f} +/- {np.std(c - a):.3f} — ahead in {int((c > a).sum())} of {len(c)}. "
        "That difference is smaller than its own scatter, so at this resolution and cadence the two "
        "are not separable, and this is reported rather than rounded into a result. The measured-"
        "displacement validation of Alim et al. is not available here; see the previous plate.")
    # The bar chart's legend sits above its axes, so this plate alone gives up a
    # strip of the content band to hold it.
    gs = fig.add_gridspec(1, 2, width_ratios=[1, 1.5], wspace=0.14,
                          **{**band, "top": band["top"] - 0.05})

    ax = fig.add_subplot(gs[0, 0])
    ax.imshow(np.ones((y1 - y0, x1 - x0)), cmap="gray", vmin=0, vmax=1,
              extent=[x0, x1, y1, y0])
    ax.imshow(np.ma.masked_where(~m1, m1.astype(float))[y0:y1, x0:x1],
              extent=[x0, x1, y1, y0], cmap="Greens", vmin=0, vmax=1.6, alpha=0.5)
    draw_contours(ax, m0, color=MUTED, linewidth=1.2, linestyle=":")
    draw_contours(ax, m2, color=MUTED, linewidth=1.2, linestyle="--")
    mesh_0, mesh_2 = cg.build_mesh(m0), cg.build_mesh(m2)
    phi_0, _ = cg.riemann_map(*mesh_0)
    phi_2, _ = cg.riemann_map(*mesh_2)
    th, _ = cg.align_disk(phi_0, phi_2, mesh_0[0], mesh_2[0], mesh_0[2], mesh_2[2],
                          cg.leaf_landmarks(mesh_0[0], mesh_0[2], centre),
                          cg.leaf_landmarks(mesh_2[0], mesh_2[2], centre))
    margin0 = mesh_0[0][: mesh_0[2]]
    pred = margin0 + (cg.boundary_correspondence(mesh_0, phi_0, mesh_2, phi_2, th)
                      - margin0) * show["fraction"]
    ring = np.vstack([pred, pred[:1]])
    ax.plot(ring[:, 0], ring[:, 1], color=PREDICT, linewidth=2.0)
    ax.set_xlim(x0, x1)
    ax.set_ylim(y1, y0)
    style_axis(ax, f"frames {t0} and {t2} given; the blue margin is where the map "
                   f"puts frame {t1}")
    anchor_top(ax)
    cell = gs[0, 0].get_position(fig)
    fig.text(cell.x0 + cell.width / 2, band["bottom"] + 0.01,
             f"green  the real frame {t1} mask, never shown to the map\n"
             f"dotted frame {t0}        dashed frame {t2}\n"
             f"IoU    {show['iou_conformal']:.3f}",
             family="monospace", fontsize=8, va="bottom", ha="center",
             multialignment="left", color=INK,
             bbox=dict(boxstyle="square,pad=0.45", fc="white", ec="#d8dade", lw=0.8))

    ax = fig.add_subplot(gs[0, 1])
    keys = ["iou_conformal", "iou_arc_length", "iou_uniform_dilation", "iou_no_growth"]
    names = ["conformal map", "arc-length null", "uniform dilation", "no growth"]
    colours = [PREDICT, "#7a8089", MUTED, "#d8dade"]
    xs = np.arange(len(results))
    w = 0.2
    for k, (key, name, colour) in enumerate(zip(keys, names, colours)):
        ax.bar(xs + (k - 1.5) * w, [r[key] for r in results], w, label=name,
               color=colour, linewidth=0)
    ax.set_xticks(xs)
    ax.set_xticklabels([f"{a}\u2192{b}\u2192{c}" for a, b, c in triples],
                       fontsize=7, family="monospace")
    ax.set_ylabel("held-out IoU against the real middle frame", fontsize=8, family="monospace")
    ax.set_ylim(0, 1)
    ax.tick_params(axis="y", labelsize=7)
    ax.legend(fontsize=7.5, frameon=False, ncol=4, loc="upper center",
              bbox_to_anchor=(0.5, 1.1), prop={"family": "monospace", "size": 7.5})
    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)
    ax.grid(axis="y", color="#eceef0", linewidth=0.8)
    ax.set_axisbelow(True)

    save_figure(fig, "quantitative-validation.jpg")


# ============================================================================
# WEB ASSETS — the sprite atlas, the poster, and the manifest
# ============================================================================


def atlas_crop(label_files) -> tuple:
    """The box every frame is cropped to: the union of the annotated rosette.

    Cropping to it discards the dead white border at zero information cost,
    which is most of the atlas's byte saving. The union rather than per-frame
    boxes, so a frame index maps to a tile without a per-frame offset and the
    plant does not jitter against the frame during playback.
    """
    boxes = []
    for p in label_files:
        pm = plant_mask(load_rgb(p))
        if pm.any():
            boxes.append(bbox_from_mask(pm, 8))
    x0, x1, y0, y1 = union_bbox(boxes)
    return int(x0), int(y0), int(x1 - x0), int(y1 - y0)


def export_atlas(raw_files, crop) -> dict:
    cx, cy, cw, ch = crop
    tw, th = int(round(cw * ATLAS_TILE_SCALE)), int(round(ch * ATLAS_TILE_SCALE))
    n = len(raw_files)
    rows = int(np.ceil(n / ATLAS_COLS))
    sheet = Image.new("RGB", (ATLAS_COLS * tw, rows * th), (255, 255, 255))
    for i, path in enumerate(raw_files):
        tile = Image.open(path).convert("RGB").crop((cx, cy, cx + cw, cy + ch))
        if (tw, th) != (cw, ch):
            tile = tile.resize((tw, th), Image.LANCZOS)
        sheet.paste(tile, ((i % ATLAS_COLS) * tw, (i // ATLAS_COLS) * th))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    name = "observe-atlas.jpg"
    sheet.save(OUT_DIR / name, quality=ATLAS_QUALITY, optimize=True, progressive=True)
    size = (OUT_DIR / name).stat().st_size

    poster = Image.open(raw_files[0]).convert("RGB").crop((cx, cy, cx + cw, cy + ch))
    poster.save(OUT_DIR / "observe-poster.jpg", quality=82, optimize=True)

    print(f"  wrote {name}  {sheet.width}x{sheet.height}  {size / 1024:.0f} KB  "
          f"({n} tiles of {tw}x{th}, {ATLAS_COLS}x{rows})")
    print(f"  wrote observe-poster.jpg  {(OUT_DIR / 'observe-poster.jpg').stat().st_size / 1024:.0f} KB")
    return {"tier": "full", "tile": {"w": tw, "h": th}, "cols": ATLAS_COLS, "rows": rows,
            "urls": [f"/evidence/leaf-dynamics/{name}"], "bytes": int(size)}


def simplified_contour(mask, crop) -> dict | None:
    """One leaf's outline, Douglas–Peucker-thinned, in CROP coordinates.

    In crop coordinates rather than source coordinates because the browser never
    sees an uncropped frame, and a contour that needs an offset applied is a
    contour that will one day be drawn without it.
    """
    cx, cy, cw, ch = crop
    contours = find_contours(mask.astype(float), 0.5)
    if not contours:
        return None
    ring = approximate_polygon(max(contours, key=len), CONTOUR_TOLERANCE)[:, ::-1]
    ring = ring - np.array([cx, cy])
    ys, xs = np.nonzero(mask)
    perim = float(np.sum(np.linalg.norm(np.diff(np.vstack([ring, ring[:1]]), axis=0), axis=1)))
    return {
        "points": [int(round(v)) for v in ring.reshape(-1)],
        "bbox": [int(xs.min() - cx), int(ys.min() - cy),
                 int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)],
        "centroid": [round(float(xs.mean() - cx), 1), round(float(ys.mean() - cy), 1)],
        "areaPx2": int(mask.sum()),
        "perimeterPx": round(perim, 1),
    }


def export_manifest(raw_files, label_files, crop, tier, census, tracked, segment_frame):
    source = Image.open(raw_files[0]).size
    start = frame_datetime(raw_files[0])
    frames = []
    for i, p in enumerate(raw_files):
        t = frame_datetime(p)
        frames.append({
            "i": i, "file": p.name, "t": t.isoformat(),
            "epoch": int(t.timestamp()),
            "hoursFromStart": round((t - start).total_seconds() / 3600, 2),
        })

    label = load_rgb(label_files[segment_frame])
    contours = []
    for leaf, entry in sorted(census.items()):
        if not (entry["first"] <= segment_frame <= entry["last"]):
            continue
        m = leaf_mask(label, entry["rgb"])
        if m.sum() < 60:
            continue
        c = simplified_contour(m, crop)
        if c is None:
            continue
        contours.append({"leaf": leaf, "frame": segment_frame, **c})

    manifest = {
        "schema": 1,
        "dataset": "PhenoLeaf-TS",
        "specimen": f"{SPECIMEN[0]}/{SPECIMEN[1]}",
        "units": "px",
        "calibration": None,
        "source": {"w": source[0], "h": source[1]},
        "crop": list(crop),
        "poster": "/evidence/leaf-dynamics/observe-poster.jpg",
        "frames": frames,
        "tiers": [tier],
        "leaves": [
            {"id": leaf, "tag": f"L{leaf}", "color": list(e["rgb"]),
             "firstFrame": e["first"], "lastFrame": e["last"],
             "framesPresent": e["frames_present"]}
            for leaf, e in sorted(census.items())
        ],
        "segment": {"frame": segment_frame, "focus": tracked, "contours": contours},
    }

    path = OUT_DIR / "leaf-dynamics.json"
    path.write_text(json.dumps(manifest, separators=(",", ":")))
    print(f"  wrote {path.relative_to(ROOT)}  {path.stat().st_size / 1024:.0f} KB  "
          f"({len(frames)} frames, {len(manifest['leaves'])} leaves, "
          f"{len(contours)} contours on frame {segment_frame})")

    # The identity check the plan asks for, run against what actually shipped.
    for c in contours:
        rgb = np.array(LEAF_PALETTE[c["leaf"]])
        if not np.any(np.all(label == rgb, axis=-1)):
            raise RuntimeError(f"leaf {c['leaf']} has a contour but no pixels on frame {segment_frame}")
    return manifest


# ============================================================================
# MAIN
# ============================================================================


def main():
    print(f"Specimen {SPECIMEN[0]}/{SPECIMEN[1]}")
    raw_files, label_files = load_frame_pairs()
    span = frame_datetime(raw_files[-1]) - frame_datetime(raw_files[0])
    print(f"  {len(raw_files)} frame pairs, {frame_datetime(raw_files[0]):%Y-%m-%d %H:%M} -> "
          f"{frame_datetime(raw_files[-1]):%Y-%m-%d %H:%M} ({span.days} d)")

    print("\nInstance census")
    census, rejected = instance_census(label_files)
    for leaf, frames_present, peak in rejected:
        print(f"  leaf {leaf} rejected: {frames_present} frame(s), peak {peak} px2 "
              f"— below the {MIN_INSTANCE_FRAMES}-frame floor")
    for leaf, e in sorted(census.items()):
        gap = "" if e["frames_present"] == e["span"] else f"  GAP {e['span'] - e['frames_present']} fr"
        print(f"  leaf {leaf:2d} {str(e['rgb']):>16}  frames {e['first']:3d}-{e['last']:3d} "
              f"({e['frames_present']:3d} present)  peak {e['peak_px2']:5d} px2{gap}")

    tracked = select_tracked_leaf(census)
    leaf_rgb = LEAF_PALETTE[tracked]
    entry = census[tracked]
    print(f"  tracking leaf {tracked} {leaf_rgb}: frames {entry['first']}-{entry['last']}, no gaps")

    print("\nGrowth pair (Alim regime, both maps must pass their asserts)")
    pair = choose_growth_pair(label_files, leaf_rgb, entry)
    print(f"  chosen {pair['a']}->{pair['b']}  {pair['growth'] * 100:+.1f}%  "
          f"theta {np.degrees(pair['theta']):+.2f} deg")

    print("\n[03] leaf-tracking.jpg")
    make_tracking_plate(raw_files, label_files, tracked, census,
                        choose_tracking_pair(entry))

    print("\n[04] conformal-mapping.jpg")
    make_conformal_plate(pair, label_files)

    print("\n[05] growth-field.jpg")
    mid = (pair["a"] + pair["b"]) // 2
    piv = run_piv_pipeline(load_rgb(raw_files[pair["a"]]), load_rgb(raw_files[pair["b"]]), pair["mask_a"])
    piv_short = run_piv_pipeline(load_rgb(raw_files[pair["a"]]), load_rgb(raw_files[mid]), pair["mask_a"])
    if piv is None or piv_short is None:
        raise RuntimeError("PIV produced no vectors on the chosen pair")
    diag = cg.texture_localisability(
        piv["gray0"], equalize_adapthist(np.asarray(load_rgb(raw_files[pair["b"]]).mean(axis=-1) / 255.0)),
        pair["mask_a"], win=WIN, search=SEARCH)
    print(f"  texture: grey sd {diag['grey_sd']:.4f}, peak median {diag['peak_median']:.3f}, "
          f"margin median {diag['margin_median']:+.3f}, ambiguous {diag['ambiguous_fraction'] * 100:.0f}%")
    make_growth_plate(pair, raw_files, label_files, piv, piv_short, diag)

    print("\n[06] quantitative-validation.jpg")
    triples = heldout_triples(entry, pair["a"])
    results = []
    kept = []
    for t0, t1, t2 in triples:
        masks = [leaf_mask(load_rgb(label_files[t]), leaf_rgb) for t in (t0, t1, t2)]
        hours = [frame_datetime(label_files[t]) for t in (t0, t1, t2)]
        frac = (hours[1] - hours[0]).total_seconds() / (hours[2] - hours[0]).total_seconds()
        try:
            r = cg.heldout_interpolation(*masks, pair["centre"], frac)
        except cg.MapQualityError as exc:
            print(f"  {t0}->{t1}->{t2} skipped: {exc}")
            continue
        results.append(r)
        kept.append((t0, t1, t2))
        print(f"  {t0}->{t1}->{t2}  conformal {r['iou_conformal']:.3f}  arc {r['iou_arc_length']:.3f}  "
              f"dilation {r['iou_uniform_dilation']:.3f}  static {r['iou_no_growth']:.3f}")
    make_validation_plate(label_files, leaf_rgb, kept, results, pair["centre"])

    print("\nWeb assets")
    crop = atlas_crop(label_files)
    print(f"  crop {crop[2]}x{crop[3]} at ({crop[0]}, {crop[1]}) of {Image.open(raw_files[0]).size}")
    tier = export_atlas(raw_files, crop)
    segment_frame = min(len(label_files) - 1, entry["last"])
    export_manifest(raw_files, label_files, crop, tier, census, tracked, segment_frame)

    total = sum(p.stat().st_size for p in OUT_DIR.glob("*") if p.is_file())
    print(f"\nTotal in {OUT_DIR.relative_to(ROOT)}: {total / 1024 / 1024:.2f} MB")


if __name__ == "__main__":
    main()
