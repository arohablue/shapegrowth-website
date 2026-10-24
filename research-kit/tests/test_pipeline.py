"""
Fast tests. None of them need the Pheno4D dataset or the archived npz; they use
the synthetic demo plant and small random clouds, so they run anywhere the
package installs.

    cd research-kit && python3 -m pytest tests/ -q

What these do NOT cover: numerical fidelity to the published results. That is
`python -m pipeline validate M05 M04 M06 T02`, which needs the archived npz and
is the stronger check -- these tests prove the plumbing, validate proves the
mathematics. test_export_reproduce_* skip themselves when the archives are
absent rather than pretending to have checked.
"""
import json
import os
import sys

import numpy as np
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline.demo import make_growing_plant, write_demo_files
from pipeline.growth import (
    SCAN_RE, chamfer, days_between, find_scans, load_scan, preprocess,
    register_growth, subsample_uniform,
)
from pipeline.ply import save_displacement_ply
from pipeline.registration import NonRigidCPD, cpd_rigid, gaussian_kernel

ARCHIVE = os.path.join(os.path.dirname(__file__), "..", "..", "data", "pheno4d-growth", "npz")


# ----------------------------------------------------------------------------
# Demo generator and loading
# ----------------------------------------------------------------------------
def test_demo_files_are_real_pheno4d_format(tmp_path):
    out_dir, paths = write_demo_files(str(tmp_path))
    assert len(paths) == 2
    for p in paths:
        name = os.path.basename(p)
        assert SCAN_RE.match(name), f"{name} does not match Pheno4D naming"
        pts, lab = load_scan(p)
        assert pts.shape[1] == 3
        assert lab is not None, "demo scans must be labelled"
        assert (lab == 0).any(), "demo scans must contain soil (label 0)"
        assert (lab > 0).any(), "demo scans must contain plant organs"


def test_find_scans_pairs_the_demo(tmp_path):
    write_demo_files(str(tmp_path))
    scans = find_scans(str(tmp_path), "M01")
    assert [d for d, _ in scans] == ["0313", "0314"]
    assert days_between("0313", "0314") == 1


def test_demo_plant_grows():
    small = make_growing_plant(2.0, seed=0)[0]
    big = make_growing_plant(3.0, seed=0)[0]
    assert np.ptp(big[:, 2]) > np.ptp(small[:, 2]), "later stage must be taller"


# ----------------------------------------------------------------------------
# Pre-processing
# ----------------------------------------------------------------------------
def test_preprocess_removes_soil_and_subsamples():
    rng = np.random.default_rng(0)
    pts = rng.normal(size=(5000, 3))
    lab = (rng.random(5000) < 0.4).astype(int)  # ~40% organ 1, rest soil 0
    out, lo = preprocess(pts, lab, 500)
    assert len(out) == 500
    assert (lo != 0).all(), "soil must be gone"


def test_subsample_is_reproducible_and_bounded():
    rng = np.random.default_rng(0)
    P = np.random.default_rng(1).normal(size=(4000, 3))
    i1 = subsample_uniform(P, 300, np.random.default_rng(5))
    i2 = subsample_uniform(P, 300, np.random.default_rng(5))
    assert np.array_equal(i1, i2), "same rng state must give the same thinning"
    assert len(i1) <= 300 and len(np.unique(i1)) == len(i1)
    small = rng.normal(size=(50, 3))
    assert len(subsample_uniform(small, 300, rng)) == 50, "fewer points than n: keep all"


# ----------------------------------------------------------------------------
# Scores and kernels
# ----------------------------------------------------------------------------
def test_chamfer_properties():
    a = np.array([[0.0, 0, 0], [1, 0, 0]])
    b = np.array([[0.0, 0, 0], [1, 0, 0], [1, 1, 0]])
    assert chamfer(a, a) == 0.0
    assert chamfer(a, b) == chamfer(b, a), "must be symmetric"
    # a->b: (0+0)/2 = 0;  b->a: (0+0+1)/3;  mean = 1/6
    assert np.isclose(chamfer(a, b), 1 / 6)


