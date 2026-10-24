#!/usr/bin/env python3
"""
Writing the displacement field out as PLY, for opening in MeshLab / CloudCompare.

WHY THIS FILE EXISTS AT ALL
---------------------------
In the source this package was assembled from, `save_displacement_ply` was a
stub:

    def save_displacement_ply(path, pts, disp):
        \"\"\"Not needed for recovery; kept so the import resolves.\"\"\"
        return None

and `growth.py` called it expecting a file on disk. The pipeline therefore ran
to completion, printed no error, and wrote no PLY. A silent no-op behind a name
that promises a file is worse than a missing function, because nothing tells you
it did not happen. It is implemented here rather than deleted because an
external viewer is genuinely the fastest way to inspect a field.
"""
import numpy as np


def save_displacement_ply(path, pts, disp, scale=1.0):
    """One line segment per point, from `pts` to `pts + disp * scale`.

    Vertices are coloured along the segment -- dim at the source point, full
    strength at the tip -- so the field reads directionally in a viewer that has
    no notion of an arrow.

    `scale` exists because a viewer has no slider. It defaults to 1.0 and should
    normally stay there: at 1.0 a tip IS the warped position of that point, which
    is a real estimate. Any other value draws a line to a place nothing is
    claimed to be, so the number is written into the PLY header as a comment
    rather than left to be remembered.
    """
    pts = np.asarray(pts, dtype=np.float64)
    disp = np.asarray(disp, dtype=np.float64)
    if pts.shape != disp.shape:
        raise ValueError(f"pts {pts.shape} and disp {disp.shape} must match")

    tips = pts + disp * scale
    n = len(pts)

    # Interleave base, tip, base, tip, ... so edge i joins 2i and 2i+1.
    verts = np.empty((2 * n, 3), dtype=np.float64)
    verts[0::2] = pts
    verts[1::2] = tips

    mag = np.linalg.norm(disp, axis=1)
    span = mag.max() - mag.min()
    t = (mag - mag.min()) / span if span > 0 else np.zeros(n)

    # Violet, matching the displacement plate: dim at the base, full at the tip.
    base_rgb = np.stack([60 + 80 * t, 40 + 40 * t, 110 + 90 * t], axis=1)
    tip_rgb = np.stack([150 + 90 * t, 90 + 60 * t, 220 + 35 * t], axis=1)
    cols = np.empty((2 * n, 3), dtype=np.uint8)
    cols[0::2] = np.clip(base_rgb, 0, 255).astype(np.uint8)
    cols[1::2] = np.clip(tip_rgb, 0, 255).astype(np.uint8)

    with open(path, "w") as fh:
        fh.write("ply\nformat ascii 1.0\n")
        fh.write("comment displacement field, one edge per source point\n")
        fh.write(f"comment vector scale {scale:g} (1.0 = true estimated displacement)\n")
        fh.write("comment colour runs dim at the source point to full at the tip\n")
        fh.write(f"element vertex {2 * n}\n")
        fh.write("property float x\nproperty float y\nproperty float z\n")
        fh.write("property uchar red\nproperty uchar green\nproperty uchar blue\n")
        fh.write(f"element edge {n}\n")
        fh.write("property int vertex1\nproperty int vertex2\n")
        fh.write("end_header\n")
        for (x, y, z), (r, g, b) in zip(verts, cols):
            fh.write(f"{x:.6f} {y:.6f} {z:.6f} {r} {g} {b}\n")
        for i in range(n):
            fh.write(f"{2 * i} {2 * i + 1}\n")

    return path
