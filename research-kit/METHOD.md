# The method, tied to the code

Non-rigid Coherent Point Drift (Myronenko & Song, *IEEE TPAMI* 32(12), 2010),
as implemented here. Every equation cites the line that computes it. Deck page
references are to `docs/plant_growth_slides.pdf`.

Notation (deck p. 5): `X` (N×D) is the **target**, day t+1, treated as data;
`Y` (M×D) is the **source**, day t, treated as the centroids of a Gaussian
mixture that is deformed until the mixture explains the data. D = 3.

```
T(Y) = Y + G W
```

`G` is the Gaussian kernel Gram matrix, `W` (M×D) the coefficients being
solved for.

## 0. Shared centre and scale — the line the measurement rests on

`pipeline/growth.py:157-160` (deck pp. 4, 13):

```
c = mean of BOTH scans stacked        s = RMS radius of BOTH scans about c
Y = (src − c)/s                       X = (tgt − c)/s
```

One `c` and one `s` over both scans, never per-scan. Normalising each scan to
its own size would make the plant the same size on both days by construction
and divide out exactly the growth being measured. Fitting a similarity scale
inside CPD would do the same thing more slowly — which is also why the rigid
step below runs with `with_scale=False`.

## 1. The mixture model and E-step

Each target point is explained either by one of the M Gaussians (shared
isotropic variance σ², equal weights) or by a uniform outlier component with
total weight `w`. The posterior that centroid m explains data point n
(deck p. 9; `pipeline/registration.py:71-75`):

```
P_mn = exp(−‖x_n − T(y_m)‖² / 2σ²)
       ─────────────────────────────────────────────────────────────
       Σ_k exp(−‖x_n − T(y_k)‖² / 2σ²)  +  (2πσ²)^(D/2) · (w/(1−w)) · M/N
```

The `(2πσ²)^(D/2)` factor is the Gaussian normalisation constant moved into
the outlier term (`registration.py:73`); the `(w/(1−w))·M/N` prefactor is
built once at `registration.py:67`. σ² is initialised to the mean squared
distance over all N·M pairs (`registration.py:64`).

`w = 0.2` is deliberately high: new tissue at t+1 has no counterpart at t and
must be allowed to go unexplained. A low `w` forces the solver to drag day-t
points onto leaves that did not exist yet (`growth.py:22-24`).

## 2. The non-rigid M-step

The deformation is `T(Y) = Y + GW` with the Gaussian kernel
(`registration.py:40-41`):

```
G_ij = exp(−‖y_i − y_j‖² / 2β²)
```

Setting ∂Q/∂W = 0 for the regularised objective (deck p. 10) gives the linear
system solved at `registration.py:83-85`:

```
(diag(P1) G + λσ² I) W = P X − diag(P1) Y        where P1 = P·1
```

`β` sets the width of the kernel — how far a point's motion is correlated with
its neighbours' (coherence). `λ` weighs the regulariser against the data term.
Both larger β and larger λ mean a stiffer field. The update `T = Y + GW` is
`registration.py:86`, and σ² is re-estimated in closed form at
`registration.py:89-93`:

```
σ² = [ Σ_n Pt1_n‖x_n‖² − 2 Σ_mn P_mn x_nᵀT(y_m) + Σ_m P1_m‖T(y_m)‖² ] / (N_P · D)
```

with `N_P = Σ P_mn`. Iteration stops when |Δσ²| < tol = 1e-6
(`registration.py:99`) or at 100 iterations.

The fitted map extends to arbitrary points: `T(q) = q + G(q, Y) W`
(`registration.py:106-112`), which is what `register_growth` exposes as
`field(q)` in world coordinates (`growth.py:172-175`).

## 3. Rigid pre-alignment

`cpd_rigid` (`pipeline/registration.py:138-206`; deck p. 12) runs the same
EM with `T(Y) = s·Y·Rᵀ + t` instead of a kernel. The M-step is the
Kabsch/Umeyama solution on the P-weighted cross-covariance
(`registration.py:184-188`):

```
A = X_cᵀ Pᵀ Y_c          A = U S Vᵀ
C = diag(1, …, 1, det(U Vᵀ))
R = U C Vᵀ               t = μ_x − s·R·μ_y
```

The `det(U Vᵀ)` entry is the reflection correction — without it the SVD can
return an improper rotation that mirrors the plant. **`with_scale=False`
always** (`growth.py:163`): s stays 1, because a fitted scale would absorb the
growth, exactly as a per-scan normalisation would.

Rigid pre-alignment is applied to every specimen (`growth.py:162-167`,
default `rigid=True` at `growth.py:133`). It changes the outcome for exactly
one of the fourteen plants — M06 folds over 90% of its points without it and
is clean with it (deck pp. 21, 24; `docs/summary_default.csv`) — but there is
no way to know in advance which plant is the M06, so all of them get it.

