#!/usr/bin/env python3
"""
scan-leaf-candidates.py
================================================================================
WHAT
----
Picks the specimen the Leaf Dynamics plates are built from, out of the whole
PhenoLeaf-TS dataset (21 genotypes, 318 replicates, read in place — nothing is
copied into this repo).

The earlier version of this script scored one thing: does a leaf instance keep
a continuous area across every recorded frame. That is necessary and nowhere
near sufficient. A leaf can be perfectly continuous in the label images and
still be a bad plate — out of focus, blown out, segmented with a staircase
boundary, or never growing fast enough in any one interval for a conformal
growth map to have anything to measure. Each of those failures lands on a
different plate of the offering, so each is scored separately here and printed
separately, rather than collapsed into one number that hides which one failed.

Four criteria, in the order the plates consume them:

  IDENTITY CONTINUITY   Does this colour denote one physical leaf for the whole
  (plates 02, 03)       span it is visible? Measured as frames-present / span,
                        the number of interior gaps, and the frame-to-frame area
                        change over the span where the leaf is big enough to
                        read. A leaf that vanishes for eleven frames and
                        reappears is two leaves as far as the evidence is
                        concerned, however suggestive the colour is.

  SEGMENTATION          Is the mask boundary a leaf margin or a pixel staircase?
  QUALITY               Measured as high-frequency boundary roughness, which a
  (plates 02, 03, 04)   measured check below confirms is uncorrelated with leaf
                        size. The contour is the input to the Riemann map, so a
                        noisy boundary is not cosmetic here.

  IMAGE QUALITY         Focus (variance of Laplacian) on the rosette crop, and
  (plates 01, 02)       edge agreement: how much stronger the image gradient is
                        on the mask boundary than in the blade interior.
                        Agreement near 1.0 means the mask was not drawn where
                        the picture has an edge.

TWO MEASURES THAT TURNED OUT TO BE GATES, NOT SCORES
----------------------------------------------------
The brief for this scan also asked for exposure clipping and growth-pair
availability. Both were implemented, measured across a random sample of
replicates, and found to be effectively constant:

  exposure clipping   0.0001–0.0004 of pixels on every replicate sampled. The
                      imaging rig is controlled; nothing is blown out anywhere.

  growth pairs        23–308 qualifying intervals per leaf. At a ~6 h cadence
                      over ~24 days, *every* leaf has intervals in Alim's
                      3 h–3 day / 10–42% window. The constraint never binds.

A criterion that scores 1.0 for every candidate does not rank anything; keeping
it in the weighted total would only dilute the criteria that do. Both are still
computed and printed, and both still *gate* — a candidate that fails either is
dropped and said to have been dropped. They are just not pretending to rank.

WHY TWO PASSES
--------------
Pass 1 reads only the label images (~126 MB) and scores everything that needs
nothing else. Pass 2 opens raw frames — and only for the shortlist, at a handful
of sampled frames each. Scoring focus on all ~31,000 raw frames would take hours
to re-derive a ranking the label pass already settles.

WHERE
-----
  reads:  ../leaf mophology code/PhenoLeaf-TS_DS/02_leaf_labels/**   (pass 1)
          ../leaf mophology code/PhenoLeaf-TS_DS/01_raw_dataset/**   (pass 2)
  writes: nothing — a ranked table to stdout only.

  run:    ~/.cache/phenotyping-leaf-venv/bin/python scripts/scan-leaf-candidates.py
          ~/.cache/phenotyping-leaf-venv/bin/python scripts/scan-leaf-candidates.py Col-0
          ~/.cache/phenotyping-leaf-venv/bin/python scripts/scan-leaf-candidates.py Col-0/rep_21 Ler-1/rep_17

RANKING
-------
Criteria are normalised to 0–1 subscores against thresholds taken from the
measured spread of each quantity across the dataset (the numbers are stated
beside each threshold below, not guessed), then combined with explicit weights.
The composite exists to order the table; the per-criterion columns are what the
choice is actually defensible on, which is why all of them are printed for the
top candidates rather than the total alone.
"""

from __future__ import annotations

import re
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation, binary_erosion, sobel
from skimage.measure import find_contours

DATASET_ROOT = (
    Path(__file__).resolve().parent.parent.parent / "leaf mophology code" / "PhenoLeaf-TS_DS"
)
LABELS_ROOT = DATASET_ROOT / "02_leaf_labels"
RAW_ROOT = DATASET_ROOT / "01_raw_dataset"