def test_gaussian_kernel_is_one_on_the_diagonal():
    Y = np.random.default_rng(0).normal(size=(40, 3))
    G = gaussian_kernel(Y, beta=1.2)
    assert np.allclose(np.diag(G), 1.0)
    assert np.allclose(G, G.T)
    assert (G > 0).all() and (G <= 1.0).all()


# ----------------------------------------------------------------------------
# Registration (small clouds, seconds not minutes)
# ----------------------------------------------------------------------------
def _small_pair(n=250, stretch=1.06, seed=0):
    rng = np.random.default_rng(seed)
    src = rng.normal(size=(n, 3))
    tgt = src * [1.0, 1.0, stretch] + rng.normal(scale=0.01, size=(n, 3))
    return src, tgt


def test_register_growth_contract():
    src, tgt = _small_pair()
    res = register_growth(src, tgt, verbose=False)
    # The definitional identity the exporter asserts: bit-exact, not allclose.
    assert np.array_equal(res["warped"] - res["src"], res["displacement"])
    assert res["detJ"].shape == (len(src),)
    # It actually registered: the surfaces got closer.
    assert chamfer(res["warped"], tgt) < chamfer(src, tgt)
    # A gentle uniaxial stretch must not fold anything.
    assert (res["detJ"] > 0).all()


def test_field_matches_displacement_at_source_points():
    src, tgt = _small_pair(n=150)
    res = register_growth(src, tgt, verbose=False)
    u = res["field"](src)
    assert np.allclose(u, res["displacement"], atol=1e-9)


def test_rigid_recovers_a_rotation():
    rng = np.random.default_rng(3)
    X = rng.normal(size=(200, 3))
    th = 0.4
    R = np.array([[np.cos(th), -np.sin(th), 0], [np.sin(th), np.cos(th), 0], [0, 0, 1.0]])
    out = cpd_rigid(X @ R.T, X, w=0.1)
    assert np.allclose(out["R"], R, atol=1e-3)
    assert np.isclose(np.linalg.det(out["R"]), 1.0), "must be a rotation, not a reflection"


def test_jacobian_of_identity_fit_is_near_identity():
    rng = np.random.default_rng(4)
    X = rng.normal(size=(200, 3))
    nr = NonRigidCPD(verbose=False).fit(X, X.copy())
    detJ = np.linalg.det(nr.jacobian())
    assert np.allclose(detJ, 1.0, atol=0.05), "same cloud twice: no volume change"


# ----------------------------------------------------------------------------
# PLY
# ----------------------------------------------------------------------------
def test_ply_counts_and_edges(tmp_path):
    pts = np.random.default_rng(0).normal(size=(10, 3))
    disp = np.full_like(pts, 0.1)
    path = str(tmp_path / "f.ply")
    save_displacement_ply(path, pts, disp)
    text = open(path).read().splitlines()
    assert "element vertex 20" in text and "element edge 10" in text
    body = text[text.index("end_header") + 1:]
    assert len(body) == 30  # 20 vertices + 10 edges
    # edge i joins vertex 2i (base) and 2i+1 (tip)
    assert body[20].split() == ["0", "1"]
    assert body[-1].split() == ["18", "19"]


# ----------------------------------------------------------------------------
# Export: the two modes carry two different claims
# ----------------------------------------------------------------------------
def _fake_npz(tmp_path, n=50, days=1, seed=0):
    rng = np.random.default_rng(seed)
    src = rng.normal(size=(n, 3))
    warped = src + rng.normal(scale=0.05, size=(n, 3))
    disp = warped - src  # the definition; exact by construction
    path = str(tmp_path / "growth_field.npz")
    np.savez(path, src=src, tgt=warped + rng.normal(scale=0.01, size=(n, 3)),
             warped=warped, displacement=disp, detJ=np.abs(rng.normal(1, 0.1, n)),
             rate_per_day=disp / max(days, 1), days=days)
    return path


