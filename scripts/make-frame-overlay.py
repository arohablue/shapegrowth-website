#!/usr/bin/env python3
"""
make-frame-overlay.py
================================================================================
WHAT
----
Diagnostic-only visual: for a given replicate + tracked leaf color, renders a
consecutive-frame (t, t+1) overlay so an occlusion claim can be checked by eye
instead of trusting a single scalar metric.

Overlay encoding, drawn on top of the raw frame-t photo for context:
  RED only      mask present at t, gone by t+1   (shrink / occluded-away)
  GREEN only    mask present at t+1, not at t     (growth)
  YELLOW        mask present at both t and t+1    (stable / overlap)

This exists because `scan-leaf-candidates.py`'s mid_dip metric trims
EDGE_TRIM=2 frames off each end before taking its max, and end_dip only checks
the very last frame — so a dip specifically in the second-to-last frame has no
column in that table. Rendering the actual last few transitions removes that
blind spot.

WHERE
-----
  reads:  ../leaf mophology code/PhenoLeaf-TS_DS/{01_raw_dataset,02_leaf_labels}/<genotype>/<rep>
  writes: /tmp/frame-overlays/<genotype>_<rep>_<color>/frame_XXX_to_YYY.png

USAGE
-----
  ~/.cache/phenotyping-leaf-venv/bin/python scripts/make-frame-overlay.py \
      Ba4-1/rep_01 48,57,249 --last 3
  ~/.cache/phenotyping-leaf-venv/bin/python scripts/make-frame-overlay.py \
      Col-0/rep_21 48,57,249 --last 3
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

import numpy as np
from PIL import Image

DATASET_ROOT = (
    Path(__file__).resolve().parent.parent.parent / "leaf mophology code" / "PhenoLeaf-TS_DS"
)
RAW_ROOT = DATASET_ROOT / "01_raw_dataset"
LABELS_ROOT = DATASET_ROOT / "02_leaf_labels"
OUT_ROOT = Path("/tmp/frame-overlays")

TIMESTAMP_RE = re.compile(r"(\d{4})_(\d{2})_(\d{2})_(\d{2})")


def parse_timestamp(name: str) -> tuple:
    m = TIMESTAMP_RE.search(name)
    return tuple(int(g) for g in m.groups()) if m else (0, 0, 0, 0)


def load_rgb(path: Path) -> np.ndarray:
    return np.array(Image.open(path).convert("RGB"))


def leaf_mask(label_arr: np.ndarray, color: tuple) -> np.ndarray:
    return np.all(label_arr == np.array(color), axis=-1)


def make_overlay(raw_t: np.ndarray, mask_t: np.ndarray, mask_t1: np.ndarray) -> np.ndarray:
    base = (raw_t.astype(float) * 0.45).astype(np.uint8)  # dim the photo so overlay pops
    out = base.copy()

    only_t = mask_t & ~mask_t1
    only_t1 = mask_t1 & ~mask_t
    both = mask_t & mask_t1

    out[only_t] = [255, 60, 60]       # red: present at t, gone by t+1
    out[only_t1] = [60, 220, 90]      # green: new at t+1
    out[both] = [240, 220, 40]        # yellow: stable overlap

    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("rep", help="genotype/rep, e.g. Col-0/rep_21")
    ap.add_argument("color", help="R,G,B of the tracked leaf label color, e.g. 48,57,249")
    ap.add_argument("--last", type=int, default=3, help="number of trailing transitions to render")
    args = ap.parse_args()

    color = tuple(int(x) for x in args.color.split(","))
    raw_dir = RAW_ROOT / args.rep
    label_dir = LABELS_ROOT / args.rep

    raw_files = sorted(raw_dir.glob("*.png"), key=lambda p: parse_timestamp(p.name))
    label_files = sorted(label_dir.glob("*.png"), key=lambda p: parse_timestamp(p.name))
    n = min(len(raw_files), len(label_files))
    raw_files, label_files = raw_files[:n], label_files[:n]

    out_dir = OUT_ROOT / f"{args.rep.replace('/', '_')}_{'-'.join(map(str, color))}"
    out_dir.mkdir(parents=True, exist_ok=True)

    start = max(0, n - 1 - args.last)
    print(f"{args.rep} color={color}: {n} frames total, rendering transitions {start}->{start+1} .. {n-2}->{n-1}")

    for t in range(start, n - 1):
        raw_t = load_rgb(raw_files[t])
        mask_t = leaf_mask(load_rgb(label_files[t]), color)
        mask_t1 = leaf_mask(load_rgb(label_files[t + 1]), color)

        area_t, area_t1 = int(mask_t.sum()), int(mask_t1.sum())
        pct = (area_t1 - area_t) / area_t * 100 if area_t else float("nan")

        overlay = make_overlay(raw_t, mask_t, mask_t1)
        out_path = out_dir / f"frame_{t:03d}_to_{t+1:03d}.png"
        Image.fromarray(overlay).save(out_path)
        print(f"  {t:3d}->{t+1:3d}  area {area_t:6d} -> {area_t1:6d}  ({pct:+6.1f}%)  saved {out_path}")


if __name__ == "__main__":
    main()
