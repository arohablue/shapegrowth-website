#!/usr/bin/env python3
"""
Viewer assets: one packed float32 binary per specimen plus one manifest.

    public/specimens/
        manifest.json    specimens, units, parameters, caveats, diagnostics
        M05.bin          src ‖ tgt ‖ displacement ‖ detJ, little-endian float32
        ...

TWO MODES, TWO CLAIMS
---------------------
This exporter was ported from the one that builds the public website's assets,
where every specimen HAD to have a row in the published 14-plant table and the
build died if its arrays disagreed with that row. That gate is what makes the
published five trustworthy, and it is kept here bit for bit. But this package
also exists so a recipient can register their own plants, and a new plant has
no published row by construction. So:

  * reproduce  -- the plant has a row in docs/summary.csv. Every statistic is
    recomputed from the arrays and must match the published row to 1e-9
    relative, or the export raises and writes nothing. Entries carry
    `validated: true` and their provenance from the original study
    ("archive" or "recomputed").

  * new        -- no published row. The gate is SKIPPED, and that is recorded
    rather than hidden: `validated: false`, `provenance: "new"`, `note: null`.
    A new plant must not inherit the published five's trustworthiness, and it
    does not get an invented caveat either -- `null` means nobody has looked,
    which is itself information.

The two modes write into the same manifest. Entries are replaced by id, so
re-exporting a specimen updates it in place.

INVARIANTS THAT HOLD IN BOTH MODES (asserted, not assumed)
----------------------------------------------------------
  * units are "scan units" and calibration is null -- no physical unit is ever
    claimed, because the dataset never states one.
  * warped - src == displacement, bit-exact in float64. This is what licenses
    not shipping `warped`: the viewer derives it as src + displacement. (The
    float64 check is on warped - src, which is how `displacement` was DEFINED,
    so it is exact; src + displacement == warped would be off by an ulp.)
  * rate_per_day is never exported. When days == 1 it is an element-wise copy
    of displacement; when days != 1 the manifest states `days` and the reader
    does the division that is not being hidden.
  * no field anywhere claims point-to-point correspondence. The caveats block
    says the opposite, explicitly.

BINARY LAYOUT
-------------
Fixed order, no header: src (n,3), tgt (n,3), displacement (n,3), detJ (n,),
all little-endian float32. The manifest carries `n_points` and the layout; a
self-describing header would be a second copy of that which could disagree
with it. The float32 cast costs at worst ~4e-8 of the coordinate range
(measured on the published five) and every number in the manifest is computed
in float64 BEFORE the cast, so no reported digit inherits it.
"""
import csv
import json
import os

import numpy as np

from . import PARAMETERS, UNITS
from .growth import chamfer

KIT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(KIT, "docs")
OUT_DIR_DEFAULT = os.path.join(KIT, "public", "specimens")

UNIT_EVIDENCE = (
    "Not stated by the Pheno4D documentation, which describes the files only as "
    "x, y, z and a label. Probably millimetres \u2014 the scanner is a Perceptron "
    "ScanWorks V5 on a ROMER Infinite 2.0 arm (\u03c3 \u2248 0.012 mm), which reports in mm, "
    "and the plants then stand 26\u201347 cm. Recorded as an inference and not applied."
)

# The published study's pair. 0324 -> 0325 is the only labelled consecutive-day
# pair in Pheno4D, which is why all 14 plants share it. Applies to `reproduce`
# entries only; a new specimen's interval comes from its own npz.
DAY_A, DAY_B = "0324", "0325"

SPECIES = {"M": "Maize", "T": "Tomato"}

# Metadata for the published five, transcribed from the website exporter. The
# caveat prose quotes the published statistics, so it belongs to these
# specimens and must not leak onto new ones.
PUBLISHED_SPECIMENS = {
    "M05": ("featured", None, "archive"),
    "M04": (
        "clean",
        "Displacement is large \u2014 mean 23.8, max 172.6 scan units in one day. Much of "
        "this is leaf motion rather than tissue growth.",
        "archive",
    ),
    "M06": (
        "clean",
        "Clean only with rigid pre-alignment. Without it the same fit folds over "
        "90.0% of points (median det J \u22121.163), which is why every specimen here "
        "uses the rigid step.",
        "archive",
    ),
    "M01": (
        "clean",
        "Displacement is large \u2014 mean 28.6, max 172.1 scan units in one day. Much of "
        "this is leaf motion rather than tissue growth.",
        "recomputed",
    ),
    "T02": (
        "problematic",
        "The weakest fit in the study. Chamfer distance stays at 6.49 after "
        "registration against a median of 2.1 across the 14 plants, and 2.67% of "
        "det J values are non-positive. Read this specimen as a failure case.",
        "archive",
    ),
}

