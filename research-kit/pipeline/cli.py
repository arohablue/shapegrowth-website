#!/usr/bin/env python3
"""
Command line for the growth pipeline.

    python -m pipeline demo
    python -m pipeline register --data-dir PHENO4D --plant M01 --day-a 0324 --day-b 0325
    python -m pipeline register --files a.txt b.txt --days 1
    python -m pipeline validate M05 M04 M06 T02 --npz DIR
    python -m pipeline export M05 --archive DIR          (reproduce: 1e-9 gate)
    python -m pipeline export --npz RUN.npz --id MYPLANT (new: gate skipped, says so)

Every subcommand writes into `runs/<tag>/` and prints the same statistics block,
so two runs can be diffed directly.
"""
import argparse
import json
import os
import sys

import numpy as np

from . import PARAMETERS, UNITS
from .demo import write_demo_files
from .growth import (
    chamfer,
    days_between,
    find_scans,
    label_check,
    load_scan,
    preprocess,
    register_growth,
)
from .ply import save_displacement_ply
from .registration import cpd_rigid

# The seeds are not arbitrary and must not be "tidied" to a single value. The
# source scan is subsampled with seed 0 and the target with seed 1, so the two
# scans are thinned independently. Using one seed for both would correlate the
# two point sets through the sampler and flatter the fit.
SEED_SRC, SEED_TGT = 0, 1


def _stats(res, days, cb):
    """The statistics block, computed in float64. Same keys as summary.csv."""
    disp, detJ = res["displacement"], res["detJ"]
    mag = np.linalg.norm(disp, axis=1)
    return {
        "n_src": int(len(res["src"])),
        "n_tgt": int(len(res["tgt"])),
        "days": days,
        "chamfer_before": float(cb),
        "chamfer_after": float(chamfer(res["warped"], res["tgt"])),
        "disp_mean": float(mag.mean()),
        "disp_median": float(np.median(mag)),
        "disp_max": float(mag.max()),
        "detJ_median": float(np.median(detJ)),
        "detJ_p5": float(np.percentile(detJ, 5)),
        "detJ_p95": float(np.percentile(detJ, 95)),
        "detJ_frac_negative": float((detJ < 0).mean()),
        "detJ_frac_non_positive": float((detJ <= 0).mean()),
    }


def _report(st, units=UNITS):
    print(f"\n  points            {st['n_src']} -> {st['n_tgt']}")
    print(f"  chamfer           {st['chamfer_before']:.4f} -> {st['chamfer_after']:.4f} {units}"
          f"   ({100 * (1 - st['chamfer_after'] / st['chamfer_before']):.1f}% closer)")
    print(f"  |displacement|    mean {st['disp_mean']:.4f}  median {st['disp_median']:.4f}  "
          f"max {st['disp_max']:.4f} {units}")
    if st["days"] and st["days"] != 1:
        print(f"                    over {st['days']} days -> mean rate "
              f"{st['disp_mean'] / st['days']:.4f} {units}/day")
    print(f"  det J             median {st['detJ_median']:.3f}  "
          f"5-95% [{st['detJ_p5']:.3f}, {st['detJ_p95']:.3f}]")
    frac = st["detJ_frac_non_positive"]
    if frac > 0:
        print(f"  FOLDS             {100 * frac:.2f}% of points have det J <= 0. The map is "
              f"not invertible there and")
        print(f"                    those points carry no readable expansion or compression.")
    else:
        print(f"  folds             none (det J > 0 everywhere)")


def _warn_floor(before):
    """Trap 4. The sigma^2 floor in cpd_rigid is a ONE-SPECIMEN determination.

    It was pinned on M06, the only archived plant that ever reaches it. Any run
    that touches it is relying on a constant that has been tested against
    exactly one case, so it gets said out loud rather than left in a counter
    nobody reads.
    """
    hits = cpd_rigid.floor_hits - before
    if hits:
        print(f"\n  !! sigma^2 floor applied {hits}x during rigid pre-alignment.")
        print(f"     That floor (1e-8) was fitted on a single specimen (M06) and is")
        print(f"     untested elsewhere. Treat this fit as unvalidated and say so if")
        print(f"     you publish it.")
    return hits


