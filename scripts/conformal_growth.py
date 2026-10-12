#!/usr/bin/env python3
"""
conformal_growth.py
================================================================================
WHAT
----
The geometry behind plates 04–06 of the Leaf Dynamics offering: a genuine
Riemann map from a leaf's blade onto the unit disk, the composition of two such
maps into a growth map leaf(t) → leaf(t+Δt), the displacement field that map
predicts, and the comparison of that prediction against a displacement field
measured independently by PIV.

It is a module rather than more lines of `build-leaf-dynamics-plates.py` for one
reason: every function here has an assertable property — |φ| = 1 on the boundary,
|φ| < 1 inside, boundary winding = 1 turn — and those properties need to be
checkable without rendering a figure. `python scripts/conformal_growth.py` runs
them as a self-test against the staged frames.

WHAT THIS REPLACES, AND WHY
---------------------------
The shipping plate called "conformal mapping" was `harmonic_map_to_disk`: pin
the boundary vertices to the circle at equal angular spacing and solve the
Laplace equation for the interior. That map is harmonic and it is a bijection
(Radó–Kneser–Choquet), and it is not conformal — the boundary correspondence of
the Riemann map is determined by the domain, not chosen by whoever wrote the
`linspace`. Pinning it to arc length imposes a boundary parameterisation the
leaf does not have, and the resulting map carries an angular distortion that is
largest exactly at the lobes.

It was also not a statement about growth. It flattened *one* leaf at *one* time.
Alim, Armon, Shraiman & Boudaoud (2016), "Leaf growth is conformal", Phys. Biol.
13(5) 05LT01, do something else: they map leaf(t) onto leaf(t+Δt) and ask
whether the displacement that map predicts agrees with the displacement a
texture-tracking measurement observes. The claim lives in that agreement. A
single-timepoint parameterisation cannot make it.

THE CONSTRUCTION
----------------
The Riemann map is built from the Green's function of the domain, which needs
two Laplace solves and no conformal-mapping toolbox:

    φ(z) = (z − z₀) · exp(−(u + iv))

    u   harmonic on Ω, with u|∂Ω = log|z − z₀|      (Dirichlet solve)
    v   the harmonic conjugate of u, from ∇v = J∇u  (Poisson solve, one pin)

On the boundary |φ| = |z − z₀| · e^(−u) = 1 by construction. Inside, u is below
its boundary values' harmonic extension of log|z − z₀|, so |φ| < 1. And φ is
holomorphic because u + iv is, which is the whole point: conformality is a
consequence of the construction rather than a property hoped for afterwards.

The one free constant is the rotation, fixed by pinning a single vertex of v. It
does not matter, because the next step rotates the disk deliberately anyway.

WHERE WE DEPART FROM ALIM ET AL., STATED PLAINLY
------------------------------------------------
They align the two disks with a Möbius transformation pinned at THREE landmarks:
the leaf tip and both sides of the petiole–blade junction. Their segmentation
resolves that junction. On PhenoLeaf-TS the petiole is largely absent from the
instance masks, so only TWO landmarks are robustly recoverable — the attachment
point nearest the rosette centre, and the tip farthest from it. The remaining
degree of freedom is fitted by least squares over the boundary correspondence
instead of being pinned.

The consequence is real and is stated on the plate: pinning the boundary
correspondence by a fitted rotation makes the composed map harmonic-exact but
only approximately conformal, and the measured agreement therefore carries that
approximation inside it. It is not a detail to bury in a docstring, which is why
it is also in the figure caption.

WHY THE VALIDATION IS NOT ALIM'S VALIDATION — A MEASURED NEGATIVE RESULT
------------------------------------------------------------------------
Alim et al. test the conformal hypothesis by correlating the displacement their
map predicts against a displacement field measured by PIV. We implemented that
comparison (`predicted_field`, `compare_fields`) and then measured whether the
PIV side of it is trustworthy on PhenoLeaf-TS. It is not. `piv_reliability`
below reproduces the test. On Col-0/rep_21:

  * Block matching finds a high peak and cannot localise it. On leaf 5, the leaf
    the plates ship, the peak is a median 0.913 but clears its best rival outside
    a 3 px neighbourhood by only 0.027, leaving 67% of sites ambiguous at 0.05.
    Leaf 8 behaves the same way with more margin and less ambiguity (0.07–0.10,
    18–34%), so this is the regime and not one unlucky instance.
  * Against the crudest possible model — uniform dilation about the centroid —
    the observed field scored +0.71, −0.17 and −0.12 on three consecutive pairs.
  * The decisive test is nested intervals, and it took TWO measurements to read
    correctly. PIV from frame f to f+g and from f to f+2g starts at the same
    frame, so the two fields must point the same way (direction) and the longer
    one must be about twice as large (magnitude).

    Direction alone is not enough, because a static leaf passes it trivially:
    if both fields are the same pixel-locking artefact rather than a
    measurement, they correlate near-perfectly. That is exactly what happens.
    Across nine nested tests on five different leaves:

        magnitude ratio |d_long| / |d_short|, which should be 2.0
            measured 0.88, 0.91, 0.97, 0.99, 1.25, 1.26, 1.40, 1.64, 2.06
            median 1.25

    The displacement PIV reports is very nearly INDEPENDENT of how much time
    elapsed, which is disqualifying on its own — a field whose magnitude does
    not scale with the interval is not measuring a rate. And the two numbers are
    opposed: the single case that scales correctly (ratio 2.06) has the worst
    direction agreement (r = +0.32), while the best direction agreement
    (r = +0.97) comes with ratio 0.88. Agreement and scaling never co-occur.
    `nested_interval_consistency` and `nested_interval_scaling` are both below,
    and plate 05 shows them together for that reason.

The cause is physical, not algorithmic, and no parameter setting repairs it.
PhenoLeaf-TS images a whole rosette at 450×432, so one leaf spans about 50×90 px
and carries no resolvable venation. Alim et al. imaged single leaves at a
magnification where the vein network is the texture being tracked. The signal
PIV requires is not in these pixels, and the predicted-vs-observed correlation
is therefore not a number this dataset can produce honestly.

So the quantitative plate tests the hypothesis a different way, using the only
measurement here that IS reliable — the ground-truth instance masks. See
`heldout_interpolation`: build the growth map from t₀ to t₂, ask it where the
margin was at the intermediate time t₁, and score that against t₁'s real mask,
which the map never saw. Scored against three baselines, one of which is the
arc-length correspondence the conformal map is supposed to improve on.

Its result is also reported rather than hidden. Over the eight triples on leaf 5
that the quantitative plate ships — `_heldout_self_test` below reproduces the
table exactly, from the same rosette centre:

                      median held-out IoU
    conformal                0.758
    arc-length null          0.757
    uniform dilation         0.677
    no growth at all         0.675

  conformal − arc-length:  +0.003 ± 0.011, conformal ahead in 5 of 8
  conformal − no-growth:   +0.108,          conformal ahead in 6 of 8

The conformal map clearly does something — it beats the static baseline by 11
IoU points — but it is NOT separable from the arc-length correspondence it was
supposed to improve on. The difference is a third of its own scatter. At this
resolution and this cadence that question is below the noise, and the plate says
so rather than rounding a tie into a win.

The two triples where the conformal map falls behind uniform dilation (47→50→53,
58→61→64) are the two whose no-growth baseline is already 0.77 and 0.92: the
leaf barely moved, so every method is scoring the mask against itself. That is a
property of the interval, not of the method, and it is reported with them.

One sensitivity is worth recording because it was found the hard way. The
landmark search is a nearest- and farthest-point query against the rosette
centroid, so the centre is load-bearing: computing it from frame 48 rather than
frame 49, and from `!= 255` rather than the plate's `>= 250` white test, threw
one triple's fitted rotation to −63.6° with a boundary concentration of 0.889
and dropped its IoU from 0.750 to 0.588. The alignment is stable (concentration
0.970–0.997 on all eight) only when the centre is the one the plate uses.

UNITS
-----
Pixels and square pixels, everywhere, without exception. PhenoLeaf-TS ships no
spatial calibration, so there is no mm/px to convert with. Any function here
returning something that looks like a physical rate would be returning a number
nobody can defend.
"""