def test_export_new_is_marked_unvalidated(tmp_path):
    from pipeline.export import export_new
    out = str(tmp_path / "specimens")
    export_new(_fake_npz(tmp_path), "TESTPLANT", out_dir=out)

    m = json.load(open(os.path.join(out, "manifest.json")))
    (e,) = m["specimens"]
    assert e["validated"] is False
    assert e["provenance"] == "new"
    assert e["note"] is None, "a new plant must not inherit or invent a caveat"
    assert m["units"] == "scan units" and m["calibration"] is None
    assert "new" in m["provenance"] and m["provenance"]["new"]["specimens"] == ["TESTPLANT"]
    # layout promise matches the bytes on disk: (3+3+3+1) floats * 4 bytes
    size = os.path.getsize(os.path.join(out, "TESTPLANT.bin"))
    assert size == e["asset"]["bytes"] == e["diagnostics"]["n_points"] * 40


def test_export_bin_roundtrip(tmp_path):
    from pipeline.export import export_new
    npz_path = _fake_npz(tmp_path, n=30)
    out = str(tmp_path / "specimens")
    export_new(npz_path, "RT", out_dir=out)

    d = np.load(npz_path)
    raw = np.fromfile(os.path.join(out, "RT.bin"), dtype="<f4")
    n = 30
    blocks = [raw[:3 * n], raw[3 * n:6 * n], raw[6 * n:9 * n], raw[9 * n:]]
    for block, key in zip(blocks[:3], ("src", "tgt", "displacement")):
        assert np.array_equal(block.reshape(n, 3), d[key].astype("<f4"))
    assert np.array_equal(blocks[3], d["detJ"].astype("<f4"))


def test_export_new_refuses_published_ids(tmp_path):
    from pipeline.export import export_new
    with pytest.raises(SystemExit, match="published row exists"):
        export_new(_fake_npz(tmp_path), "M05", out_dir=str(tmp_path / "s"))


def test_export_merges_by_id(tmp_path):
    from pipeline.export import export_new
    out = str(tmp_path / "specimens")
    export_new(_fake_npz(tmp_path, seed=1), "A", out_dir=out)
    export_new(_fake_npz(tmp_path, seed=2), "B", out_dir=out)
    export_new(_fake_npz(tmp_path, seed=3), "A", out_dir=out)  # replace, not duplicate
    m = json.load(open(os.path.join(out, "manifest.json")))
    assert [e["id"] for e in m["specimens"]] == ["A", "B"]


def test_export_reproduce_validates_against_published(tmp_path):
    """Needs the archived npz; skips (loudly) when they are not staged."""
    if not os.path.exists(os.path.join(ARCHIVE, "M05_rigid.npz")):
        pytest.skip("archived npz not staged; run `python -m pipeline validate` where they are")
    from pipeline.export import export_published
    out = str(tmp_path / "specimens")
    export_published(["M05"], ARCHIVE, out_dir=out)
    m = json.load(open(os.path.join(out, "manifest.json")))
    (e,) = m["specimens"]
    assert e["validated"] is True and e["provenance"] == "archive"
    assert e["note"] is None and e["quality"] == "featured"


def test_export_reproduce_rejects_tampered_arrays(tmp_path):
    """The 1e-9 gate must actually fire, not just exist."""
    if not os.path.exists(os.path.join(ARCHIVE, "M05_rigid.npz")):
        pytest.skip("archived npz not staged")
    from pipeline.export import export_published
    d = dict(np.load(os.path.join(ARCHIVE, "M05_rigid.npz")))
    d["displacement"] = d["displacement"] * 1.001
    d["warped"] = d["src"] + d["displacement"]
    d["displacement"] = d["warped"] - d["src"]  # keep the identity exact
    d["rate_per_day"] = d["displacement"]
    tampered = str(tmp_path / "archive")
    os.makedirs(tampered)
    np.savez(os.path.join(tampered, "M05_rigid.npz"), **d)
    with pytest.raises(SystemExit):
        export_published(["M05"], tampered, out_dir=str(tmp_path / "s"))