def _run_pair(path_a, path_b, days, out_dir, tag, args):
    os.makedirs(out_dir, exist_ok=True)
    print(f"\n=== {tag}: {os.path.basename(path_a)} -> {os.path.basename(path_b)} "
          f"(dt = {days} d) ===")

    (Pa, La), (Pb, Lb) = load_scan(path_a), load_scan(path_b)
    print(f"  raw points        {len(Pa)} -> {len(Pb)}")
    if La is None or Lb is None:
        print(f"  note: a scan carries no labels, so nothing is removed by soil label.")

    src, ls = preprocess(Pa, La, args.n_points, args.soil_label, args.z_crop,
                         args.up_axis, seed=SEED_SRC)
    tgt, lt = preprocess(Pb, Lb, args.n_points, args.soil_label, args.z_crop,
                         args.up_axis, seed=SEED_TGT)

    cb = chamfer(src, tgt)
    floor_before = cpd_rigid.floor_hits

    print(f"  fitting CPD       beta {args.beta}  lam {args.lam}  w {args.w}  "
          f"rigid {'on' if args.rigid else 'OFF'}", flush=True)
    res = register_growth(src, tgt, beta=args.beta, lam=args.lam, w=args.w,
                          rigid=args.rigid, verbose=args.verbose)

    st = _stats(res, days, cb)
    st["floor_hits"] = _warn_floor(floor_before)
    st["parameters"] = {**PARAMETERS, "rigid_prealignment": bool(args.rigid),
                        "beta": args.beta, "lam": args.lam, "w": args.w,
                        "n_points": args.n_points}
    st["units"] = UNITS
    st["calibration"] = None
    _report(st)

    if ls is not None and lt is not None:
        label_check(res, ls, lt)

    npz_path = os.path.join(out_dir, "growth_field.npz")
    np.savez(npz_path,
             src=res["src"], tgt=res["tgt"], warped=res["warped"],
             displacement=res["displacement"], detJ=res["detJ"],
             rate_per_day=res["displacement"] / max(days, 1), days=days)

    with open(os.path.join(out_dir, "stats.json"), "w") as fh:
        json.dump(st, fh, indent=2)

    save_displacement_ply(os.path.join(out_dir, "growth_field.ply"),
                          res["src"], res["displacement"])

    if not args.no_plot:
        try:
            from .plots import plot_growth
            plot_growth(res, days, tag, os.path.join(out_dir, "growth_field.png"),
                        args.up_axis)
        except ImportError:
            print("  (matplotlib not installed - skipping the figure)")

    print(f"\n  wrote -> {out_dir}")
    for f in sorted(os.listdir(out_dir)):
        print(f"           {f}")
    return res, st


def _fit_args(ap):
    ap.add_argument("--n-points", type=int, default=PARAMETERS["n_points"])
    ap.add_argument("--beta", type=float, default=PARAMETERS["beta"],
                    help="kernel width in normalised units; larger = stiffer field")
    ap.add_argument("--lam", type=float, default=PARAMETERS["lam"],
                    help="regularisation; larger = stiffer field")
    ap.add_argument("--w", type=float, default=PARAMETERS["w"],
                    help="outlier weight; new tissue at t+1 has no counterpart at t")
    # Trap 3. Rigid pre-alignment is ON by default because every published
    # result used it. --no-rigid exists so the M06 fold can be reproduced.
    ap.add_argument("--no-rigid", dest="rigid", action="store_false",
                    help="disable rigid pre-alignment (published results all USED it)")
    ap.set_defaults(rigid=True)
    ap.add_argument("--soil-label", type=int, default=PARAMETERS["soil_label"])
    ap.add_argument("--z-crop", type=float, default=None,
                    help="drop points below this height; for unlabelled scans")
    ap.add_argument("--up-axis", type=int, default=2)
    ap.add_argument("--out", default="runs")
    ap.add_argument("--no-plot", action="store_true")
    ap.add_argument("--verbose", action="store_true")


def cmd_demo(args):
    """Synthetic plant. Runs with no Pheno4D data and no licence."""
    data_dir = os.path.join(args.out, "demo", "scans")
    _, paths = write_demo_files(data_dir)
    print(f"synthetic scans -> {data_dir}")
    print("  NOTE: this is a generated plant, not a measurement. It exists to")
    print("  prove the pipeline runs end to end and to be something to point the")
    print("  viewer at. Do not read its numbers as a result about real plants.")
    _run_pair(paths[0], paths[1], days_between("0313", "0314"),
              os.path.join(args.out, "demo", "M01_0313_to_0314"), "demo_M01", args)
    return 0


def cmd_register(args):
    if args.files:
        _run_pair(args.files[0], args.files[1], args.days,
                  os.path.join(args.out, "custom_pair"), "custom_pair", args)
        return 0

    if not (args.data_dir and args.plant):
        print("need --data-dir and --plant, or --files A B", file=sys.stderr)
        return 2

    scans = find_scans(args.data_dir, args.plant)
    if len(scans) < 2:
        print(f"found {len(scans)} scans for {args.plant} under {args.data_dir}; "
              f"need at least 2", file=sys.stderr)
        return 2
    print(f"{args.plant}: {len(scans)} scans {[d for d, _ in scans]}")

    lut = dict(scans)
    if args.consecutive:
        pairs = [(scans[i][0], scans[i + 1][0]) for i in range(len(scans) - 1)]
    elif args.day_a and args.day_b:
        pairs = [(args.day_a, args.day_b)]
    else:
        print("give --day-a and --day-b, or --consecutive", file=sys.stderr)
        return 2

    for da, db in pairs:
        missing = [d for d in (da, db) if d not in lut]
        if missing:
            print(f"no scan for day(s) {missing}", file=sys.stderr)
            return 2
        tag = f"{args.plant}_{da}_to_{db}"
        _run_pair(lut[da], lut[db], days_between(da, db),
                  os.path.join(args.out, tag), tag, args)
    return 0