from __future__ import annotations

import numpy as np
import triangle as shewchuk
from scipy import sparse
from scipy.sparse import linalg as spla
from scipy.spatial import Delaunay, cKDTree
from skimage.measure import find_contours

# ── mesh resolution ─────────────────────────────────────────────────────────
# Target edge length in pixels. Both the boundary sampling and the interior
# point spacing derive from this one number, which is the fix for the failure
# described in `build_mesh` below.
DEFAULT_EDGE = 3.0
MIN_BOUNDARY_VERTICES = 40

# ── acceptance thresholds for the Riemann map ───────────────────────────────
# Winding is the sharp test: if the boundary image goes around the circle
# exactly once, φ is a bijection onto the disk. Discretisation costs a little,
# and measured values on real leaf masks land at 0.986–0.997 turns.
MIN_WINDING = 0.97

# The map compresses the rim enormously — |φ| = 1 there — so near-boundary
# vertices accumulate the discretisation error. Measured over six frames, the
# largest interior modulus is 0.979 to 1.000031: four vertices on one frame sit
# 3e-5 outside the circle. A tolerance of 1e-6 would reject that frame for an
# error two orders of magnitude below the mesh's own resolution, so the bound is
# set where a genuine escape would be and no tighter.
MAX_INTERIOR_MODULUS = 1.0 + 1e-3

# Local injectivity is gated on inverted AREA, not on a count of inverted
# triangles.
#
# The same rim compression drives a handful of triangles per frame to a mapped
# area of 1e-11 to 1e-5 relative to the largest — four to ten orders of
# magnitude below the median triangle — and the sign of a quantity that small is
# floating-point noise rather than an inverted element. Counting them rejected
# every frame. Adding a per-triangle significance threshold to not count them
# worked, but it was a second knob whose only job was to make the first knob's
# verdict come out right, and each frame that failed would have moved it again.
#
# Area needs no such knob: it is one number, it means "how much of the disk the
# map covers backwards", and noise-level triangles contribute nothing to it by
# construction. A real fold — a lobe turning inside out — would be percent-scale
# and nowhere near this bound.
MAX_FOLDED_AREA_FRACTION = 1e-4


class MapQualityError(RuntimeError):
    """Raised when a Riemann map fails its own asserts.

    A frame that fails is skipped and reported, never rendered. A plate drawn
    from a map that is not a bijection is a picture of a bug.
    """


# ============================================================================
# MESH
# ============================================================================


def resample_closed_curve(poly: np.ndarray, n: int) -> np.ndarray:
    poly = np.vstack([poly, poly[:1]])
    seg = np.sqrt(np.sum(np.diff(poly, axis=0) ** 2, axis=1))
    cum = np.concatenate([[0], np.cumsum(seg)])
    targets = np.linspace(0, cum[-1], n, endpoint=False)
    return np.stack(
        [np.interp(targets, cum, poly[:, 0]), np.interp(targets, cum, poly[:, 1])],
        axis=1,
    )


def outer_contour(mask: np.ndarray) -> np.ndarray:
    """Longest 0.5-level contour of the mask, as (x, y)."""
    contours = find_contours(mask.astype(float), 0.5)
    if not contours:
        raise MapQualityError("mask has no contour")
    return max(contours, key=len)[:, ::-1]