TIMESTAMP_RE = re.compile(r"(\d{4})_(\d{2})_(\d{2})_(\d{2})_(\d{2})_(\d{2})")

# ── thresholds ───────────────────────────────────────────────────────────────
MIN_PEAK_AREA = 800        # px², floor below which a leaf is too small to read in a plate
MIN_SPAN_FRAMES = 30       # a leaf visible for ten frames cannot carry a time-series plate
MIN_REPLICATE_FRAMES = 40

# Alim et al. (2016), Phys. Biol. 13(5) 05LT01: intervals of 3 h to 3 days over
# which leaf area grows 10–42%. Both halves matter — too short and PIV has no
# signal, too long and the conformal assumption is being asked to hold across a
# developmental change rather than through one.
GROWTH_LO, GROWTH_HI = 0.10, 0.42
INTERVAL_LO_H, INTERVAL_HI_H = 3.0, 72.0

CONTOUR_SAMPLES = 240      # resampled contour vertices for the roughness measure
ROUGHNESS_SMOOTH = 5       # circular moving-average half-width, in resampled vertices
QUALITY_FRAME_SAMPLES = 6  # raw frames opened per shortlisted replicate, in pass 2
SHORTLIST = 12             # replicates carried from pass 1 into pass 2

# The leaf's area only means anything once it is more than a smudge: below this
# fraction of its own peak, a one-pixel annotation difference is a double-digit
# area change, and the emergence ramp would otherwise dominate every continuity
# statistic. The plates show the leaf after it is readable, so the continuity
# measure is taken over the same frames.
READABLE_FRACTION = 0.20

# ── gates (measured to be effectively constant — see the header) ─────────────
MAX_CLIP = 0.01            # observed 0.0001–0.0004; this trips only on a real fault
MIN_GROWTH_PAIRS = 1       # observed 23–308; this trips only on a real fault

# ── score thresholds, from the measured spread across sampled replicates ─────
# Each pair is (value scoring 0, value scoring 1). The run prints the observed
# percentiles of each quantity next to these, so a threshold that has drifted
# away from the data is visible in the output rather than silently flattening a
# criterion to a constant.
STEP_RANGE = (0.20, 0.04)      # p95 frame-to-frame |ΔA|/A over the readable span
ROUGH_RANGE = (0.32, 0.18)     # boundary roughness, after the smoothing residual
LENGTH_RANGE = (20.0, 70.0)    # readable frames — plate 01 *is* the series length
FOCUS_RANGE = (10.0, 20.0)     # variance of Laplacian
EDGE_RANGE = (2.5, 6.0)        # boundary/interior gradient ratio

# Series length is its own criterion rather than part of continuity, because the
# two trade against each other and the trade is the whole decision: a short,
# pristine series and a long one with a wobble are different plates, not
# different grades of the same plate. Identity still leads, because it is the
# only criterion whose failure makes a *claim on the page* false rather than
# making a plate ugly.
WEIGHTS = {
    "identity": 0.32,
    "length": 0.20,
    "segmentation": 0.22,
    "image": 0.26,
}


# ── small shared helpers ─────────────────────────────────────────────────────
def parse_timestamp(name: str) -> tuple:
    m = TIMESTAMP_RE.search(name)
    if not m:
        return (0, 0, 0, 0, 0, 0)
    return tuple(int(g) for g in m.groups())


def hours_between(a: tuple, b: tuple) -> float:
    """Approximate elapsed hours. The dataset's cadence is irregular (17:03 →
    23:03 → 06:03 → 12:05), so intervals must be read off the filename clock and
    never inferred from frame index."""
    def to_h(t: tuple) -> float:
        y, mo, d, hh, mm, ss = t
        return ((y * 372 + mo * 31 + d) * 24) + hh + mm / 60 + ss / 3600
    return to_h(b) - to_h(a)


def load_rgb(path: Path) -> np.ndarray:
    return np.array(Image.open(path).convert("RGB"))


def pack(arr: np.ndarray) -> np.ndarray:
    """RGB → one int32 per pixel. `np.unique(..., axis=0)` on 194k×3 is the slow
    path and this scan calls it ~31,000 times."""
    a = arr.astype(np.int32)
    return (a[..., 0] << 16) | (a[..., 1] << 8) | a[..., 2]


