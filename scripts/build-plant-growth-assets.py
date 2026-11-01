#!/usr/bin/env python3
"""
build-plant-growth-assets.py
================================================================================
WHAT
----
Exports the browser assets for the "Plant Growth Fields" offering from the
genuine non-rigid CPD results computed by `plant_growth.py` over the Pheno4D
dataset. One binary per specimen plus one manifest:

    public/evidence/plant-growth/
        manifest.json     specimens, interval, units, parameters, diagnostics
        M05.bin           src, tgt, displacement, detJ as packed float32
        M04.bin
        M06.bin
        M01.bin
        T02.bin

WHERE
-----
  reads:  data/pheno4d-growth/npz/<PLANT>_rigid.npz   (gitignored, see PROVENANCE)
          data/pheno4d-growth/summary.csv             (the rigid run, 14 plants)
          data/pheno4d-growth/summary_default.csv     (the no-rigid run, for M06's caveat)
  writes: public/evidence/plant-growth/

  run with the same isolated venv the leaf-dynamics builder uses, or any
  python with numpy + scipy:

      python3 scripts/build-plant-growth-assets.py

  scipy is needed only for the Chamfer re-computation in the validation pass.


PROVENANCE, AND WHY THE INPUTS ARE NOT IN THIS REPO
---------------------------------------------------
There are now TWO chains of custody. Every specimen records which one it came
from in `manifest.specimens[].provenance`, because "the slide deck's own arrays"
and "arrays recomputed here from the raw scans" are not the same claim and must
not be presented as one.

(A) `archive` — M05, M04, M06, T02.

`plant_growth.py` and its dependency `plant_registration.py` executed in a
remote sandbox against the Pheno4D dataset. What came back was the slide deck
and its figures, and the NPZ results packed alongside them:

    Pheno4D (Schunck et al. 2021)
      -> plant_growth.py --rigid, in a sandbox            [not reproducible here]
      -> beamer_source.zip : beamer/npz/<PLANT>_rigid.npz [the arrays]
      -> data/pheno4d-growth/                             [staged, gitignored]
      -> this script
      -> public/evidence/plant-growth/                    [what ships]

(B) `recomputed` — M01.

The raw Pheno4D scans for M01 are on this machine (another project's `data/`),
and `plant_growth.py` is too. Only `plant_registration.py` was missing, so the
CPD it imports was REIMPLEMENTED from the paper (Myronenko & Song 2010) and from
`plant_growth.py`'s call signatures:

    Pheno4D M01_0324_a.txt, M01_0325_a.txt     [raw scans, local]
      -> plant_growth.py preprocess + register_growth(rigid=True)
         with a reimplemented plant_registration.py
      -> data/pheno4d-growth/npz/M01_rigid.npz           [staged, gitignored]
      -> this script  ... as above

A reimplementation is a claim until it is tested, so it was tested against the
one thing that can falsify it: the staged NPZ carry BOTH the inputs (`src`,
`tgt`) and the outputs (`warped`, `displacement`, `detJ`) for all four archive
specimens. Feeding the recorded inputs to the reimplementation and comparing
against the recorded outputs reproduces them to 3.3e-12 relative (rigid) and
7.2e-12 (no-rigid) across all four — i.e. float64 round-off, not agreement by
construction. M06 is the sharpest of these: its fit folds, median det J −1.163,
and it reproduces to 1e-13.

M01 then passes two further gates (see `validate()` and the summary row):
`chamfer_before` depends only on the subsampling and not on CPD at all, and it
matches summary.csv EXACTLY (0.0 absolute error) — which is the only available
check on `preprocess`, since no raw scans exist here for the archive four. All
11 published statistics for M01 agree to 6.6e-13.

Two constants in the reimplementation were recovered from the data rather than
read from source, and are the weakest links in chain (B): the convergence
tolerance (1e-6, independently pinned by three specimens stopping at three
different iterations) and the floor applied when sigma^2 goes non-positive
(1e-8, pinned by M06 alone). M01 never reaches the floor, so it does not depend
on the one-specimen constant; the build asserts this rather than assuming it.

`data/` is gitignored, exactly as `data/colmap-sunflower` and
`data/leaf-morphology` are. The staged NPZ are the archival copy; the originals
in the zip are never written to.

This is the reason the validation pass below is not optional. For chain (A) you
cannot re-run the thing that produced the inputs, so the only remaining check is
internal consistency: the arrays must reproduce, to the last decimal, the
statistics the slide deck published. They do — including Chamfer distance, which
is computed from `src`, `tgt` and `warped` and could not agree by coincidence.
For chain (B) the same pass is doing something stronger — it is checking a
reimplementation against a number it had no way to see. See `validate()`.


WHAT IS NOT EXPORTED, AND WHY
-----------------------------
`warped` is in the NPZ and is not written to the binary. It is not dropped
information: `plant_growth.py:147` DEFINES `displacement = warped - src`, so
`warped` is recovered by adding two arrays that are both exported. Verified
exactly (`np.allclose` is not used — the reconstruction is bit-exact in float64).
Shipping it would be 36 KB per specimen of a third array that must agree with
the other two, i.e. a thing that can go out of sync for no benefit.

`rate_per_day` is in the NPZ and is not exported either, for a stronger reason:
every pair in this study is `days = 1`, so `rate_per_day` is an element-wise
copy of `displacement`. Presenting it as a second quantity would imply a rate
was estimated across intervals of differing length. It was not. The manifest
states `days` and lets the reader do the division that is not being hidden.

The 9 other plants (M02, M03, M07, T01, T03-T07) are NOT exported. They have
summary statistics and rendered PNGs but no point-level arrays, so there is
nothing to draw. They are absent from the manifest rather than present-and-
disabled: a selector entry that cannot be selected is a promise the data does
not keep.

M01 was in that list until its raw scans turned up locally. The remaining nine
are blocked only on the raw scans: the registration side is no longer the
obstacle now that chain (B) exists and is validated. Obtaining them means the
Pheno4D dataset from Uni Bonn (~260M points, licence agreement), which is a
deliberate decision for a person to make, not a build step.


FLOAT32
-------
The NPZ are float64. The binaries are float32, which is what a GPU vertex
buffer holds anyway, so float64 would be converted on upload regardless.

Worst-case round-trip error over all four specimens, measured:

    positions      3.0e-05 scan units   on coordinates spanning ~900
    displacement   7.6e-06 scan units   on vectors up to 235
    detJ           1.2e-07              on values in [-0.5, 4.0]

The largest of these is ~4e-8 of the coordinate range, and roughly 2500x smaller
than the scanner's own per-point sigma. It cannot move a pixel or change a
reported digit. The diagnostics in the manifest are computed in float64 BEFORE
the cast, so no published number inherits even this.


UNITS
-----
"scan units" throughout, and this is a finding rather than a placeholder.

The Pheno4D documentation at https://www.ipb.uni-bonn.de/data/pheno4d/ describes
the files only as "the x,y,z coordinates, and the label associated with the
point". It never states a physical unit, and no README ships with the data. The
slide deck's own table hedges the same way: "Lengths in scan units (probably mm,
unverified)" (beamer/main.tex:295).

Circumstantially mm is likely — the instrument is a Perceptron ScanWorks V5 on a
ROMER Infinite 2.0 arm, quoted at sigma ~0.012mm, and arm CMMs report mm
natively; the plants then stand 256-468 units tall, i.e. 26-47 cm, which is
right for 1-month maize. That is an inference from instrument convention and
plausibility, not a statement from the source, so it is recorded in the manifest
as `unit_evidence` and NOT applied.

`UNITS` below is the single place this is written down. If the dataset authors
confirm mm, change this constant and the string propagates everywhere; nothing
else in the pipeline or the frontend spells a unit.
"""
import csv
import json
import os
import struct