def build_mesh(mask: np.ndarray, edge: float = DEFAULT_EDGE):
    """Triangulate the blade. Returns (points, triangles, n_boundary).

    Boundary vertices come first, in contour order, and are not moved — every
    solve below relies on both facts.

    WHY A CONSTRAINED TRIANGULATION AND NOT `scipy.spatial.Delaunay`
    ---------------------------------------------------------------
    The version this replaces handed boundary + interior points to `Delaunay`
    and kept the simplices whose centroid fell inside the mask. An unconstrained
    Delaunay triangulates the CONVEX HULL, and an Arabidopsis leaf is lobed, so
    the hull covers the sinuses between lobes. Measured on a real frame, 96 of
    419 triangles (23%) lay outside the blade — the Laplacian was being
    assembled over a domain that included the gaps between the lobes.

    Filtering those out does not fix it, because the filter creates the second
    failure. Across a concave stretch of rim, Delaunay connects three
    consecutive BOUNDARY vertices to each other; such a triangle either falls
    outside the mask and is filtered, orphaning vertices whose rows then make
    the interior Laplacian singular, or it survives as a rim sliver. Measured on
    frame 70: exactly 15 all-boundary triangles existed and all 15 inverted
    under the map. Moving the interior sampling closer to the rim only trades
    one failure for the other — measured across six frames and five offsets,
    every setting produced either folds or orphans.

    Both failures are the same fact: an unconstrained Delaunay cannot be made to
    respect a concave boundary, because respecting it is not what it computes.
    A constrained Delaunay triangulation is the tool that does, so this uses
    Shewchuk's Triangle through the `triangle` package, with the contour as a
    PSLG of enforced segments:

        p   treat the input as a planar straight-line graph
        q30 refine until every angle is at least 30 degrees — no slivers
        a   cap triangle area, so resolution follows `edge` as before
        Y   forbid new vertices ON the boundary segments

    `Y` is what keeps the first `n_boundary` points exactly the resampled
    contour, so landmark indices and the boundary correspondence survive
    meshing. It is asserted below rather than assumed.
    """
    contour = outer_contour(mask)
    # Force counter-clockwise. `find_contours` does not promise an orientation,
    # and two frames traversed in opposite directions would give a boundary
    # correspondence that runs backwards — a growth map that reflects the leaf
    # while reporting a perfectly good winding number.
    closed = np.vstack([contour, contour[:1]])
    signed = float(
        np.sum(closed[:-1, 0] * closed[1:, 1] - closed[1:, 0] * closed[:-1, 1]) / 2.0
    )
    if signed < 0:
        contour = contour[::-1]
        closed = np.vstack([contour, contour[:1]])
    perimeter = float(np.sum(np.linalg.norm(np.diff(closed, axis=0), axis=1)))
    n_boundary = max(MIN_BOUNDARY_VERTICES, int(round(perimeter / edge)))
    boundary = resample_closed_curve(contour, n_boundary)

    segments = np.stack([np.arange(n_boundary), (np.arange(n_boundary) + 1) % n_boundary], axis=1)
    max_area = 0.5 * edge * edge
    out = shewchuk.triangulate(
        {"vertices": boundary, "segments": segments}, f"pq30a{max_area:.6f}Y"
    )
    points = np.asarray(out["vertices"], dtype=float)
    triangles = np.asarray(out["triangles"], dtype=int)
    if len(triangles) == 0:
        raise MapQualityError("constrained triangulation produced no triangles")
    if len(points) <= n_boundary:
        raise MapQualityError("constrained triangulation produced no interior vertices")
    if not np.allclose(points[:n_boundary], boundary):
        raise MapQualityError("triangulation moved the boundary vertices")

    return points, triangles, n_boundary


def cotangent_laplacian(points: np.ndarray, triangles: np.ndarray) -> sparse.csr_matrix:
    """Standard cotangent weights, vectorised over triangles.

    Positive-semidefinite with zero row sums, so it is the discrete Laplacian in
    the sense all three solves below assume.
    """
    n = len(points)
    q = points[triangles]
    rows, cols, vals = [], [], []
    for k in range(3):
        i, j, o = triangles[:, k], triangles[:, (k + 1) % 3], triangles[:, (k + 2) % 3]
        a, b = points[i] - points[o], points[j] - points[o]
        cross = np.abs(a[:, 0] * b[:, 1] - a[:, 1] * b[:, 0])
        cot = np.sum(a * b, axis=1) / (cross + 1e-12) / 2.0
        rows.extend([i, j])
        cols.extend([j, i])
        vals.extend([-cot, -cot])
    del q
    rows = np.concatenate(rows)
    cols = np.concatenate(cols)
    vals = np.concatenate(vals)
    off = sparse.coo_matrix((vals, (rows, cols)), shape=(n, n)).tocsr()
    diag = sparse.diags(-np.asarray(off.sum(axis=1)).ravel())
    return (off + diag).tocsr()


def _gradient_per_triangle(points: np.ndarray, triangles: np.ndarray, f: np.ndarray):
    """∇f on each triangle for a piecewise-linear f, plus twice the signed area.

    On a linear element the gradient is a fixed combination of the three
    opposite-edge normals; this is that combination, written out so the
    conjugate below can rotate it directly.
    """
    q = points[triangles]
    fv = f[triangles]
    edges = [q[:, 2] - q[:, 1], q[:, 0] - q[:, 2], q[:, 1] - q[:, 0]]
    twice_area = (q[:, 1, 0] - q[:, 0, 0]) * (q[:, 2, 1] - q[:, 0, 1]) - (
        q[:, 2, 0] - q[:, 0, 0]
    ) * (q[:, 1, 1] - q[:, 0, 1])
    rot = [np.stack([-e[:, 1], e[:, 0]], axis=1) for e in edges]
    grad = sum(fv[:, k : k + 1] * rot[k] for k in range(3)) / twice_area[:, None]
    return grad, twice_area, rot


# ============================================================================
# THE RIEMANN MAP
# ============================================================================


