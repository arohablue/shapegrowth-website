#!/usr/bin/env python3
"""
────────────────────────────────────────────────────────────────────────────
fused.ply → fused-clean.ply → meshed-rebuilt.ply
────────────────────────────────────────────────────────────────────────────
Rebuilds the reconstructed surface from the COLMAP fused point cloud.

    ~/.cache/phenotyping-mesh-venv/bin/python scripts/rebuild-mesh.py

WHY THIS EXISTS
───────────────
The two Poisson meshes that shipped with the reconstruction are empty. Both
`meshed-poisson.ply` and `meshed-poisson-simplified.ply` hold ~2% of a
plausible canopy area: 150 disconnected components, the largest a
0.114 x 0.128 x 0.088 blob with 92% of the vertices, and 93% of all vertices
inside the single y band 0.83-0.96 — in BOTH files, so the loss happened in
Poisson, not in MeshLab's decimation. `fused.ply` itself is a complete, clean
sunflower with unit-length oriented normals, so the input was never the problem.

The most likely cause is the density trim: `meshed-poisson.ply` still carries
`property float value`, which is Poisson's per-vertex density/confidence field.
Trimming on it at too high a threshold keeps only the densest region of the
surface — which is exactly the blob that survived. This script therefore trims
at a LOW quantile and reports what each stage cost, so the failure mode cannot
recur silently.

THE MATTE BLEED, AND WHY IT IS REMOVED BEFORE POISSON
─────────────────────────────────────────────────────
The source photographs are a segmented plant composited onto a PURE WHITE
background. Patch-based MVS windows that straddle the silhouette average leaf
against that matte, so COLMAP emits a bright, hueless fringe just outside every
true leaf and stem edge. 91,922 of `fused.ply`'s 560,012 points — 16.4% — are
that fringe.

Four measurements identify it, and all four had to agree before anything was
deleted, because eroding a real leaf margin and removing a matte artefact look
identical in a screenshot:

  * Rendering the class as an overlay draws a continuous rim around every leaf
    and every stem edge, with clean green interiors. That is the picture the
    other three numbers are explaining.
  * The class reaches 0.020 further from the stem axis than coloured points in
    81% of (height x azimuth) cells — consistently outboard, not scattered.
  * It sits 0.0084 from the nearest coloured point against a local spacing of
    0.0040 — adjacent to the surface, not embedded in it.
  * Its luminance is 0.670 with p10 0.625 and p90 0.721. A tight band, which is
    one backdrop colour bleeding in. A specular highlight distribution is broad
    and clips at 1.0.

A normal-direction test says 92% of the class is COPLANAR with the surface,
which reads at first like proof it IS the surface. It is not: a bleed point's
depth comes from a patch centred near the edge, so it lands on the leaf plane
but laterally beyond the leaf. The offset is in-plane, which is exactly what
the radial measurement above picks up and the normal test is blind to.

Removing it is removal of misattributed background, not invention. It also
matters past appearance: the fringe fattens every blade by ~0.02 units, about
5 mm on an 82 cm plant, so leaf width and leaf area computed from this surface
would read systematically wide.

WHAT THE THRESHOLD COSTS
────────────────────────
It is a threshold on colour, so it also catches genuinely pale plant material —
the midribs and the stem are near-white in the photographs. Measured: the stem
column retains 84.9% of its points and the flower head 81%, the median
nearest-neighbour spacing of the retained cloud is unchanged (0.00092 ->
0.00094), and only 0.03% of retained points see their neighbour gap open past
0.004. So the pale interiors are thinned, not holed, and Poisson still has a
dense surface to fit. A rendering of the retained cloud is a complete plant.

This is tuned to THIS specimen: a plant with no white organs, shot on a white
matte. A white flower, or a scan with a real textured background, needs this
re-derived rather than re-used. It is not a general cleanup and must not be
described as one.

The cleaned cloud is written out so that `build-reconstruction-assets.mjs`
consumes the same point set rather than re-implementing the threshold in
JavaScript. The cloud and the mesh cross-fade into one another on screen; if
one were filtered and the other not, the fringe would appear at the moment of
the dissolve.

WHY 36,000 TRIANGLES
────────────────────
Not a round number picked for feel. Three constraints meet there.

`WIREFRAME_CONFIG.maxEdges` in `src/scene/pointCloudConfig.ts` is 60,000, and
`buildWireframe` in `src/assets/topology.ts` STRIDES the edge list when the mesh
exceeds it — drawing every second edge. A strided wireframe of a dense mesh
looks worse than a complete wireframe of a lighter one, because the dropped
edges are dropped by index order rather than by geometry, so the lattice breaks
up unevenly. Measured unique edge counts:

    18,000 tris ->  27,579 edges     36,000 tris ->  54,817 edges   <- complete
    30,000 tris ->  45,744 edges     45,000 tris ->  68,418 edges   <- strided

36,000 is the largest budget whose wireframe still draws in full. It also keeps
the vertex count at 18,162, under the 65,536 ceiling for uint16 indices, and
holds 93.7% of the full-resolution surface area — past roughly 45,000 the area
curve flattens and extra triangles buy payload, not detail.

VALIDATION
──────────
Every stage prints the four measurements that caught the original failure:
total surface area, largest triangle, connected-component count, and the
bounding box. A run that ends with ~2% of the expected area is a failed run
even if it exits 0.
"""
import sys
from pathlib import Path