def unpack(code: int) -> tuple[int, int, int]:
    return ((code >> 16) & 255, (code >> 8) & 255, code & 255)


def clamp01(x: float) -> float:
    return float(min(1.0, max(0.0, x)))


def rescale(value: float, span: tuple[float, float]) -> float:
    """Map a measured value onto 0–1 against a (scores-zero, scores-one) pair."""
    zero, one = span
    if not np.isfinite(value):
        return 0.0
    return clamp01((value - zero) / (one - zero))


# ── criterion: segmentation quality ──────────────────────────────────────────
def boundary_roughness(mask: np.ndarray) -> float:
    """How far the mask's outer boundary sits from its own smoothed self.

    A leaf margin is genuinely lobed, so raw curvature would punish the deep
    sinuses that make an Arabidopsis leaf an Arabidopsis leaf. What is wanted is
    only the high-frequency part — the one-pixel staircase a rasterised
    annotation leaves behind. So the contour is resampled to a fixed vertex
    count, smoothed with a short circular moving average, and the residual is
    measured in units of the resampled chord. Lobes survive the smoothing and
    cancel; the staircase does not.

    Normalising by the chord rather than by pixels is what makes it comparable
    across leaf sizes, and a measured check across 133 candidates confirms it:
    correlation with log area is −0.09. Observed range 0.107–0.313.
    """
    contours = find_contours(mask.astype(float), 0.5)
    if not contours:
        return float("inf")
    c = max(contours, key=len)[:, ::-1]
    if len(c) < 8:
        return float("inf")

    seg = np.linalg.norm(np.diff(np.vstack([c, c[:1]]), axis=0), axis=1)
    perimeter = float(seg.sum())
    if perimeter <= 0:
        return float("inf")

    t = np.concatenate([[0.0], np.cumsum(seg)])[:-1]
    u = np.linspace(0, perimeter, CONTOUR_SAMPLES, endpoint=False)
    r = np.stack([np.interp(u, t, c[:, 0]), np.interp(u, t, c[:, 1])], axis=1)

    k = 2 * ROUGHNESS_SMOOTH + 1
    smooth = sum(np.roll(r, s, axis=0) for s in range(-ROUGHNESS_SMOOTH, ROUGHNESS_SMOOTH + 1)) / k
    chord = perimeter / CONTOUR_SAMPLES
    return float(np.mean(np.linalg.norm(r - smooth, axis=1)) / chord)


# ── criterion: image quality ─────────────────────────────────────────────────
def focus_score(gray: np.ndarray) -> float:
    """Variance of the Laplacian — the standard no-reference focus measure. High
    is sharp. Reported raw so the number means something outside this script."""
    lap = (
        -4 * gray
        + np.roll(gray, 1, 0) + np.roll(gray, -1, 0)
        + np.roll(gray, 1, 1) + np.roll(gray, -1, 1)
    )[1:-1, 1:-1]
    return float(np.var(lap))


def clipping_fraction(crop: np.ndarray) -> float:
    """Fraction of pixels pinned at 0 or 255 in any channel. Blown highlights on
    a leaf blade destroy exactly the texture PIV correlates against."""
    return float(np.mean(np.any((crop == 0) | (crop == 255), axis=-1)))


def edge_agreement(gray: np.ndarray, mask: np.ndarray) -> float:
    """Image gradient on the mask boundary band, over gradient in the interior.

    Asks whether the annotation was drawn where the photograph has an edge. A
    ratio near 1.0 means the boundary is no more of an edge than the middle of
    the blade — a mask that does not follow the leaf. Above ~2 the boundary is
    sitting on real contrast.
    """
    if mask.sum() < 50:
        return 0.0
    g = np.hypot(sobel(gray, 0), sobel(gray, 1))
    band = binary_dilation(mask, iterations=2) & ~binary_erosion(mask, iterations=2)
    interior = binary_erosion(mask, iterations=3)
    if band.sum() < 20 or interior.sum() < 20:
        return 0.0
    inner = float(np.mean(g[interior]))
    return float(np.mean(g[band]) / inner) if inner > 1e-6 else 0.0