def riemann_map(points, triangles, n_boundary, z0=None):
    """Conformal map of the blade onto the unit disk, with z0 ↦ 0.

    Returns (phi, report) where `phi` is complex per vertex and `report` carries
    the two measurements that decide whether the map is usable.

    Raises MapQualityError rather than returning a bad map, because the only
    thing worse than a failed frame is a rendered one that quietly is not a
    bijection.
    """
    n = len(points)
    z = points[:, 0] + 1j * points[:, 1]
    if z0 is None:
        interior = points[n_boundary:]
        z0 = interior.mean(axis=0) if len(interior) else points.mean(axis=0)
    z0c = complex(z0[0], z0[1])

    L = cotangent_laplacian(points, triangles)
    Ll = L.tolil()
    bi = np.arange(n_boundary)
    ii = np.arange(n_boundary, n)

    # 1. u harmonic, u|∂Ω = log|z - z0|.
    ub = np.log(np.abs(z[bi] - z0c))
    A = Ll[ii][:, ii].tocsc()
    rhs = -Ll[ii][:, bi].tocsr().dot(ub)
    ui = spla.spsolve(A, rhs)
    if not np.all(np.isfinite(ui)):
        raise MapQualityError("Dirichlet solve for u did not converge (singular system)")
    u = np.zeros(n)
    u[bi], u[ii] = ub, ui

    # 2. v the harmonic conjugate: ∇v = J∇u, assembled weakly as a Poisson
    #    problem. One vertex is pinned, which fixes only the additive constant
    #    (a rotation of the disk) and nothing that matters.
    grad_u, twice_area, rot = _gradient_per_triangle(points, triangles, u)
    grad_v = np.stack([-grad_u[:, 1], grad_u[:, 0]], axis=1)
    area = np.abs(twice_area) / 2.0
    b = np.zeros(n)
    for k in range(3):
        contrib = np.sum((rot[k] / twice_area[:, None]) * grad_v, axis=1) * area
        np.add.at(b, triangles[:, k], contrib)
    Lv = L.tolil()
    Lv[0, :] = 0
    Lv[0, 0] = 1
    b[0] = 0.0
    v = spla.spsolve(Lv.tocsc(), b)
    if not np.all(np.isfinite(v)):
        raise MapQualityError("Poisson solve for the harmonic conjugate did not converge")

    phi = (z - z0c) * np.exp(-(u + 1j * v))

    # 3. The asserts.
    #
    # |phi| = 1 on the boundary is true by construction, not a test — it is
    # reported because it is a free check that the solve did not drift, and it
    # lands at machine epsilon when nothing is wrong.
    #
    # Winding was originally the only test here, on the reasoning that a
    # boundary image going round the circle once means a bijection. In the
    # continuum that is the argument principle; on a triangulation it is not
    # enough, and measurement showed it: frames with winding 1.000000 still had
    # 16-28 triangles of ~700 inverted. So orientation is checked per triangle
    # as well, which is the property the barycentric inverse actually needs —
    # an inverted triangle does not degrade a correspondence, it returns a
    # different point.
    #
    # The gate is on inverted area, for the reason given at
    # MAX_FOLDED_AREA_FRACTION; the count is reported alongside it because the
    # two together say something neither does alone — many triangles holding
    # almost no area is the rim, and few triangles holding real area is a fold.
    ang = np.angle(phi[bi])
    winding = float(np.sum(np.diff(np.unwrap(np.concatenate([ang, ang[:1]])))) / (2 * np.pi))
    if winding < 0:
        phi = np.conj(phi)

    w = np.stack([phi.real, phi.imag], axis=1)[triangles]
    mapped_area = (w[:, 1, 0] - w[:, 0, 0]) * (w[:, 2, 1] - w[:, 0, 1]) - (
        w[:, 2, 0] - w[:, 0, 0]
    ) * (w[:, 1, 1] - w[:, 0, 1])
    if np.sum(mapped_area > 0) < np.sum(mapped_area < 0):
        mapped_area = -mapped_area
    negative = mapped_area <= 0
    folded = int(np.sum(negative))
    folded_area = (
        float(np.sum(np.abs(mapped_area[negative])) / np.sum(np.abs(mapped_area)))
        if len(mapped_area)
        else 0.0
    )

    boundary_modulus = float(np.max(np.abs(np.abs(phi[bi]) - 1.0)))
    interior_modulus = float(np.max(np.abs(phi[ii]))) if len(ii) else 0.0

    report = {
        "winding": abs(winding),
        "boundary_modulus_error": boundary_modulus,
        "max_interior_modulus": interior_modulus,
        "folded_triangles": folded,
        "folded_area_fraction": folded_area,
        "vertices": n,
        "triangles": len(triangles),
        "n_boundary": n_boundary,
    }
    if abs(winding) < MIN_WINDING:
        raise MapQualityError(
            f"boundary winding {abs(winding):.3f} turns < {MIN_WINDING} — not a bijection"
        )
    if interior_modulus > MAX_INTERIOR_MODULUS:
        raise MapQualityError(
            f"interior vertex at |phi| = {interior_modulus:.4f} — map escaped the disk"
        )
    if folded_area > MAX_FOLDED_AREA_FRACTION:
        raise MapQualityError(
            f"{folded_area * 100:.3f}% of the disk is covered backwards "
            f"({folded} of {len(triangles)} triangles) — not locally injective"
        )
    return phi, report


# ============================================================================
# LANDMARKS AND DISK ALIGNMENT
# ============================================================================


def leaf_landmarks(points: np.ndarray, n_boundary: int, rosette_centre: np.ndarray):
    """(attachment_index, tip_index) into the boundary vertices.

    Attachment is the boundary point nearest the rosette centre — where the
    petiole meets the blade — and the tip is the point farthest from it. Both
    are anatomy, not convenience: measured across 10-frame gaps on three
    different leaves, the axis between them rotates only 0.3–2.6°, and the tip
    lands at arc-length fraction 0.49–0.52 of the way around the contour every
    time. A detector keyed to nothing real would not do that twice.
    """
    b = points[:n_boundary]
    d = np.linalg.norm(b - np.asarray(rosette_centre, dtype=float), axis=1)
    attachment = int(np.argmin(d))
    tip = int(np.argmax(np.linalg.norm(b - b[attachment], axis=1)))
    return attachment, tip


def _arc_parameterise(boundary: np.ndarray, start: int, n: int = 512) -> np.ndarray:
    """Indices-with-fractions at `n` equal arc-length steps from `start`.

    Returns an (n, 3) array of (lower index, upper index, weight) into the
    boundary, walked counter-clockwise from `start` — enough to interpolate any
    per-vertex quantity at a common material parameter.
    """
    rolled = np.roll(np.arange(len(boundary)), -start)
    pts = boundary[rolled]
    closed = np.vstack([pts, pts[:1]])
    seg = np.linalg.norm(np.diff(closed, axis=0), axis=1)
    cum = np.concatenate([[0.0], np.cumsum(seg)])
    want = np.linspace(0.0, cum[-1], n, endpoint=False)

    hi = np.searchsorted(cum, want, side="right")
    hi = np.clip(hi, 1, len(cum) - 1)
    lo = hi - 1
    span = np.where(seg[lo] > 1e-12, seg[lo], 1.0)
    w = (want - cum[lo]) / span
    return np.stack([rolled[lo % len(pts)], rolled[hi % len(pts)], w], axis=1)