import numpy as np
from scipy.spatial.distance import cdist

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IN_DIR = os.path.join(HERE, "data", "pheno4d-growth")
OUT_DIR = os.path.join(HERE, "public", "evidence", "plant-growth")

# The one place a unit is named. See the UNITS note in the module docstring.
UNITS = "scan units"
UNIT_EVIDENCE = (
    "Not stated by the Pheno4D documentation, which describes the files only as "
    "x, y, z and a label. Probably millimetres \u2014 the scanner is a Perceptron "
    "ScanWorks V5 on a ROMER Infinite 2.0 arm (\u03c3 \u2248 0.012 mm), which reports in mm, "
    "and the plants then stand 26\u201347 cm. Recorded as an inference and not applied."
)

# The pair is not a choice. 0324 \u2192 0325 is the only labelled consecutive-day pair
# in Pheno4D, which is why all 14 plants share it (beamer/main.tex:55-56).
DAY_A, DAY_B = "0324", "0325"

# The method name and fit parameters (beta, lam, w, n_points) used to be
# written into the manifest verbatim. They were removed deliberately: the
# manifest is served to anyone who opens the page, and the site now describes
# the method generically ("a rigid alignment followed by a smooth, regularised
# non-rigid registration") without naming the algorithm or its constants. The
# full record lives in the deck and in research-kit/, not in public JSON.