PROVENANCE_NOTES = {
    "archive": (
        "Arrays as produced by the original run and packed alongside the "
        "slide deck (docs/plant_growth_slides.pdf). Not reproducible here "
        "without the raw scans."
    ),
    "recomputed": (
        "Re-registered from the raw Pheno4D scans at the same parameters, "
        "using this package's reimplementation of the CPD dependency. The "
        "reimplementation reproduces all four archive specimens from their "
        "own recorded inputs to 3.3e-12 relative."
    ),
    "new": (
        "Registered by this package from scans supplied by its user. No "
        "published statistics exist for these specimens, so NOTHING has "
        "checked the fit -- `validated: false` means exactly that, and the "
        "numbers shown are the fit describing itself."
    ),
}


# ----------------------------------------------------------------------------
# Shared pieces (ported unchanged from the website exporter)
# ----------------------------------------------------------------------------
def _read_rows(name):
    path = os.path.join(DOCS, name)
    with open(path) as fh:
        return {r["plant"]: r for r in csv.DictReader(fh)}


def _assert_invariants(spec_id, npz):
    """The invariants that hold in BOTH modes. Raises, never warns."""
    warped, src, disp = npz["warped"], npz["src"], npz["displacement"]
    # Exact because displacement was DEFINED as warped - src; recomputing the
    # same subtraction is deterministic. This licenses deriving `warped` in
    # the viewer instead of shipping a third array that could go out of sync.
    if not np.array_equal(warped - src, disp):
        raise SystemExit(
            f"{spec_id}: warped - src != displacement; cannot derive warped in the viewer"
        )
    days = float(npz["days"])
    if days == 1 and "rate_per_day" in npz and not np.array_equal(npz["rate_per_day"], disp):
        raise SystemExit(f"{spec_id}: rate_per_day != displacement despite days = 1")
    return int(days) if days == int(days) else days


def validate_published(spec_id, npz, row):
    """The 1e-9 gate, kept exactly as the website build has it.

    Every statistic is recomputed from the arrays in float64 and compared to
    the published row. These are the same float64 arrays run through the same
    formulas, so they agree to ~1e-15; the margin is for the last bits of a
    percentile interpolation, not for drift. Do not downgrade to warnings:
    a mismatch means the arrays are not the ones behind the slide deck.
    """
    src, tgt, warped = npz["src"], npz["tgt"], npz["warped"]
    detJ = npz["detJ"]
    mag = np.linalg.norm(npz["displacement"], axis=1)

    if int(npz["days"]) != 1:
        raise SystemExit(f"{spec_id}: days = {int(npz['days'])}, but every published pair is 1 day")

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
        want = float(row[key])
        if abs(got - want) > 1e-9 * max(1.0, abs(want)):
            raise SystemExit(
                f"{spec_id}: {key} computed {got!r} but docs/summary.csv publishes {want!r}"
            )
    return computed


def diagnostics(npz):
    """What the viewer reports, computed in float64 before the float32 cast.

    `non_positive` det J is its own band, not merged into "< 1": a non-positive
    determinant means the map folds there, so the local transformation is not
    invertible and nothing about expansion or compression can be read off it.
    Merging it into compression would present failure as a measurement.
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
        # Over BOTH scans: the viewer frames one camera on a pair, and framing
        # on the source alone would let the target sit outside the shot.
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

    Deterministic byte for byte: the same npz always produces the same file,
    which is what lets the published five be checked against the website's
    shipped binaries with `cmp`.
    """
    parts = [
        np.ascontiguousarray(npz["src"], dtype="<f4"),
        np.ascontiguousarray(npz["tgt"], dtype="<f4"),
        np.ascontiguousarray(npz["displacement"], dtype="<f4"),
        np.ascontiguousarray(npz["detJ"], dtype="<f4"),
    ]
    with open(path, "wb") as fh:
        for part in parts:
            fh.write(part.tobytes())
    return os.path.getsize(path), len(npz["src"])