def align_disk(phi_a, phi_b, points_a, points_b, n_boundary_a, n_boundary_b,
               landmarks_a, landmarks_b, n_samples: int = 512):
    """Rotate the second disk onto the first.

    Alim et al. pin three landmarks, which exhausts the Möbius group and
    determines the alignment outright. We have two (see the module docstring),
    so this does what two landmarks support and no more: a rotation, chosen by
    least squares over the full boundary correspondence rather than by pinning.

    THE CORRESPONDENCE IS ARC LENGTH, AND IT HAS TO BE
    --------------------------------------------------
    An earlier version correlated the two boundaries *by array index*. That is
    wrong twice over: the two meshes do not have the same boundary-vertex count
    (92 and 117 on the frames this was first run against), and `find_contours`
    begins each ring at whatever pixel it happens to reach first. Index i in one
    frame and index i in the other were not the same material point, so the
    fitted angle was the circular mean of a correspondence that did not exist.

    So both rings are resampled at equal arc-length steps measured from the
    attachment landmark and traversed counter-clockwise (`build_mesh` forces the
    orientation, so "counter-clockwise" means the same thing in both). Equal arc
    fraction from the petiole is a *proxy* for the same material point, not a
    measurement of one — the blade does not grow uniformly along its margin.
    It is defensible here only because it is being used to fit one scalar, and
    the quantity reported below says how much that scalar is in doubt.

    Returns (theta, report). `report['landmark_disagreement_deg']` is how far the
    fitted rotation sits from the one the two landmarks alone would have given,
    and it is the honest measure of what the missing third landmark costs.
    """
    att_a, tip_a = landmarks_a
    att_b, tip_b = landmarks_b

    sa = _arc_parameterise(points_a[:n_boundary_a], att_a, n_samples)
    sb = _arc_parameterise(points_b[:n_boundary_b], att_b, n_samples)

    def lerp(phi, s):
        lo = phi[s[:, 0].astype(int)]
        hi = phi[s[:, 1].astype(int)]
        return lo + (hi - lo) * s[:, 2]

    a = lerp(phi_a, sa)
    b = lerp(phi_b, sb)
    offsets = np.conj(b) * a
    theta = float(np.angle(np.sum(offsets)))

    # How tightly the per-sample offsets cluster. 1.0 would mean every point on
    # the margin agrees on the rotation; low values mean the single angle is a
    # compromise and the two shapes differ by more than a rotation.
    unit = offsets / np.maximum(np.abs(offsets), 1e-30)
    concentration = float(np.abs(np.mean(unit)))

    axis_a = np.angle(phi_a[tip_a] - phi_a[att_a])
    axis_b = np.angle(phi_b[tip_b] - phi_b[att_b])
    landmark_theta = float(axis_a - axis_b)
    disagreement = float(np.degrees(np.abs(np.angle(np.exp(1j * (theta - landmark_theta))))))

    return theta, {
        "theta_deg": float(np.degrees(theta)),
        "landmark_theta_deg": float(np.degrees(landmark_theta)),
        "landmark_disagreement_deg": disagreement,
        "boundary_concentration": concentration,
        "samples": int(n_samples),
    }


# ============================================================================
# THE GROWTH MAP AND ITS PREDICTED FIELD
# ============================================================================


def _barycentric_inverse(target: np.ndarray, disk_pts: np.ndarray, triangles: np.ndarray,
                        source_pts: np.ndarray) -> np.ndarray:
    """Invert a piecewise-linear map by locating each target in the mapped mesh.

    `disk_pts` is the triangulation's image in the disk and `source_pts` the same
    vertices in the plane. For each target point, find the triangle containing it
    in the disk and read off the barycentric combination of the corresponding
    source vertices. Points outside every triangle come back NaN and are dropped
    by the caller rather than being clamped to the nearest edge — a clamped point
    is a fabricated correspondence.
    """
    out = np.full((len(target), 2), np.nan)
    q = disk_pts[triangles]
    v0 = q[:, 1] - q[:, 0]
    v1 = q[:, 2] - q[:, 0]
    den = v0[:, 0] * v1[:, 1] - v1[:, 0] * v0[:, 1]
    good = np.abs(den) > 1e-14

    # Nearest centroids as candidates, then an exact barycentric test on each.
    # `Delaunay(disk_pts).find_simplex` would be a faster locator but it answers
    # about ITS OWN triangulation of the mapped points, which is not the mapped
    # triangulation — the two differ wherever the map is strongly anisotropic,
    # which near the rim is everywhere. The candidate-and-verify route tests the
    # triangles that actually exist.
    centroids = q.mean(axis=1)
    _, near = cKDTree(centroids).query(target, k=min(16, len(centroids)))
    near = np.atleast_2d(near)

    for i, p in enumerate(target):
        for t in near[i]:
            if not good[t]:
                continue
            d = p - q[t, 0]
            l1 = (d[0] * v1[t, 1] - v1[t, 0] * d[1]) / den[t]
            l2 = (v0[t, 0] * d[1] - d[0] * v0[t, 1]) / den[t]
            l0 = 1.0 - l1 - l2
            if l0 >= -1e-9 and l1 >= -1e-9 and l2 >= -1e-9:
                out[i] = l0 * source_pts[triangles[t, 0]] + l1 * source_pts[triangles[t, 1]] + l2 * source_pts[triangles[t, 2]]
                break
    return out


def predicted_field(mesh_a, phi_a, mesh_b, phi_b, theta):
    """Displacement predicted by the conformal growth map f = φ_b⁻¹ ∘ R_θ ∘ φ_a.

    Evaluated at mesh A's interior vertices. Returns (positions, displacement,
    report); vertices whose image falls outside mesh B's disk image are dropped
    and counted, never extrapolated.
    """
    pts_a, tris_a, nb_a = mesh_a
    pts_b, tris_b, _nb_b = mesh_b

    interior = np.arange(nb_a, len(pts_a))
    src = pts_a[interior]
    mapped = phi_a[interior] * np.exp(1j * theta)
    target = np.stack([mapped.real, mapped.imag], axis=1)

    disk_b = np.stack([phi_b.real, phi_b.imag], axis=1)
    landed = _barycentric_inverse(target, disk_b, tris_b, pts_b)

    ok = np.all(np.isfinite(landed), axis=1)
    report = {
        "evaluated": int(len(src)),
        "landed": int(ok.sum()),
        "dropped_outside_disk": int((~ok).sum()),
    }
    return src[ok], landed[ok] - src[ok], report


# ============================================================================
# COMPARISON AGAINST THE MEASURED FIELD
# ============================================================================


def remove_rigid_motion(pos: np.ndarray, disp: np.ndarray) -> np.ndarray:
    """Subtract the best-fit translation + infinitesimal rotation.

    Both fields get this, and they get the same function. A leaf that merely
    shifts between frames would otherwise produce a high correlation that says
    nothing about growth — the thing being tested is the residual deformation,
    so the rigid part has to come out of both sides or out of neither.
    """
    if len(pos) < 3:
        return disp
    c = pos.mean(axis=0)
    r = pos - c
    # [u; v] = [1 0 -ry; 0 1 rx] · [tx; ty; ω]
    n = len(pos)
    A = np.zeros((2 * n, 3))
    A[0::2, 0] = 1.0
    A[1::2, 1] = 1.0
    A[0::2, 2] = -r[:, 1]
    A[1::2, 2] = r[:, 0]
    bvec = np.empty(2 * n)
    bvec[0::2] = disp[:, 0]
    bvec[1::2] = disp[:, 1]
    sol, *_ = np.linalg.lstsq(A, bvec, rcond=None)
    fit = (A @ sol).reshape(-1, 2)
    return disp - fit