## 4. The Jacobian and det J

For the fitted map φ(y) = y + Σ_m G(y, y_m) W_m, the Jacobian
(`registration.py:114-135`, derivation in the docstring):

```
∂φ_i/∂y_j = δ_ij + Σ_m W[m,i] · ∂G(y, y_m)/∂y_j
∂G/∂y_j   = −((y_j − y_m,j) / β²) · G(y, y_m)
```

assembled with the einsum at `registration.py:133-134` and evaluated at the
source points. `det J = det(∂φ/∂y)` is taken at `growth.py:180`.

Reading it (deck p. 15): a volume element dV at x becomes det J(x)·dV under
the map. det J > 1 is local expansion, 0 < det J < 1 local compression, and
**det J ≤ 0 is a fold** — the map is not invertible there and no expansion or
compression can be read off it. Folds are reported as their own band
everywhere in this package (`export.py` `diagnostics`, the viewer, the PNG)
and never clipped into the compression end of a colour scale.

**Why the normalised-frame det J is also the world-frame det J**
(`growth.py:177-179`): the world map is
x ↦ s·φ(pre((x−c)/s)) + c. The isotropic scale enters once on the way in and
once on the way out, so it cancels in the derivative, and the rigid
pre-rotation contributes det R = +1. The determinant computed in the
normalised frame is therefore the one that holds in scan units.

## 5. Chamfer distance — the only available fit score

`pipeline/growth.py:186-206`:

```
chamfer(A, B) = ½ ( mean_a min_b ‖a−b‖ + mean_b min_a ‖a−b‖ )
```

The two scans share no point identity, so "did point i land on point i" cannot
be asked; whether the two *surfaces* ended up in the same place can. The
symmetric form matters — one direction alone is cheatable by collapsing every
warped point onto one spot of the target. And a good Chamfer does not certify
the vectors: a map sliding every point tangentially along the surface would
score identically to the correct one. This limitation is stated, not solved.

## 6. Subsampling

`pipeline/growth.py:87-111`: voxel-thin to even density first, then random-pick
down to n = 3000. Plain uniform random sampling would be wrong here because
scanner sweep overlap makes raw density very uneven — it would oversample the
overlap bands and the fit would weight those regions accordingly. The voxel
size is searched (12 halving/growing steps) until the thinned count lands near
n. Source and target are thinned with different seeds (0 and 1,
`cli.py:36-40`): one shared seed would correlate the two point sets through
the sampler and flatter the fit.

Soil (label 0) is removed before subsampling (`growth.py:114-127`): it is a
large, flat, unchanging surface, and left in, it dominates the fit.

## 7. Parameters as used

`pipeline/__init__.py:46-54`, transcribed from deck p. 13 and used for every
shipped specimen:

| parameter | value | role |
|---|---|---|
| β | 1.2 | kernel width in normalised units; motion coherence |
| λ | 30.0 | regularisation weight; field stiffness |
| w | 0.2 | outlier weight — deliberately high, new tissue has no counterpart |
| n_points | 3000 | per scan, after soil removal and voxel thinning |
| rigid_prealignment | true | see §3; `--no-rigid` exists to reproduce the M06 fold |
| soil_label | 0 | Pheno4D's ground label |

## 8. The two recovered constants

`registration.py` is a reimplementation; two constants could not be read from
the lost source and were recovered by comparing against the archived outputs
(`registration.py:143-154`):

- `tol = 1e-6` — the convergence break. Pinned by three specimens that each
  stop on it at a different iteration (M05 at 19, M04 at 61, T02 at 15).
- `floor = 1e-8` — what σ² resets to in `cpd_rigid` when it goes non-positive.
  **A one-specimen determination**: only M06 ever reaches it. Any new run that
  touches it gets a loud warning (`cli.py:84-98`) because it is relying on a
  constant tested against exactly one case.

## 9. What validates what

Three distinct checks, three distinct claims:

1. `python -m pipeline validate` (`cli.py:234-271`) — archived **inputs**
   through this code reproduce the archived **outputs** to ≤ 3.3e-12 relative.
   Claim: the reimplementation is faithful.
2. The reproduce-mode export gate (`export.py:163-198`) — statistics
   recomputed from the arrays match `docs/summary.csv` to 1e-9 relative, or
   nothing ships. Claim: the staged assets are the published results.
3. The invariants asserted in both export modes (`export.py:147-160`) —
   `warped − src == displacement` bit-exact in float64 (the definition
   direction, which is why the viewer may derive `warped` as
   `src + displacement`), units stay "scan units", calibration stays null,
   `rate_per_day` is never exported. Claim: the assets cannot quietly say more
   than the method knows.

New-mode exports pass only check 3, and their manifest entries say so:
`validated: false` is a statement about what has *not* been checked, carried
with the data instead of lost in a README.
