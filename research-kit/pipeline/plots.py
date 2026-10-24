#!/usr/bin/env python3
"""
The four-panel diagnostic figure. matplotlib is imported inside the function so
that the rest of the pipeline runs without it installed.

The four panels answer four different questions, in order:

  1. How far apart are the two scans?      (day t over day t+1, raw)
  2. Did the registration close that gap?  (warped day t over day t+1)
  3. Where did things move, and how far?   (the displacement field)
  4. Where did tissue expand or compress?  (det J)

Panel 2 is the one to look at first. If the blue does not land on the red there,
nothing in panels 3 and 4 means anything -- they describe a map that did not fit.
"""
import numpy as np


def plot_growth(res, days, title, out_png, up_axis=2, quiver_every=6):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    src, tgt = res["src"], res["tgt"]
    warped, disp, dJ = res["warped"], res["displacement"], res["detJ"]
    mag = np.linalg.norm(disp, axis=1)

    # One frame over BOTH scans, so the panels are comparable to each other and
    # the plant is not re-centred between them.
    allp = np.vstack([src, tgt])
    ctr, rad = allp.mean(0), np.ptp(allp, axis=0).max() / 2

    def style(ax, t):
        ax.set_title(t, fontsize=11)
        for setlim, k in zip((ax.set_xlim, ax.set_ylim, ax.set_zlim), range(3)):
            setlim(ctr[k] - rad, ctr[k] + rad)
        ax.set_box_aspect((1, 1, 1))
        ax.view_init(elev=12, azim=-60)
        ax.set_xticks([]); ax.set_yticks([]); ax.set_zticks([])

    fig = plt.figure(figsize=(25, 6))

    ax = fig.add_subplot(141, projection="3d")
    ax.scatter(*src.T, s=1.2, c="tab:blue", label="day t")
    ax.scatter(*tgt.T, s=1.2, c="tab:red", alpha=0.45, label="day t+1")
    ax.legend(markerscale=6, loc="upper left")
    style(ax, "Day t vs day t+1")

    ax = fig.add_subplot(142, projection="3d")
    ax.scatter(*warped.T, s=1.2, c="tab:blue", label="day t, warped")
    ax.scatter(*tgt.T, s=1.2, c="tab:red", alpha=0.45, label="day t+1")
    ax.legend(markerscale=6, loc="upper left")
    style(ax, "After registration")

    ax = fig.add_subplot(143, projection="3d")
    cmap = matplotlib.colormaps["turbo"]
    nm = matplotlib.colors.Normalize(vmin=mag.min(), vmax=mag.max())
    sc = ax.scatter(*src.T, s=1.5, c=mag, cmap="turbo", norm=nm, alpha=0.35)
    i = np.arange(0, len(src), quiver_every)
    ax.quiver(*src[i].T, *disp[i].T, length=1.0, normalize=False, linewidth=0.7,
              arrow_length_ratio=0.25, colors=cmap(nm(mag[i])))
    fig.colorbar(sc, ax=ax, shrink=0.6, pad=0.05, label="|displacement| (scan units)")
    style(ax, "Displacement field")

    # det J on a log scale centred on 1, so expansion by 2x and compression to
    # 1/2 are the same distance from the middle. Linear colour would make
    # compression look like a narrow band next to a wide expansion range.
    ax = fig.add_subplot(144, projection="3d")
    pos = np.where(dJ > 0, dJ, 1e-6)        # folds parked out of the colour range
    v = float(np.clip(np.percentile(np.maximum(pos, 1 / pos), 90), 1.5, 4.0))
    norm = matplotlib.colors.LogNorm(vmin=1 / v, vmax=v)
    sc = ax.scatter(*src.T, s=2.5, c=np.clip(pos, 1 / v, v), cmap="coolwarm", norm=norm)
    cb = fig.colorbar(sc, ax=ax, shrink=0.6, pad=0.05,
                      label="det J  (>1 expands, <1 compresses)")
    ticks = [t for t in (0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4) if 1 / v <= t <= v]
    cb.set_ticks(ticks)
    cb.set_ticklabels([f"{t:g}" for t in ticks])

    n_fold = int((dJ <= 0).sum())
    fold_note = f"  --  {n_fold} folded points not shown" if n_fold else ""
    style(ax, f"det of Jacobian (colour clipped to [{1 / v:.2f}, {v:.1f}]){fold_note}")

    fig.suptitle(title, fontsize=13)
    fig.tight_layout()
    fig.savefig(out_png, dpi=130)
    plt.close(fig)
    return out_png