import numpy as np
import open3d as o3d

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "colmap-sunflower" / "fused.ply"
CLEAN = ROOT / "data" / "colmap-sunflower" / "fused-clean.ply"
OUT = ROOT / "data" / "colmap-sunflower" / "meshed-rebuilt.ply"

BLEED_SAT = 0.15         # below this a point carries no hue at all.
BLEED_LUM = 0.55         # above this it is brighter than any leaf on this plant.
DEPTH = 9               # octree depth. extent/1024 ~ 0.9 mm cells on this plant.
DENSITY_QUANTILE = 0.04  # trim only the least-supported 4% of vertices.
TARGET_TRIS = 36000      # see WHY 36,000 below.
MIN_CLUSTER_TRIS = 60    # drop speckle islands, keep real detached leaf tips.


def report(label, mesh):
    """The four checks that exposed the broken input."""
    v = np.asarray(mesh.vertices)
    t = np.asarray(mesh.triangles)
    if len(t) == 0:
        print(f"  {label}: EMPTY")
        return 0.0
    a = v[t[:, 0]]
    b = v[t[:, 1]]
    c = v[t[:, 2]]
    areas = 0.5 * np.linalg.norm(np.cross(b - a, c - a), axis=1)
    lo, hi = v.min(axis=0), v.max(axis=0)
    labels = np.asarray(mesh.cluster_connected_triangles()[0])
    n_clusters = labels.max() + 1 if len(labels) else 0
    print(
        f"  {label}: {len(v):,} verts  {len(t):,} tris  "
        f"area {areas.sum():.4f}  max tri {areas.max():.2e}  "
        f"{n_clusters} components"
    )
    print(
        f"      bbox [{lo[0]:.3f} {lo[1]:.3f} {lo[2]:.3f}] "
        f"-> [{hi[0]:.3f} {hi[1]:.3f} {hi[2]:.3f}]"
    )
    return areas.sum()


pcd = o3d.io.read_point_cloud(str(SRC))
pts = np.asarray(pcd.points)
lo, hi = pts.min(axis=0), pts.max(axis=0)
print(f"{SRC.relative_to(ROOT)}")
print(f"  {len(pts):,} points  normals {pcd.has_normals()}  colours {pcd.has_colors()}")
print(f"  bbox [{lo[0]:.3f} {lo[1]:.3f} {lo[2]:.3f}] -> [{hi[0]:.3f} {hi[1]:.3f} {hi[2]:.3f}]")

if not pcd.has_normals():
    sys.exit("fused.ply has no normals; Poisson needs oriented normals.")
if not pcd.has_colors():
    sys.exit("fused.ply has no colours; the matte-bleed filter needs them.")