def compare_fields(pos_pred, disp_pred, pos_obs, disp_obs, mask, radius=6.0):
    """Alim et al.'s agreement metric between the predicted and observed fields.

        corr = Σ_{i∈x,y} (Uᵢ−⟨U⟩)(Vᵢ−⟨V⟩) / √Σ(Uᵢ−⟨U⟩)² √Σ(Vᵢ−⟨V⟩)²

    — one Pearson correlation over the x and y components concatenated, not two
    correlations averaged, so a field that gets x right and y wrong cannot hide
    behind the mean.

    Both fields are first resampled onto the SAME points, inside the SAME mask,
    over the SAME interval, and both have rigid motion removed. Those four
    "same"s are the entire validity of the number; a comparison that skips any
    of them is measuring the sampling, not the agreement.

    Returns (corr, report). Whatever this returns is what ships. The paper's own
    92–97% is their measurement of their data with three landmarks, and quoting
    it here would be reporting someone else's result as ours.
    """
    pos_pred = np.asarray(pos_pred, dtype=float)
    pos_obs = np.asarray(pos_obs, dtype=float)
    if len(pos_pred) == 0 or len(pos_obs) == 0:
        return float("nan"), {"sites": 0, "reason": "one field is empty"}

    # Common sites: predicted vertices that sit inside the mask and have an
    # observed vector close enough to interpolate from.
    xi = np.clip(pos_pred[:, 0].astype(int), 0, mask.shape[1] - 1)
    yi = np.clip(pos_pred[:, 1].astype(int), 0, mask.shape[0] - 1)
    inside = mask[yi, xi]

    tree = cKDTree(pos_obs)
    dist, idx = tree.query(pos_pred)
    near = dist <= radius
    keep = inside & near
    if keep.sum() < 8:
        return float("nan"), {
            "sites": int(keep.sum()),
            "reason": "fewer than eight common sites",
        }

    pos = pos_pred[keep]
    pred = remove_rigid_motion(pos, np.asarray(disp_pred, dtype=float)[keep])
    obs = remove_rigid_motion(pos, np.asarray(disp_obs, dtype=float)[idx[keep]])

    U = np.concatenate([pred[:, 0], pred[:, 1]])
    V = np.concatenate([obs[:, 0], obs[:, 1]])
    U = U - U.mean()
    V = V - V.mean()
    denom = np.sqrt(np.sum(U**2)) * np.sqrt(np.sum(V**2))
    corr = float(np.sum(U * V) / denom) if denom > 1e-12 else float("nan")

    return corr, {
        "sites": int(keep.sum()),
        "dropped_outside_mask": int((~inside).sum()),
        "dropped_no_observation": int((inside & ~near).sum()),
        "rms_predicted_px": float(np.sqrt(np.mean(np.sum(pred**2, axis=1)))),
        "rms_observed_px": float(np.sqrt(np.mean(np.sum(obs**2, axis=1)))),
    }


# ============================================================================
# IS THE MEASURED FIELD WORTH COMPARING AGAINST? (the negative result)
# ============================================================================


def texture_localisability(gray: np.ndarray, gray_next: np.ndarray, mask: np.ndarray,
                           win: int = 16, search: int = 12, n_sites: int = 60,
                           seed: int = 0) -> dict:
    """Can block matching LOCATE a patch here, as opposed to merely match one?

    A high correlation peak is not evidence. On low-texture tissue the peak is
    high everywhere, and what decides whether a displacement is measured or
    guessed is the margin — how far the peak clears the best rival outside its
    own neighbourhood. This reports that margin, and the intra-leaf grey spread
    that bounds it.
    """
    from skimage.feature import match_template

    ys, xs = np.nonzero(mask)
    rng = np.random.default_rng(seed)
    sel = rng.choice(len(ys), min(n_sites, len(ys)), replace=False)
    hw = win // 2
    peaks, margins = [], []
    for k in sel:
        yc, xc = int(ys[k]), int(xs[k])
        if yc - hw - search < 0 or xc - hw - search < 0:
            continue
        if yc + hw + search >= gray.shape[0] or xc + hw + search >= gray.shape[1]:
            continue
        if mask[yc - hw:yc + hw, xc - hw:xc + hw].mean() < 0.5:
            continue
        patch = gray[yc - hw:yc + hw, xc - hw:xc + hw]
        if patch.std() < 0.005:
            continue
        res = match_template(
            gray_next[yc - hw - search:yc + hw + search, xc - hw - search:xc + hw + search],
            patch,
        )
        pi = np.unravel_index(np.argmax(res), res.shape)
        rival = res.copy()
        rival[max(0, pi[0] - 3):pi[0] + 4, max(0, pi[1] - 3):pi[1] + 4] = -np.inf
        peaks.append(float(res[pi]))
        margins.append(float(res[pi] - (np.max(rival) if np.isfinite(rival).any() else -1.0)))

    if not peaks:
        return {"sites": 0}
    margins = np.asarray(margins)
    return {
        "sites": len(peaks),
        "grey_sd": float(gray[mask].std()),
        "peak_median": float(np.median(peaks)),
        "margin_median": float(np.median(margins)),
        "ambiguous_fraction": float(np.mean(margins < 0.05)),
    }


def nested_interval_consistency(disp_short: np.ndarray, disp_long: np.ndarray) -> float:
    """Do two nested-interval measurements point the same way?

    Necessary but NOT sufficient, and reporting it alone was a mistake worth
    recording. Two fields measured from the same base frame must agree in
    direction — but so do two copies of the same artefact, which is why a leaf
    that has stopped moving scores +0.97 here. Always read it beside
    `nested_interval_scaling`, which the artefact cannot pass.
    """
    u = np.concatenate([disp_short[:, 0], disp_short[:, 1]])
    v = np.concatenate([disp_long[:, 0], disp_long[:, 1]])
    u = u - u.mean()
    v = v - v.mean()
    denom = np.sqrt(np.sum(u**2)) * np.sqrt(np.sum(v**2))
    return float(np.sum(u * v) / denom) if denom > 1e-12 else float("nan")