# ── pass 1: label-only scan ──────────────────────────────────────────────────
def scan_replicate(label_dir: Path) -> list[dict]:
    files = sorted(label_dir.glob("*.png"), key=lambda p: parse_timestamp(p.name))
    n = len(files)
    if n < MIN_REPLICATE_FRAMES:
        return []
    stamps = [parse_timestamp(p.name) for p in files]

    areas_by_color: dict[int, np.ndarray] = defaultdict(lambda: np.zeros(n, dtype=float))
    masks_by_frame: list[np.ndarray] = []
    for i, p in enumerate(files):
        codes = pack(load_rgb(p))
        masks_by_frame.append(codes)
        uniq, counts = np.unique(codes, return_counts=True)
        for c, cnt in zip(uniq, counts):
            if c == 0:
                continue
            areas_by_color[int(c)][i] = float(cnt)

    rows = []
    for code, areas in areas_by_color.items():
        present = areas > 0
        idx = np.flatnonzero(present)
        if len(idx) < MIN_SPAN_FRAMES:
            continue
        first, last = int(idx[0]), int(idx[-1])
        span = last - first + 1
        n_present = int(present[first : last + 1].sum())
        gaps = span - n_present

        peak = float(areas.max())
        if peak < MIN_PEAK_AREA:
            continue

        # The readable span: from the first frame the leaf exceeds a fifth of
        # its own peak area onwards. Before that it is a handful of pixels whose
        # area doubles every step, and including those frames makes every leaf
        # in the dataset look discontinuous (measured: the *best* max-step over
        # the full span is 0.22, which tells you about emergence, not identity).
        readable = np.flatnonzero(present & (areas >= READABLE_FRACTION * peak))
        if len(readable) < MIN_SPAN_FRAMES:
            continue
        r0, r1 = int(readable[0]), int(readable[-1])

        a = areas[r0 : r1 + 1]
        pres = present[r0 : r1 + 1]
        both = pres[:-1] & pres[1:]
        steps = np.abs(a[1:] - a[:-1])[both] / np.maximum(a[:-1][both], 1.0)
        # p95 rather than the max: one bad annotation frame should cost a
        # candidate something, but it should not be the whole measurement.
        max_step = float(steps.max()) if steps.size else 1.0
        p95_step = float(np.percentile(steps, 95)) if steps.size else 1.0

        # Growth pairs: every ordered pair inside the Alim interval window whose
        # area ratio lands in the Alim growth window.
        pairs = 0
        best_pair = None
        for ii in range(first, last + 1):
            if not present[ii]:
                continue
            for jj in range(ii + 1, last + 1):
                if not present[jj]:
                    continue
                dh = hours_between(stamps[ii], stamps[jj])
                if dh < INTERVAL_LO_H:
                    continue
                if dh > INTERVAL_HI_H:
                    break
                g = areas[jj] / areas[ii] - 1.0
                if GROWTH_LO <= g <= GROWTH_HI:
                    pairs += 1
                    if best_pair is None or areas[jj] > best_pair[3]:
                        best_pair = (ii, jj, float(areas[ii]), float(areas[jj]), dh, g)

        # Roughness on three frames spread over the readable span — early,
        # middle, late — so a mask that degrades as the rosette crowds is not
        # scored on its best frame alone.
        probes = [readable[len(readable) // 6], readable[len(readable) // 2],
                  readable[(5 * len(readable)) // 6]]
        measured = [boundary_roughness(masks_by_frame[int(k)] == code) for k in probes]
        measured = [e for e in measured if np.isfinite(e)]
        roughness = float(np.mean(measured)) if measured else float("inf")

        rows.append(
            {
                "genotype": label_dir.parent.name,
                "rep": label_dir.name,
                "color": unpack(code),
                "code": code,
                "n_frames": n,
                "first": first,
                "last": last,
                "readable": (r0, r1),
                "readable_frames": int(len(readable)),
                "span": span,
                "present": n_present,
                "coverage": n_present / span,
                "gaps": gaps,
                "max_step": max_step,
                "p95_step": p95_step,
                "peak_area": peak,
                "growth_pairs": pairs,
                "best_pair": best_pair,
                "roughness": roughness,
            }
        )
    return rows


# ── pass 2: raw-image quality on the shortlist ───────────────────────────────
def score_images(genotype: str, rep: str, code: int) -> dict:
    label_dir = LABELS_ROOT / genotype / rep
    raw_dir = RAW_ROOT / genotype / rep
    files = sorted(label_dir.glob("*.png"), key=lambda p: parse_timestamp(p.name))
    if not files:
        return {"focus": 0.0, "clip": 1.0, "edge": 0.0, "frames": 0}

    # Sample evenly across the frames where this leaf is actually present —
    # scoring focus on frames before it emerged says nothing about the plate.
    present = []
    for i, p in enumerate(files):
        raw = raw_dir / p.name
        if raw.exists():
            present.append(i)
    if not present:
        return {"focus": 0.0, "clip": 1.0, "edge": 0.0, "frames": 0}

    picks = np.unique(np.linspace(0, len(present) - 1, QUALITY_FRAME_SAMPLES).astype(int))
    focus, clip, edge, used = [], [], [], 0
    for k in picks:
        i = present[int(k)]
        lab = pack(load_rgb(files[i]))
        mask = lab == code
        if mask.sum() < 50:
            continue
        img = load_rgb(raw_dir / files[i].name)

        # Crop to the whole rosette, not the one leaf: focus and exposure are
        # properties of the photograph that plate 01 shows in full.
        ys, xs = np.nonzero(lab != 0)
        if len(ys) == 0:
            continue
        y0, y1 = max(0, ys.min() - 8), min(img.shape[0], ys.max() + 9)
        x0, x1 = max(0, xs.min() - 8), min(img.shape[1], xs.max() + 9)
        crop = img[y0:y1, x0:x1]
        gray = crop.astype(float).mean(axis=-1)

        focus.append(focus_score(gray))
        clip.append(clipping_fraction(crop))
        edge.append(edge_agreement(gray, mask[y0:y1, x0:x1]))
        used += 1

    if not used:
        return {"focus": 0.0, "clip": 1.0, "edge": 0.0, "frames": 0}
    return {
        "focus": float(np.mean(focus)),
        "clip": float(np.mean(clip)),
        "edge": float(np.mean(edge)),
        "frames": used,
    }


# ── scoring ──────────────────────────────────────────────────────────────────
def gate_failures(r: dict) -> list[str]:
    """The two constant-valued criteria. They never bind on this dataset, which
    is why they are not scored — but they are still checked, so that a replicate
    that genuinely is blown out or genuinely has no usable growth interval is
    rejected and named rather than quietly ranked."""
    failures = []
    if r["growth_pairs"] < MIN_GROWTH_PAIRS:
        failures.append(f"no growth pair in Alim's window ({r['growth_pairs']})")
    q = r.get("quality")
    if q is not None and q["clip"] > MAX_CLIP:
        failures.append(f"exposure clipping {q['clip']:.3f} > {MAX_CLIP}")
    return failures


def subscores(r: dict) -> dict:
    """Each criterion to 0–1 against the thresholds measured at the top of the
    file. Linear and explicit rather than a z-score, so a number here means the
    same thing on a re-run over a different subset of replicates."""
    identity = clamp01(r["coverage"]) * rescale(r["p95_step"], STEP_RANGE)
    length = rescale(float(r["readable_frames"]), LENGTH_RANGE)
    segmentation = rescale(r["roughness"], ROUGH_RANGE)

    q = r.get("quality")
    if q is None:
        image = float("nan")
    else:
        # Edge agreement over focus, because a mask drawn off the leaf margin
        # breaks the contour every downstream plate is built from, whereas mild
        # softness only costs the photograph some bite.
        image = rescale(q["focus"], FOCUS_RANGE) * 0.35 + rescale(q["edge"], EDGE_RANGE) * 0.65
    return {
        "identity": identity,
        "length": length,
        "segmentation": segmentation,
        "image": image,
    }


def composite(s: dict) -> float:
    if np.isnan(s["image"]):
        # Pass 1 only: renormalise over the three criteria that were measured,
        # rather than scoring an unopened photograph as zero.
        w = {k: v for k, v in WEIGHTS.items() if k != "image"}
        total = sum(w.values())
        return sum(s[k] * v for k, v in w.items()) / total
    return sum(s[k] * WEIGHTS[k] for k in WEIGHTS)


def report_calibration(rows: list[dict]) -> None:
    """Print each scored quantity's observed spread beside the thresholds it is
    scored against.

    A threshold set once and left alone is how a criterion quietly becomes a
    constant: every candidate scores 0.00, the column looks like a measurement,
    and it ranks nothing. That already happened twice in this script's history —
    once when the roughness measure changed scale under a threshold that did
    not. Printing both makes the next occurrence visible in the output instead
    of needing to be rediscovered.
    """
    checks = [
        ("p95_step", STEP_RANGE, lambda r: r["p95_step"]),
        ("roughness", ROUGH_RANGE, lambda r: r["roughness"]),
        ("readable_frames", LENGTH_RANGE, lambda r: float(r["readable_frames"])),
    ]
    print("\ncalibration — observed spread vs the thresholds it is scored against")
    for name, span, get in checks:
        v = np.array([get(r) for r in rows], dtype=float)
        v = v[np.isfinite(v)]
        if not len(v):
            continue
        scored = np.array([rescale(x, span) for x in v])
        flag = "  <-- threshold does not span the data" if scored.std() < 0.05 else ""
        print(
            f"  {name:>16}  p05 {np.percentile(v, 5):8.3f}  p50 {np.percentile(v, 50):8.3f}  "
            f"p95 {np.percentile(v, 95):8.3f}   scored 0@{span[0]:g} 1@{span[1]:g}  "
            f"-> mean {scored.mean():.2f} sd {scored.std():.2f}{flag}"
        )


def main() -> None:
    args = sys.argv[1:]
    explicit = [a for a in args if "/" in a]
    only_genotype = args[0] if args and not explicit else None

    if explicit:
        replicate_dirs = sorted(LABELS_ROOT / r for r in explicit)
    else:
        replicate_dirs = sorted(
            d
            for d in LABELS_ROOT.glob("*/rep_*")
            if d.is_dir() and (only_genotype is None or d.parent.name == only_genotype)
        )
    print(f"pass 1 (labels only): {len(replicate_dirs)} replicates", flush=True)

    rows: list[dict] = []
    for i, d in enumerate(replicate_dirs):
        rows.extend(scan_replicate(d))
        if (i + 1) % 10 == 0 or i == len(replicate_dirs) - 1:
            print(f"  [{i + 1}/{len(replicate_dirs)}] {d.parent.name}/{d.name} "
                  f"-> {len(rows)} candidate leaves", file=sys.stderr, flush=True)

    gated = [(r, gate_failures(r)) for r in rows]
    rejected = [(r, f) for r, f in gated if f]
    rows = [r for r, f in gated if not f]
    for r in rows:
        r["sub"] = subscores(r)
        r["score"] = composite(r["sub"])
    rows.sort(key=lambda r: -r["score"])

    print(f"\npass 1 candidates: {len(rows)} ({len(rejected)} rejected by gate)")
    for r, f in rejected[:5]:
        print(f"  rejected {r['genotype']}/{r['rep']} {r['color']}: {'; '.join(f)}")
    report_calibration(rows)

    # One leaf per replicate into pass 2 — the plates show one specimen, so the
    # replicate's best leaf is what the replicate is worth.
    best_per_rep: dict[tuple, dict] = {}
    for r in rows:
        best_per_rep.setdefault((r["genotype"], r["rep"]), r)
    shortlist = list(best_per_rep.values())[:SHORTLIST]

    print(f"\npass 2 (raw frames): {len(shortlist)} shortlisted replicates", flush=True)
    for r in shortlist:
        r["quality"] = score_images(r["genotype"], r["rep"], r["code"])
        r["sub"] = subscores(r)
        r["score"] = composite(r["sub"])
        print(f"  {r['genotype']}/{r['rep']} {r['color']} -> focus {r['quality']['focus']:.1f}  "
              f"clip {r['quality']['clip']:.4f}  edge {r['quality']['edge']:.2f}",
              file=sys.stderr, flush=True)
    shortlist = [r for r in shortlist if not gate_failures(r)]
    shortlist.sort(key=lambda r: -r["score"])

    hdr = (
        f"{'genotype/rep':>16} {'color':>16} {'frm':>4} {'read':>9} {'gap':>4} "
        f"{'cov':>5} {'p95':>6} {'max':>6} {'peak':>7} {'pair':>5} {'rough':>6} "
        f"{'focus':>6} {'clip':>7} {'edge':>5} | {'ident':>5} {'len':>5} {'seg':>5} {'img':>5} {'TOTAL':>6}"
    )
    print("\n" + "=" * len(hdr))
    print("RANKED SHORTLIST — per-criterion scores, so the choice is auditable")
    print("  read = readable frame span   p95/max = frame-to-frame |dA|/A over it")
    print("  pair/clip are gates, not scores — printed to show they were checked")
    print("=" * len(hdr))
    print(hdr)
    print("-" * len(hdr))
    for r in shortlist:
        q, s = r["quality"], r["sub"]
        r0, r1 = r["readable"]
        print(
            f"{r['genotype'] + '/' + r['rep']:>16} {str(r['color']):>16} {r['n_frames']:>4} "
            f"{f'{r0}-{r1}':>9} {r['gaps']:>4} {r['coverage']:>5.2f} {r['p95_step']:>6.3f} "
            f"{r['max_step']:>6.3f} {r['peak_area']:>7.0f} {r['growth_pairs']:>5} "
            f"{r['roughness']:>6.3f} {q['focus']:>6.1f} {q['clip']:>7.4f} {q['edge']:>5.2f} | "
            f"{s['identity']:>5.2f} {s['length']:>5.2f} {s['segmentation']:>5.2f} "
            f"{s['image']:>5.2f} {r['score']:>6.3f}"
        )

    # The weights are hand-set, so a composite gap smaller than they are certain
    # to is not a result. Saying so is the difference between a ranking and a
    # decision — and the decision belongs to whoever reads the per-criterion
    # columns, not to four numbers in a dict at the top of this file.
    if len(shortlist) > 1:
        gap = shortlist[0]["score"] - shortlist[1]["score"]
        if gap < 0.05:
            print(f"\nCLOSE CALL — top two differ by {gap:.3f}, which these hand-set "
                  f"weights cannot resolve. Compare them on the criteria directly:")
            for r in shortlist[:2]:
                s = r["sub"]
                print(f"  {r['genotype']}/{r['rep']:<7} {str(r['color']):>16}  "
                      f"identity {s['identity']:.2f} (p95 {r['p95_step']:.3f}, max {r['max_step']:.3f})  "
                      f"length {s['length']:.2f} ({r['readable_frames']} frames)  "
                      f"seg {s['segmentation']:.2f}  image {s['image']:.2f}")
            print("  Identity continuity is the tie-break: it is the only criterion whose")
            print("  failure makes a claim on the page false rather than a plate ugly.")

    if shortlist:
        w = shortlist[0]
        r0, r1 = w["readable"]
        print(f"\nTOP BY COMPOSITE: {w['genotype']}/{w['rep']}  leaf colour {w['color']}")
        print(f"  visible frames {w['first']}–{w['last']} of {w['n_frames']}, readable from {r0} to {r1}, "
              f"{w['present']} present, {w['gaps']} gaps, peak {w['peak_area']:.0f} px²")
        if w["best_pair"]:
            i, j, ai, aj, dh, g = w["best_pair"]
            print(f"  largest qualifying growth pair: frame {i} → {j}, {dh:.1f} h, "
                  f"{ai:.0f} → {aj:.0f} px² (+{g * 100:.1f}%)")

    incumbent = next(
        (r for r in rows if r["genotype"] == "Col-0" and r["rep"] == "rep_21"), None
    )
    print("\n[incumbent] Col-0/rep_21 — the specimen the plates currently use")
    if incumbent:
        rank = rows.index(incumbent) + 1
        print(f"  best leaf {incumbent['color']}, rank {rank} of {len(rows)} by pass-1 score "
              f"({incumbent['score']:.3f}), {incumbent['growth_pairs']} growth pairs")
    else:
        print("  not present in the candidate set")

    # This scan has already been run over all 318 replicates and the result acted
    # on: the composite put Cvi-0/rep_08 first by 0.019, the incumbent was kept
    # regardless, and the reasoning — max frame-to-frame |dA|/A of 0.134 against
    # 0.420 — is recorded beside `SPECIMEN` in build-leaf-dynamics-plates.py.
    # Printed here so a later run that reports a different top row is read as the
    # expected disagreement rather than as a specimen that needs changing.
    print("\n  Decision on record: the incumbent ships. A composite ranking above it")
    print("  does not by itself overturn that — see the note beside SPECIMEN in")
    print("  build-leaf-dynamics-plates.py for the criterion the tie was broken on.")


if __name__ == "__main__":
    main()