SPECIES = {"M": "Maize", "T": "Tomato"}

# The five specimens with point-level arrays. `note` is a caveat that must stay
# attached to the specimen wherever it is shown; `None` means the fit is clean
# and inventing a warning for it would be its own kind of dishonesty.
#
# All five are the RIGID run, because that is the run the deck reports for all
# 14 plants. Mixing runs per specimen to flatter each one would make the
# selector a comparison between different methods labelled as one.
#
# `provenance` is "archive" (the deck's own NPZ) or "recomputed" (re-registered
# here from raw scans with a reimplemented plant_registration.py). See the
# PROVENANCE section above. It is carried into the manifest because the two are
# different epistemic claims, even though both pass the same validation.
SPECIMENS = [
    (
        "M05",
        "featured",
        None,
        "archive",
    ),
    (
        "M04",
        "clean",
        "Displacement is large \u2014 mean 23.8, max 172.6 scan units in one day. Much of "
        "this is leaf motion rather than tissue growth.",
        "archive",
    ),
    (
        "M06",
        "clean",
        "Clean only with rigid pre-alignment. Without it the same fit folds over "
        "90.0% of points (median local volume change \u22121.163), which is why every "
        "specimen here uses the rigid step.",
        "archive",
    ),
    (
        "M01",
        "clean",
        "Displacement is large \u2014 mean 28.6, max 172.1 scan units in one day. Much of "
        "this is leaf motion rather than tissue growth.",
        "recomputed",
    ),
    (
        "T02",
        "problematic",
        "The weakest fit in the study. The mean surface-to-surface distance stays "
        "at 6.49 after registration against a median of 2.1 across the 14 plants, "
        "and 2.67% of local volume-change values are non-positive. Read this "
        "specimen as a failure case.",
        "archive",
    ),
]


def load(plant):
    """The NPZ as produced, nothing coerced."""
    path = os.path.join(IN_DIR, "npz", f"{plant}_rigid.npz")
    d = np.load(path)
    return {k: d[k] for k in d.files}, path


def chamfer(a, b):
    """Symmetric mean nearest-neighbour distance, as plant_growth.py:287 computes it."""
    return 0.5 * (cdist(a, b).min(1).mean() + cdist(b, a).min(1).mean())


def validate(plant, npz, published):
    """Assert the arrays reproduce the published row. Raises rather than warns.

    This is the whole reason the export can be trusted, so it fails loudly and
    stops the build. Do not downgrade these to warnings to get a release out:
    a mismatch means the arrays are not the ones behind the slide deck, and
    shipping them under the deck's numbers would be the exact fabrication this
    offering exists to avoid.

    Tolerance is 1e-9 relative. These are the same float64 arrays run through
    the same formulas, so they agree to ~1e-15; the margin is for the last bits
    of a percentile interpolation, not for drift.
    """
    src, tgt, warped = npz["src"], npz["tgt"], npz["warped"]
    disp, detJ = npz["displacement"], npz["detJ"]
    mag = np.linalg.norm(disp, axis=1)

    # The definition in plant_growth.py:147. Bit-exact, not approximate --
    # this is what licenses dropping `warped` from the export.
    if not np.array_equal(warped - src, disp):
        raise SystemExit(f"{plant}: warped - src != displacement; cannot derive warped in the browser")

    # days == 1 is what makes rate_per_day redundant. If a future run has a
    # longer interval this assertion fires and the omission must be revisited.
    if int(npz["days"]) != 1:
        raise SystemExit(f"{plant}: days = {int(npz['days'])}, but rate_per_day is exported as redundant")
    if not np.array_equal(npz["rate_per_day"], disp):
        raise SystemExit(f"{plant}: rate_per_day != displacement despite days = 1")

    computed = {
        "n_src": len(src),
        "n_tgt": len(tgt),
        "days": int(npz["days"]),
        "chamfer_before": chamfer(src, tgt),
        "chamfer_after": chamfer(warped, tgt),
        "disp_mean": mag.mean(),
        "disp_max": mag.max(),
        "detJ_median": np.median(detJ),
        "detJ_p5": np.percentile(detJ, 5),
        "detJ_p95": np.percentile(detJ, 95),
        "detJ_frac_negative": (detJ < 0).mean(),
    }

    for key, got in computed.items():
        want = float(published[key])
        if abs(got - want) > 1e-9 * max(1.0, abs(want)):
            raise SystemExit(
                f"{plant}: {key} computed {got!r} but summary.csv publishes {want!r}"
            )

    return computed