# ----------------------------------------------------------------------------
# Manifest
# ----------------------------------------------------------------------------
def _skeleton():
    return {
        "schema": 1,
        "dataset": "Pheno4D",
        "reference": (
            "Schunck, Magistri, Marcuzzi, Nardi, Nunes, Behley, Stachniss, "
            "PLoS ONE 16(8) e0256340 (2021)"
        ),
        "method": "Non-rigid Coherent Point Drift with rigid pre-alignment",
        "units": UNITS,
        "unit_evidence": UNIT_EVIDENCE,
        "calibration": None,
        "parameters": PARAMETERS,
        "interval_note": (
            f"All PUBLISHED specimens use the same pair, {DAY_A[:2]}-{DAY_A[2:]} to "
            f"{DAY_B[:2]}-{DAY_B[2:]}, one day apart \u2014 the only labelled "
            "consecutive-day pair in Pheno4D. New specimens carry their own "
            "`interval.days`."
        ),
        "caveats": [
            "Displacement is the estimated motion between two scans. It includes leaf "
            "bending, drooping, rotation and registration error, not only growth.",
            "det J describes local volumetric deformation of an estimated map. A plant's "
            "leaves are thin surfaces, so it is a cautious proxy and should be read "
            "qualitatively \u2014 where tissue expands, not by how much.",
            "Non-positive det J means the estimated map folds there. Those points carry no "
            "readable expansion or compression and are shown as invalid rather than clipped.",
            "Point correspondence is estimated by the registration, not observed. The scans "
            "are independent samplings of the plant and share no ground-truth point identity.",
        ],
        "specimens": [],
    }