def nested_interval_scaling(disp_short: np.ndarray, disp_long: np.ndarray,
                            hours_short: float, hours_long: float) -> dict:
    """Does the measured displacement grow with the time allowed for it?

    The test the locking artefact fails. Over a longer interval a real
    displacement field must be proportionately larger; noise that comes from the
    pixel grid is the same size however long you wait. `expected` is the ratio
    of elapsed hours — taken from the timestamps, not from the frame count,
    because this cadence is irregular.

    No threshold is applied here. The ratio is returned and reported; what counts
    as "close enough to 1" is a judgement for the caller to make in the open.
    """
    short = float(np.mean(np.linalg.norm(disp_short, axis=1)))
    long = float(np.mean(np.linalg.norm(disp_long, axis=1)))
    expected = hours_long / hours_short if hours_short > 0 else float("nan")
    measured = long / short if short > 1e-9 else float("nan")
    return {
        "mean_short_px": short,
        "mean_long_px": long,
        "expected_ratio": expected,
        "measured_ratio": measured,
        "shortfall": measured / expected if expected else float("nan"),
    }


# ============================================================================
# THE HELD-OUT TEST THAT REPLACES IT (plate 06)
# ============================================================================


def boundary_correspondence(mesh_a, phi_a, mesh_b, phi_b, theta) -> np.ndarray:
    """Where the growth map sends each of mesh A's margin vertices.

    φ_b is inverted on the boundary by interpolating between the two boundary
    vertices of B whose disk angles bracket the target — exact there, because
    both rings lie on the unit circle, so no triangle search is needed.
    """
    pts_a, _, nb_a = mesh_a
    pts_b, _, nb_b = mesh_b
    target = np.angle(phi_a[:nb_a] * np.exp(1j * theta))

    ang_b = np.angle(phi_b[:nb_b])
    order = np.argsort(ang_b)
    ring_a = np.concatenate([ang_b[order], ang_b[order][:1] + 2 * np.pi])
    ring_p = np.vstack([pts_b[:nb_b][order], pts_b[:nb_b][order][:1]])

    k = np.clip(np.searchsorted(ring_a, target), 1, len(ring_a) - 1)
    w = (target - ring_a[k - 1]) / np.maximum(ring_a[k] - ring_a[k - 1], 1e-12)
    return ring_p[k - 1] + (ring_p[k] - ring_p[k - 1]) * w[:, None]


def heldout_interpolation(mask_0, mask_1, mask_2, rosette_centre, fraction,
                          n_contour: int = 400) -> dict:
    """Score the conformal correspondence on a mask it was never shown.

    Builds the growth map from t₀ to t₂, asks where the margin was at the
    intermediate time t₁, and scores the rasterised prediction against t₁'s
    actual instance mask by intersection-over-union. `fraction` is t₁'s position
    in elapsed hours, not in frame count — the cadence is irregular.

    Interpolation rather than extrapolation because t₁ is genuinely held out
    either way and interpolation is the better-conditioned of the two; and
    because extrapolating a growing leaf linearly is a known under-prediction
    that would flatter every model equally and discriminate between none.

    Three baselines, and they are the point. `arc_length` is the correspondence
    the conformal map exists to improve on; `uniform_dilation` is the crudest
    growth model that is still a growth model; `no_growth` is t₀ unchanged, the
    score any method must clear to have done anything at all.
    """
    from skimage.draw import polygon2mask

    centre = np.asarray(rosette_centre, dtype=float)
    shape = mask_0.shape

    mesh_0 = build_mesh(mask_0)
    mesh_2 = build_mesh(mask_2)
    phi_0, rep_0 = riemann_map(*mesh_0)
    phi_2, rep_2 = riemann_map(*mesh_2)
    lm_0 = leaf_landmarks(mesh_0[0], mesh_0[2], centre)
    lm_2 = leaf_landmarks(mesh_2[0], mesh_2[2], centre)
    theta, align = align_disk(
        phi_0, phi_2, mesh_0[0], mesh_2[0], mesh_0[2], mesh_2[2], lm_0, lm_2
    )

    margin_0 = mesh_0[0][: mesh_0[2]]
    conformal = margin_0 + (
        boundary_correspondence(mesh_0, phi_0, mesh_2, phi_2, theta) - margin_0
    ) * fraction

    # Arc-length null: both rings resampled uniformly and rotated to start at the
    # attachment point, so index i means the same arc fraction from the petiole.
    ring_0 = resample_closed_curve(outer_contour(mask_0), n_contour)
    ring_2 = resample_closed_curve(outer_contour(mask_2), n_contour)
    ring_0 = np.roll(ring_0, -int(np.argmin(np.linalg.norm(ring_0 - centre, axis=1))), axis=0)
    ring_2 = np.roll(ring_2, -int(np.argmin(np.linalg.norm(ring_2 - centre, axis=1))), axis=0)
    arc = ring_0 + (ring_2 - ring_0) * fraction

    blade_centroid = np.array(np.nonzero(mask_0))[::-1].mean(axis=1)
    scale = 1.0 + (np.sqrt(mask_2.sum() / mask_0.sum()) - 1.0) * fraction
    dilation = blade_centroid + (ring_0 - blade_centroid) * scale

    def score(poly):
        r = polygon2mask(shape, np.asarray(poly)[:, ::-1])
        return float((r & mask_1).sum()) / float((r | mask_1).sum())

    return {
        "fraction": float(fraction),
        "theta_deg": align["theta_deg"],
        "boundary_concentration": align["boundary_concentration"],
        "landmark_disagreement_deg": align["landmark_disagreement_deg"],
        "winding": (rep_0["winding"], rep_2["winding"]),
        "iou_conformal": score(conformal),
        "iou_arc_length": score(arc),
        "iou_uniform_dilation": score(dilation),
        "iou_no_growth": float((mask_0 & mask_1).sum()) / float((mask_0 | mask_1).sum()),
        "area_px2": (int(mask_0.sum()), int(mask_1.sum()), int(mask_2.sum())),
    }


# ============================================================================
# SHAPE DESCRIPTORS (plate 03)
# ============================================================================


def shape_descriptors(mask: np.ndarray, rosette_centre=None, n_contour: int = 180) -> dict:
    """Area, contour length and bounding box, in px and px².

    Also returns a contour normalised for overlay: translated to its own
    centroid and rotated so the attachment→tip axis points the same way in every
    frame. It is NOT scaled — scaling out the size would erase the growth the
    plate exists to show, leaving a comparison of outline shape alone. The plate
    says which of the two it is showing.
    """
    contour = outer_contour(mask)
    closed = np.vstack([contour, contour[:1]])
    perimeter = float(np.sum(np.linalg.norm(np.diff(closed, axis=0), axis=1)))
    ys, xs = np.nonzero(mask)
    centroid = np.array([xs.mean(), ys.mean()])

    resampled = resample_closed_curve(contour, n_contour)
    centred = resampled - centroid
    if rosette_centre is not None:
        d = np.linalg.norm(resampled - np.asarray(rosette_centre, dtype=float), axis=1)
        attachment = resampled[int(np.argmin(d))]
        tip = resampled[int(np.argmax(np.linalg.norm(resampled - attachment, axis=1)))]
        axis = np.arctan2(*(tip - attachment)[::-1])
        c, s = np.cos(-axis), np.sin(-axis)
        centred = centred @ np.array([[c, -s], [s, c]]).T

    return {
        "area_px2": float(mask.sum()),
        "perimeter_px": perimeter,
        "bbox_w_px": float(xs.max() - xs.min() + 1),
        "bbox_h_px": float(ys.max() - ys.min() + 1),
        "centroid": centroid,
        "contour": resampled,
        "normalised_contour": centred,
    }


