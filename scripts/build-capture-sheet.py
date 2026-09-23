#!/usr/bin/env python3
"""
────────────────────────────────────────────────────────────────────────────
SOURCE PHOTOGRAPHS → THE CAPTURE PLATE
────────────────────────────────────────────────────────────────────────────
Builds `public/capture/sunflower-views.jpg`, the one real image behind the
CAPTURE step of offering 01.

    python3 scripts/build-capture-sheet.py

WHY THE SHEET HAS TO BE 16:9 NO MATTER WHAT IS ON IT
────────────────────────────────────────────────────
`.offering__stage-box` caps the shared stage width at

    (78vh - 6rem) * var(--stage-aspect)

and `Offerings.tsx` sets `--stage-aspect` to the NARROWEST ratio among that
offering's plates. The other two plates are 16:9, so a plate narrower than
16:9 does not merely make itself small — it shrinks the point cloud and the
phenotyping figure with it. Everything below is laid out inside that fixed
1.778, and the white left over is a consequence of it.

WHY 3x2 AND NOT 6 ACROSS
────────────────────────
Six across on a 375px viewport gives each frame about 57px of width and the
plant stops being legible; an illegible photograph communicates less about
multi-view capture than a legible one does. Three across, two down, doubles
that to ~114px. The cost is paid in height — two rows of a 16:9 sheet is
540px per row against 1080 for a single row — so the plants here are about
half the height they were when three were shown in one row. That is the
trade, and 3x2 is the better half of it: the grid reads as a SET, which is
the thing the plate is trying to say.

WHICH SIX
─────────
Only eight source frames are staged locally (1, 14, 23, 27, 40, 45, 53, 66),
so the six are chosen from those eight. Their real azimuths, read from
`sparse/1/images.bin` and rotated into scene space, are

    1 -> 7.8°   27 -> 64.0°   23 -> 111.5°
   66 -> 157.8° 14 -> 214.9°  53 -> 305.8°

which is the subset of the eight with the largest minimum angular gap: 46.3°,
with no arc of the circle left unrepresented. The two that are dropped (45 at
37.2°, 40 at 94.3°) each sit within 30° of a neighbour and would have read as
a near-duplicate of it. Laid out in reading order the six increase in azimuth
monotonically, so the sheet is a walk around the plant rather than a pile.

An earlier version of this file claimed 1/23/45 were "120 degrees apart on a
66-frame turntable". They are not — the real gaps are 7.8/111.5/37.2, i.e.
two of the three are 29° apart. The number was inferred from the frame
indices on the assumption of one uniform pass, and the poses say there were
two: frames 1-33 at +2.3° elevation and 34-66 at +21.3°, each a full circle.
That is also why four of the six below are from the low ring and two from the
high one — insisting on three from each would have cut the minimum gap from
46.3° to 30.3°, and the angle around the plant is the point of the plate.

Frames 67-102 are deliberately excluded. They are landscape (3732x2108) and
COLMAP registered exactly 66 of 102 images, which is precisely the portrait
count — the landscape batch did not contribute to the reconstruction, so
showing it as capture input for this model would be untrue.

ONE CROP WINDOW, NOT SIX
────────────────────────
Every frame is cut with the SAME window in source pixels and scaled by the
same factor. It would be easy to detect each plant's bounding box and scale
each one to a common height, and it would be wrong: frames 66 and 53 are from
the high ring, where the plant is foreshortened to ~2700px against ~3300px on
the low ring. Normalising that away would invent a plant that stayed the same
size while the camera climbed. Identical treatment is what makes six frames a
dataset; the differences that survive it are the data.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "colmap-sunflower" / "images"
OUT = ROOT / "public" / "capture" / "sunflower-views.jpg"

# Reading order = increasing azimuth. See WHICH SIX.
FRAMES = [1, 27, 23, 66, 14, 53]
COLS, ROWS = 3, 2

WIDTH, HEIGHT = 1920, 1080          # 16:9 to the pixel
QUALITY = 84

# The common crop window, in source pixels, applied to every frame. Full
# width, because the subject spans x[8..2056] of 2138 across the six and
# trimming to the union would save nothing. The top is cut at 400 because the
# highest subject pixel in any of the six is at y=464: everything above that
# is white in ALL of them, so removing it is the one crop that cannot lose
# plant. The bottom is the frame edge, where the pot stands.
CROP_TOP = 400

# Air around the grid, as a fraction of the cell. Vertical is nearly all the
# budget there is at this aspect, so it is small; horizontal is whatever the
# portrait frames leave over, distributed evenly rather than banked into the
# margins, so the six sit on an even field instead of in a tight block adrift
# in a white plate.
PAD_Y = 28

sheet = Image.new("RGB", (WIDTH, HEIGHT), (255, 255, 255))

probe = Image.open(SRC / f"{FRAMES[0]}.jpg")
crop_w, crop_h = probe.width, probe.height - CROP_TOP
cell_aspect = crop_w / crop_h

cell_h = (HEIGHT - PAD_Y * (ROWS + 1)) // ROWS
cell_w = int(round(cell_h * cell_aspect))

# Equal air left, right and between columns.
gap_x = (WIDTH - cell_w * COLS) / (COLS + 1)

for i, n in enumerate(FRAMES):
    im = Image.open(SRC / f"{n}.jpg").convert("RGB")
    frame = im.crop((0, CROP_TOP, im.width, im.height))
    frame = frame.resize((cell_w, cell_h), Image.LANCZOS)

    col, row = i % COLS, i // COLS
    x = int(round(gap_x * (col + 1) + cell_w * col))
    y = PAD_Y * (row + 1) + cell_h * row
    sheet.paste(frame, (x, y))

OUT.parent.mkdir(parents=True, exist_ok=True)
sheet.save(OUT, "JPEG", quality=QUALITY, optimize=True, progressive=True)

size = OUT.stat().st_size
print(f"{OUT.relative_to(ROOT)}")
print(f"  {WIDTH}x{HEIGHT}  aspect {WIDTH/HEIGHT:.4f}")
print(f"  {COLS}x{ROWS} cells of {cell_w}x{cell_h} (aspect {cell_aspect:.3f})")
print(f"  gaps  x {gap_x:.0f}  y {PAD_Y}")
print(f"  frames {FRAMES} of 66 registered")
print(f"  {size/1e3:.0f} kB")