# Matte bleed — see the block above. Removed BEFORE Poisson so the solver never
# fits a surface to it; trimming afterwards would leave the fattened silhouette
# baked into the triangulation.
col = np.asarray(pcd.colors)
mxc, mnc = col.max(axis=1), col.min(axis=1)
sat = np.where(mxc > 1e-6, (mxc - mnc) / np.maximum(mxc, 1e-6), 0.0)
lum = col @ (0.2126, 0.7152, 0.0722)
bleed = (sat < BLEED_SAT) & (lum > BLEED_LUM)
print(f"\nmatte bleed  sat<{BLEED_SAT} and luminance>{BLEED_LUM}")
print(f"  removing {bleed.sum():,} of {len(pts):,} points ({100 * bleed.mean():.1f}%)")
if bleed.mean() > 0.35:
    sys.exit(
        f"filter claims {100 * bleed.mean():.0f}% of the cloud — that is a specimen or a "
        "backdrop this threshold was not derived for. Re-derive it before trusting the output."
    )
pcd = pcd.select_by_index(np.flatnonzero(~bleed))
pts = np.asarray(pcd.points)
lo, hi = pts.min(axis=0), pts.max(axis=0)
print(f"  {len(pts):,} points retained")
print(f"  bbox [{lo[0]:.3f} {lo[1]:.3f} {lo[2]:.3f}] -> [{hi[0]:.3f} {hi[1]:.3f} {hi[2]:.3f}]")
o3d.io.write_point_cloud(str(CLEAN), pcd, write_ascii=False)
print(f"  {CLEAN.relative_to(ROOT)}  {CLEAN.stat().st_size / 1e6:.2f} MB")

# Screened Poisson on the existing COLMAP normals. `linear_fit` keeps the
# isosurface closer to the samples on sparse regions like leaf edges.
#
# n_threads=1 IS LOAD-BEARING. At the default -1 the bundled PoissonRecon
# aborts the process with "Failed to close loop" during isosurface extraction —
# reproducibly at depths 9 and 10 on this cloud, at a different edge each run,
# which is the signature of a race rather than bad input. The cloud was checked
# first and is clean: no duplicate points, no non-finite coordinates, all
# normals unit length. Single-threaded, every depth 8-10 completes. Meshing
# takes under a minute offline, so the lost parallelism costs nothing.
print(f"\nscreened Poisson  depth={DEPTH}  single-threaded")
mesh, densities = o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(
    pcd, depth=DEPTH, linear_fit=True, n_threads=1
)
densities = np.asarray(densities)
report("raw", mesh)

# THE STEP THAT BROKE THE ORIGINAL. Poisson closes the surface by extrapolating
# into empty space; those vertices get low density and are the ones worth
# removing. Cutting at a HIGH threshold instead keeps only the densest core,
# which is how a whole sunflower became a 0.11-unit blob.
cut = np.quantile(densities, DENSITY_QUANTILE)
print(
    f"\ndensity trim  quantile {DENSITY_QUANTILE} -> {cut:.3f}  "
    f"(range {densities.min():.3f}..{densities.max():.3f})"
)
mesh.remove_vertices_by_mask(densities < cut)
report("trimmed", mesh)

# Speckle removal. Keeping a triangle-count floor rather than "largest cluster
# only" preserves genuinely detached geometry — a leaf tip that Poisson did not
# bridge back to the stem is still part of the plant.
labels, counts, _ = mesh.cluster_connected_triangles()
labels = np.asarray(labels)
counts = np.asarray(counts)
mesh.remove_triangles_by_mask(counts[labels] < MIN_CLUSTER_TRIS)
mesh.remove_unreferenced_vertices()
print(f"\nspeckle removal  drop components under {MIN_CLUSTER_TRIS} tris")
area_full = report("cleaned", mesh)

print(f"\nquadric decimation  -> {TARGET_TRIS:,} tris")
mesh = mesh.simplify_quadric_decimation(target_number_of_triangles=TARGET_TRIS)
mesh.remove_degenerate_triangles()
mesh.remove_duplicated_vertices()
mesh.remove_duplicated_triangles()
mesh.remove_unreferenced_vertices()
area_simple = report("simplified", mesh)

# A decimation that loses real area is a decimation that deleted surface, not
# one that merged coplanar triangles.
drift = abs(area_simple - area_full) / area_full
print(f"      area retained {100 * area_simple / area_full:.1f}%")
if drift > 0.08:
    sys.exit(f"decimation changed surface area by {100 * drift:.1f}% — too lossy")

mesh.compute_vertex_normals()
o3d.io.write_triangle_mesh(str(OUT), mesh, write_ascii=False)
print(f"\n{OUT.relative_to(ROOT)}  {OUT.stat().st_size / 1e6:.2f} MB")