def _entry(spec_id, label, quality, note, provenance, validated, interval,
           fit, diag, bin_name, size):
    return {
        "id": spec_id,
        "species": SPECIES.get(spec_id[:1].upper(), None),
        "label": label,
        "quality": quality,
        "note": note,
        "provenance": provenance,
        "validated": validated,
        "interval": interval,
        "asset": {
            # Relative to manifest.json, NOT to the server root, so the viewer
            # works from any base path.
            "url": bin_name,
            "bytes": size,
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
        "fit": fit,
        "diagnostics": diag,
    }


def _write_manifest(out_dir, entries_by_id):
    """Rebuild the manifest around the current entry set.

    Entries merge by id; everything else is regenerated so the coverage and
    provenance blocks cannot drift out of step with the specimen list.
    """
    published = _read_rows("summary.csv")
    default_run = _read_rows("summary_default.csv")

    manifest = _skeleton()
    entries = [entries_by_id[k] for k in sorted(entries_by_id)]
    manifest["specimens"] = entries

    n_new = sum(1 for e in entries if e["provenance"] == "new")
    manifest["coverage"] = {
        "plants_in_study": len(published),
        "plants_with_point_data": len(entries) - n_new,
        "new_specimens": n_new,
        "note": (
            f"{len(published)} plants were processed in the published study; "
            f"{len(entries) - n_new} of them have point-level arrays here. The rest exist "
            "only as summary statistics (docs/summary.csv) and are omitted rather than "
            "shown without data."
            + (f" {n_new} further specimen(s) were registered by this package's user "
               "and are not part of the study." if n_new else "")
        ),
    }

    manifest["provenance"] = {
        kind: {
            "specimens": [e["id"] for e in entries if e["provenance"] == kind],
            "note": PROVENANCE_NOTES[kind],
        }
        for kind in ("archive", "recomputed", "new")
        if any(e["provenance"] == kind for e in entries)
    }

    # M06's caveat quotes the no-rigid run, so the numbers behind it travel
    # with the manifest instead of living only in a Python string.
    if "M06" in entries_by_id:
        m06, pub = default_run["M06"], published["M06"]
        manifest["rigid_prealignment_evidence"] = {
            "plant": "M06",
            "without_rigid": {
                "detJ_median": float(m06["detJ_median"]),
                "detJ_frac_negative": float(m06["detJ_frac_negative"]),
                "chamfer_after": float(m06["chamfer_after"]),
            },
            "with_rigid": {
                "detJ_median": float(pub["detJ_median"]),
                "detJ_frac_negative": float(pub["detJ_frac_negative"]),
                "chamfer_after": float(pub["chamfer_after"]),
            },
            "note": (
                "Rigid pre-alignment changes the outcome for M06 alone among the 14 "
                "plants. It is applied to every specimen for consistency."
            ),
        }

    path = os.path.join(out_dir, "manifest.json")
    with open(path, "w") as fh:
        json.dump(manifest, fh, indent=1, ensure_ascii=False)
        fh.write("\n")
    return path


def _existing_entries(out_dir):
    path = os.path.join(out_dir, "manifest.json")
    if not os.path.exists(path):
        return {}
    with open(path) as fh:
        return {e["id"]: e for e in json.load(fh).get("specimens", [])}


# ----------------------------------------------------------------------------
# The two modes
# ----------------------------------------------------------------------------
def export_published(plants, archive_dir, out_dir=OUT_DIR_DEFAULT):
    """reproduce mode: arrays must match docs/summary.csv to 1e-9 or nothing ships."""
    published = _read_rows("summary.csv")
    os.makedirs(out_dir, exist_ok=True)
    entries = _existing_entries(out_dir)

    for plant in plants:
        if plant not in PUBLISHED_SPECIMENS or plant not in published:
            raise SystemExit(
                f"{plant}: not a published specimen. For your own plants use "
                f"`export --npz <growth_field.npz> --id {plant}` (new mode)."
            )
        path = os.path.join(archive_dir, f"{plant}_rigid.npz")
        if not os.path.exists(path):
            raise SystemExit(f"{plant}: no archive at {path}")
        d = np.load(path)
        npz = {k: d[k] for k in d.files}

        _assert_invariants(plant, npz)
        row = published[plant]
        confirmed = validate_published(plant, npz, row)
        diag = diagnostics(npz)

        bin_name = f"{plant}.bin"
        size, n = write_bin(os.path.join(out_dir, bin_name), npz)

        quality, note, provenance = PUBLISHED_SPECIMENS[plant]
        entries[plant] = _entry(
            plant, f"{SPECIES[plant[0]]} {plant}", quality, note, provenance,
            validated=True,
            interval={"from": f"{DAY_A[:2]}-{DAY_A[2:]}",
                      "to": f"{DAY_B[:2]}-{DAY_B[2:]}",
                      "days": confirmed["days"]},
            fit={
                "chamfer_before": float(row["chamfer_before"]),
                "chamfer_after": float(row["chamfer_after"]),
                "chamfer_reduction": 1 - float(row["chamfer_after"]) / float(row["chamfer_before"]),
            },
            diag=diag, bin_name=bin_name, size=size,
        )
        print(f"  {plant}  validated against docs/summary.csv  {size / 1024:6.1f} KB  {n} pts  "
              f"chamfer {float(row['chamfer_before']):.2f} -> {float(row['chamfer_after']):.2f}")

    return _write_manifest(out_dir, entries)


def export_new(npz_path, spec_id, label=None, note=None, out_dir=OUT_DIR_DEFAULT):
    """new mode: no gate, and the manifest says so.

    `validated: false` and `provenance: "new"` travel with the specimen. The
    fit numbers recorded here are the fit describing itself -- nothing
    independent has checked them, which is exactly what the flag means.
    """
    published = _read_rows("summary.csv")
    if spec_id in published:
        raise SystemExit(
            f"{spec_id}: a published row exists for this plant. Export it in reproduce "
            f"mode (`export {spec_id} --archive DIR`) so it is validated, or pick a "
            f"different id -- a new fit must not ship under a published plant's name."
        )

    d = np.load(npz_path)
    npz = {k: d[k] for k in d.files}
    for key in ("src", "tgt", "warped", "displacement", "detJ", "days"):
        if key not in npz:
            raise SystemExit(f"{npz_path}: missing array '{key}'; "
                             f"is this a growth_field.npz from `python -m pipeline register`?")

    days = _assert_invariants(spec_id, npz)
    diag = diagnostics(npz)

    os.makedirs(out_dir, exist_ok=True)
    entries = _existing_entries(out_dir)
    bin_name = f"{spec_id}.bin"
    size, n = write_bin(os.path.join(out_dir, bin_name), npz)

    cb = chamfer(npz["src"], npz["tgt"])
    ca = chamfer(npz["warped"], npz["tgt"])
    entries[spec_id] = _entry(
        spec_id, label or spec_id, "unvalidated", note, "new",
        validated=False,
        interval={"from": None, "to": None, "days": days},
        fit={"chamfer_before": float(cb), "chamfer_after": float(ca),
             "chamfer_reduction": 1 - float(ca) / float(cb)},
        diag=diag, bin_name=bin_name, size=size,
    )
    print(f"  {spec_id}  NOT validated (no published row)  {size / 1024:6.1f} KB  {n} pts  "
          f"chamfer {cb:.4f} -> {ca:.4f}")

    return _write_manifest(out_dir, entries)