# ============================================================================
# SELF-TEST
# ============================================================================


def _self_test() -> int:
    """Run the asserts against the staged frames, with no rendering involved."""
    from pathlib import Path

    from PIL import Image

    root = Path(__file__).resolve().parent.parent
    labels = sorted(
        (root / "data" / "leaf-morphology" / "02_leaf_labels" / "Col-0" / "rep_21").glob("*.png")
    )
    if not labels:
        print("no staged frames — nothing to self-test")
        return 0

    colour = (245, 130, 49)
    failures = 0
    print(f"self-test: Riemann map on Col-0/rep_21, leaf {colour}")
    for i in (40, 50, 60, 70, 80, 90):
        if i >= len(labels):
            continue
        arr = np.array(Image.open(labels[i]).convert("RGB"))
        mask = np.all(arr == np.array(colour), axis=-1)
        if mask.sum() < 200:
            print(f"  frame {i:>3}: leaf absent or tiny ({mask.sum()} px) — skipped")
            continue
        try:
            pts, tris, nb = build_mesh(mask)
            _phi, rep = riemann_map(pts, tris, nb)
            print(
                f"  frame {i:>3}: {rep['vertices']:>4} verts {rep['triangles']:>4} tris "
                f"({nb} boundary)  winding {rep['winding']:.4f}  "
                f"|phi|-1 on bdry {rep['boundary_modulus_error']:.2e}  "
                f"max interior |phi| {rep['max_interior_modulus']:.6f}  "
                f"inverted {rep['folded_area_fraction'] * 100:.5f}% of disk "
                f"in {rep['folded_triangles']} rim tris"
            )
        except MapQualityError as exc:
            failures += 1
            print(f"  frame {i:>3}: FAILED — {exc}")

    failures += _heldout_self_test(labels)
    print("self-test:", "clean" if not failures else f"{failures} failure(s)")
    return failures


def _heldout_self_test(labels) -> int:
    """Reproduce the held-out interpolation result quoted in the module docstring.

    It is in the self-test rather than in a notebook because it is the number the
    quantitative plate reports, and a reported number that nobody can re-run is
    indistinguishable from one that was typed.
    """
    import re
    from datetime import datetime

    from PIL import Image

    # Leaf 5 of the palette, and the eight triples the quantitative plate scores.
    # Both are kept in step with `build-leaf-dynamics-plates.py` deliberately: the
    # table printed here is the table the plate ships, so the plate's claim can be
    # re-run from this repo without the dataset's selection logic in the way.
    colour = (245, 130, 49)
    stamp = re.compile(r"(\d{4})_(\d{2})_(\d{2})_(\d{2})")

    def hours(path):
        m = stamp.search(path.name)
        return datetime(*(int(g) for g in m.groups())).timestamp() / 3600.0

    def mask_at(i):
        arr = np.array(Image.open(labels[i]).convert("RGB"))
        return np.all(arr == np.array(colour), axis=-1)

    # The same rosette centre the plate uses — mid-frame of the leaf's span, and
    # the same definition of "annotated pixel". The landmark search is a nearest-
    # and farthest-point query against this one point, so a centre that differs by
    # a few pixels moves the petiole landmark and with it every number below. Two
    # code paths quoting the same result from two different centres is how a table
    # on a plate and a table in a self-test quietly stop agreeing.
    arr = np.array(Image.open(labels[(3 + 96) // 2]).convert("RGB"))
    annotated = ~np.all(arr >= 250, axis=-1) & ~np.all(arr == 0, axis=-1)
    ys, xs = np.nonzero(annotated)
    centre = np.array([xs.mean(), ys.mean()])

    triples = [(24, 27, 30), (30, 33, 36), (35, 38, 41), (41, 44, 47),
               (47, 50, 53), (53, 56, 59), (58, 61, 64), (64, 67, 70)]
    triples = [t for t in triples if t[2] < len(labels)]
    if not triples:
        return 0

    print(f"\nself-test: held-out interpolation, leaf {colour}")
    print(f"  {'triple':<14} {'s':>5} {'conf':>6} {'arc':>6} {'dilat':>6} {'static':>6} "
          f"{'theta':>7} {'conc':>5}")
    rows, failures = [], 0
    for f0, f1, f2 in triples:
        try:
            s = (hours(labels[f1]) - hours(labels[f0])) / (hours(labels[f2]) - hours(labels[f0]))
            r = heldout_interpolation(mask_at(f0), mask_at(f1), mask_at(f2), centre, s)
        except MapQualityError as exc:
            failures += 1
            print(f"  {f0}->{f1}->{f2}: FAILED — {exc}")
            continue
        rows.append(r)
        print(f"  {f0}->{f1}->{f2:<8} {r['fraction']:5.3f} {r['iou_conformal']:6.3f} "
              f"{r['iou_arc_length']:6.3f} {r['iou_uniform_dilation']:6.3f} "
              f"{r['iou_no_growth']:6.3f} {r['theta_deg']:+7.2f} "
              f"{r['boundary_concentration']:5.3f}")

    if rows:
        c = np.array([r["iou_conformal"] for r in rows])
        a = np.array([r["iou_arc_length"] for r in rows])
        d = np.array([r["iou_uniform_dilation"] for r in rows])
        n = np.array([r["iou_no_growth"] for r in rows])
        print(f"  median        {'':5} {np.median(c):6.3f} {np.median(a):6.3f} "
              f"{np.median(d):6.3f} {np.median(n):6.3f}")
        print(f"  conformal - arc-length: {np.mean(c - a):+.4f} +/- {np.std(c - a):.4f} "
              f"over {len(c)} triples, ahead in {int((c > a).sum())}")
        print(f"  conformal - no-growth:  {np.mean(c - n):+.4f}, ahead in {int((c > n).sum())}")
    return failures


if __name__ == "__main__":
    raise SystemExit(0 if _self_test() == 0 else 1)