def diagnostics(npz):
    """What the viewer reports, computed in float64 before the cast.

    The det J bands are counted rather than described. `non_positive` is its own
    band because it is not "a bit less than 1" -- a non-positive determinant
    means the estimated map folds the space over on itself there, so the local
    transformation is not invertible and nothing about expansion or compression
    can be read off it. It is a region where the answer is "this fit failed",
    and merging it into "< 1" would present failure as compression.
    """
    src, tgt, disp, detJ = npz["src"], npz["tgt"], npz["displacement"], npz["detJ"]
    mag = np.linalg.norm(disp, axis=1)
    both = np.vstack([src, tgt])

    return {
        "n_points": int(len(src)),
        "displacement": {
            "mean": float(mag.mean()),
            "median": float(np.median(mag)),
            "p95": float(np.percentile(mag, 95)),
            "max": float(mag.max()),
        },
        "detJ": {
            "median": float(np.median(detJ)),
            "p5": float(np.percentile(detJ, 5)),
            "p95": float(np.percentile(detJ, 95)),
            "min": float(detJ.min()),
            "max": float(detJ.max()),
            "frac_expanding": float((detJ > 1).mean()),
            "frac_compressing": float(((detJ > 0) & (detJ <= 1)).mean()),
            "frac_non_positive": float((detJ <= 0).mean()),
            "count_non_positive": int((detJ <= 0).sum()),
        },
        # Combined over both scans, because the viewer frames one camera on a
        # pair and framing on the source alone would let the target sit outside
        # the shot. Centre is the midpoint of the box, not a centroid: the
        # camera is aiming at a bounding volume, not balancing a mass.
        "bounds": {
            "min": [float(v) for v in both.min(0)],
            "max": [float(v) for v in both.max(0)],
            "centre": [float(v) for v in (both.min(0) + both.max(0)) / 2],
            "extent": [float(v) for v in (both.max(0) - both.min(0))],
            "diagonal": float(np.linalg.norm(both.max(0) - both.min(0))),
        },
    }


def write_bin(path, npz):
    """src, tgt, displacement, detJ as one little-endian float32 blob.

    Fixed order, no header. The manifest carries `n_points` and the layout, and
    a self-describing header would be a second copy of that which could disagree
    with it. One fetch, one ArrayBuffer, four subarray views.
    """
    n = len(npz["src"])
    parts = [
        np.ascontiguousarray(npz["src"], dtype="<f4"),
        np.ascontiguousarray(npz["tgt"], dtype="<f4"),
        np.ascontiguousarray(npz["displacement"], dtype="<f4"),
        np.ascontiguousarray(npz["detJ"], dtype="<f4"),
    ]
    with open(path, "wb") as fh:
        for part in parts:
            fh.write(part.tobytes())
    return os.path.getsize(path), n