def cmd_validate(args):
    """Feed archived inputs back through this code and compare to archived outputs.

    This is the only thing standing between `registration.py` being a
    reimplementation and being trusted. It is not a unit test with invented
    expectations: the `.npz` carry the ORIGINAL run's outputs alongside its
    inputs, so disagreement means this code is wrong.
    """
    worst_overall, failures = 0.0, []
    for plant in args.plants:
        path = os.path.join(args.npz, f"{plant}_rigid.npz")
        if not os.path.exists(path):
            print(f"{plant}: no archive at {path}", file=sys.stderr)
            failures.append(plant)
            continue
        d = np.load(path)
        floor_before = cpd_rigid.floor_hits
        res = register_growth(d["src"], d["tgt"], beta=args.beta, lam=args.lam,
                              w=args.w, rigid=args.rigid, verbose=False)
        worst = 0.0
        for key in ("warped", "displacement", "detJ"):
            got, want = res[key], d[key]
            denom = np.maximum(np.abs(want), 1e-12)
            worst = max(worst, float(np.abs(got - want).max() / denom.max()))
        hits = cpd_rigid.floor_hits - floor_before
        ok = worst <= args.tol
        print(f"  {'ok  ' if ok else 'FAIL'} {plant}  worst relative {worst:.2e}"
              f"{f'   (sigma^2 floor hit {hits}x)' if hits else ''}")
        worst_overall = max(worst_overall, worst)
        if not ok:
            failures.append(plant)

    print(f"\nworst relative error {worst_overall:.2e}  (gate {args.tol:.0e})")
    if failures:
        print(f"FAIL: {', '.join(failures)}")
        return 1
    print("PASS - this reimplementation reproduces the archived arrays")
    return 0


def cmd_export(args):
    """Write viewer assets. Two modes with two different claims -- see export.py."""
    from .export import OUT_DIR_DEFAULT, export_new, export_published
    out_dir = args.out_dir or OUT_DIR_DEFAULT

    if args.npz_file:
        if not args.spec_id:
            print("new mode needs --id", file=sys.stderr)
            return 2
        manifest = export_new(args.npz_file, args.spec_id, label=args.label,
                              note=args.note, out_dir=out_dir)
    elif args.plants:
        manifest = export_published(args.plants, args.archive, out_dir=out_dir)
    else:
        print("give published plant ids (reproduce mode) or --npz + --id (new mode)",
              file=sys.stderr)
        return 2
    print(f"\n  manifest -> {manifest}")
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(
        prog="python -m pipeline",
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("demo", help="synthetic plant; needs no dataset")
    _fit_args(p)
    p.set_defaults(func=cmd_demo)

    p = sub.add_parser("register", help="register a real pair of scans")
    p.add_argument("--data-dir", help="a Pheno4D directory, searched recursively")
    p.add_argument("--plant", help="e.g. M01 or T03")
    p.add_argument("--day-a", help="MMDD of scan t")
    p.add_argument("--day-b", help="MMDD of scan t+1")
    p.add_argument("--consecutive", action="store_true",
                   help="every consecutive available day pair")
    p.add_argument("--files", nargs=2, metavar=("SCAN_T", "SCAN_T1"))
    p.add_argument("--days", type=float, default=1.0,
                   help="interval, only used with --files")
    _fit_args(p)
    p.set_defaults(func=cmd_register)

    p = sub.add_parser("validate", help="check this code against archived results")
    p.add_argument("plants", nargs="*", default=["M05", "M04", "M06", "T02"])
    p.add_argument("--npz", default=os.path.join("..", "data", "pheno4d-growth", "npz"),
                   help="directory of <PLANT>_rigid.npz archives")
    p.add_argument("--tol", type=float, default=1e-9)
    _fit_args(p)
    p.set_defaults(func=cmd_validate)

    p = sub.add_parser("export", help="write viewer assets (.bin + manifest.json)")
    p.add_argument("plants", nargs="*",
                   help="published plant ids for reproduce mode, e.g. M05 M04 M06 M01 T02")
    p.add_argument("--archive", default=os.path.join("..", "data", "pheno4d-growth", "npz"),
                   help="directory of <PLANT>_rigid.npz archives (reproduce mode)")
    p.add_argument("--npz", dest="npz_file",
                   help="a growth_field.npz from `register` or `demo` (new mode)")
    p.add_argument("--id", dest="spec_id", help="specimen id for new mode")
    p.add_argument("--label", help="display label; defaults to the id")
    p.add_argument("--note", help="a caveat to attach; default none (NOT invented)")
    p.add_argument("--out-dir", default=None,
                   help="defaults to research-kit/public/specimens")
    p.set_defaults(func=cmd_export)

    args = ap.parse_args(argv)
    return args.func(args)