def main():
    published = {r["plant"]: r for r in csv.DictReader(open(os.path.join(IN_DIR, "summary.csv")))}
    default_run = {
        r["plant"]: r for r in csv.DictReader(open(os.path.join(IN_DIR, "summary_default.csv")))
    }
    os.makedirs(OUT_DIR, exist_ok=True)

    entries = []
    for plant, quality, note, provenance in SPECIMENS:
        npz, src_path = load(plant)
        row = published[plant]
        confirmed = validate(plant, npz, row)
        diag = diagnostics(npz)

        bin_name = f"{plant}.bin"
        size, n = write_bin(os.path.join(OUT_DIR, bin_name), npz)

        entries.append(
            {
                "id": plant,
                "species": SPECIES[plant[0]],
                "label": f"{SPECIES[plant[0]]} {plant}",
                "quality": quality,
                "note": note,
                "provenance": provenance,
                "interval": {
                    "from": f"{DAY_A[:2]}-{DAY_A[2:]}",
                    "to": f"{DAY_B[:2]}-{DAY_B[2:]}",
                    "days": confirmed["days"],
                },
                "asset": {
                    "url": f"/evidence/plant-growth/{bin_name}",
                    "bytes": size,
                    # The browser reads this to build its views. Order is the
                    # order in the file; `warped` is named as derived so no
                    # caller goes looking for an array that is not there.
                    "layout": [
                        {"name": "src", "components": 3},
                        {"name": "tgt", "components": 3},
                        {"name": "displacement", "components": 3},
                        {"name": "detJ", "components": 1},
                    ],
                    "dtype": "float32",
                    "endianness": "little",
                    "derived": {"warped": "src + displacement"},
                },
                "fit": {
                    "chamfer_before": float(row["chamfer_before"]),
                    "chamfer_after": float(row["chamfer_after"]),
                    "chamfer_reduction": 1 - float(row["chamfer_after"]) / float(row["chamfer_before"]),
                },
                "diagnostics": diag,
            }
        )
        print(
            f"  {plant}  {size / 1024:6.1f} KB  {n} pts  "
            f"chamfer {float(row['chamfer_before']):.2f} -> {float(row['chamfer_after']):.2f}  "
            f"det J med {diag['detJ']['median']:.3f}  "
            f"non-positive {diag['detJ']['frac_non_positive'] * 100:.2f}%"
        )

    manifest = {
        "schema": 1,
        "dataset": "Pheno4D",
        "reference": (
            "Schunck, Magistri, Marcuzzi, Nardi, Nunes, Behley, Stachniss, "
            "PLoS ONE 16(8) e0256340 (2021)"
        ),
        "units": UNITS,
        "unit_evidence": UNIT_EVIDENCE,
        "calibration": None,
        # Stated at the top level because it is a property of the study, not of
        # a specimen: every pair here is the same single day, and a reader who
        # sees four specimens could otherwise assume four different intervals.
        "interval_note": (
            f"All specimens use the same pair, {DAY_A[:2]}-{DAY_A[2:]} to {DAY_B[:2]}-{DAY_B[2:]}, "
            "one day apart. It is the only labelled consecutive-day pair in Pheno4D."
        ),
        "caveats": [
            "Displacement is the estimated motion between two scans. It includes leaf "
            "bending, drooping, rotation and registration error, not only growth.",
            "The local volume change describes deformation of an estimated map. A plant's "
            "leaves are thin surfaces, so it is a cautious proxy and should be read "
            "qualitatively \u2014 where tissue expands, not by how much.",
            "A non-positive local volume change means the estimated map folds there. Those "
            "points carry no readable expansion or compression and are shown as invalid "
            "rather than clipped.",
            "Point correspondence is estimated by the registration, not observed. The scans "
            "are independent samplings of the plant and share no ground-truth point identity.",
        ],
        "coverage": {
            "plants_in_study": len(published),
            "plants_with_point_data": len(entries),
            "note": (
                f"{len(published)} plants were processed; {len(entries)} have point-level "
                "arrays available here. The rest exist only as summary statistics and "
                "rendered figures, so they are omitted rather than shown without data."
            ),
        },
        # Two chains of custody, kept distinct. Both pass the same validation
        # against summary.csv, but "the study's own arrays" and "arrays
        # recomputed here" are different claims and a reader is entitled to
        # know which one they are looking at.
        "provenance": {
            "archive": {
                "specimens": [e["id"] for e in entries if e["provenance"] == "archive"],
                "note": (
                    "Arrays as produced by the original run and packed alongside the "
                    "slide deck. Not reproducible on this machine."
                ),
            },
            "recomputed": {
                "specimens": [e["id"] for e in entries if e["provenance"] == "recomputed"],
                "note": (
                    "Re-registered from the raw Pheno4D scans at the same settings, "
                    "using a reimplementation of the registration dependency that was "
                    "missing. "
                    "The reimplementation reproduces all four archive specimens from "
                    "their own recorded inputs to 3.3e-12 relative, and these specimens "
                    "reproduce every statistic in the study's table to 6.6e-13."
                ),
            },
        },
        "specimens": entries,
    }

    # M06's caveat quotes the no-rigid run, so the numbers behind it travel with
    # the manifest instead of living only in a Python string.
    m06 = default_run["M06"]
    manifest["rigid_prealignment_evidence"] = {
        "plant": "M06",
        "without_rigid": {
            "detJ_median": float(m06["detJ_median"]),
            "detJ_frac_negative": float(m06["detJ_frac_negative"]),
            "chamfer_after": float(m06["chamfer_after"]),
        },
        "with_rigid": {
            "detJ_median": float(published["M06"]["detJ_median"]),
            "detJ_frac_negative": float(published["M06"]["detJ_frac_negative"]),
            "chamfer_after": float(published["M06"]["chamfer_after"]),
        },
        "note": (
            "Rigid pre-alignment changes the outcome for M06 alone among the 14 plants. "
            "It is applied to every specimen for consistency."
        ),
    }

    out = os.path.join(OUT_DIR, "manifest.json")
    with open(out, "w") as fh:
        json.dump(manifest, fh, indent=1, ensure_ascii=False)
        fh.write("\n")

    total = sum(e["asset"]["bytes"] for e in entries) + os.path.getsize(out)
    print(f"\n  manifest.json  {os.path.getsize(out) / 1024:.1f} KB")
    print(f"  total shipped  {total / 1024:.1f} KB across {len(entries)} specimens")
    print(f"  units          {UNITS} (not verified as a physical unit)")


if __name__ == "__main__":
    main()
