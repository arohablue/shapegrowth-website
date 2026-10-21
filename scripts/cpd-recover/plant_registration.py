#!/usr/bin/env python3
"""
Reimplementation of the NonRigidCPD / cpd_rigid interface that plant_growth.py
imports. The original plant_registration.py is not on this machine.

Coherent Point Drift, Myronenko & Song 2010. Notation follows the paper:
    X  (N, D)  data points        -- the FIXED set, day t+1
    Y  (M, D)  GMM centroids      -- the MOVING set, day t
    T(Y) = Y + G W

This is a reimplementation and must be treated as one until it reproduces the
published arrays. See validate.py.
"""
import numpy as np


def _sqdist(A, B):
    """(len(A), len(B)) matrix of squared euclidean distances."""
    return (
        (A * A).sum(1)[:, None]
        + (B * B).sum(1)[None, :]
        - 2.0 * (A @ B.T)
    )


def gaussian_kernel(Y, beta):
    return np.exp(-_sqdist(Y, Y) / (2.0 * beta * beta))


class NonRigidCPD:
    def __init__(self, beta=1.2, lam=30.0, w=0.2, max_iter=100, tol=1e-6, verbose=False):
        self.beta = float(beta)
        self.lam = float(lam)
        self.w = float(w)
        self.max_iter = int(max_iter)
        self.tol = float(tol)
        self.verbose = verbose

    def fit(self, X, Y):
        X = np.asarray(X, dtype=np.float64)
        Y = np.asarray(Y, dtype=np.float64)
        N, D = X.shape
        M = Y.shape[0]

        self.X, self.Y, self.N, self.M, self.D = X, Y, N, M, D
        self.G = gaussian_kernel(Y, self.beta)
        self.W = np.zeros((M, D))

        # sigma^2 init: mean squared distance over all (n, m) pairs.
        self.sigma2 = _sqdist(X, Y).sum() / (D * N * M)

        T = Y.copy()
        outlier = (self.w / (1.0 - self.w)) * (M / N)

        for it in range(self.max_iter):
            # ---- E step -------------------------------------------------
            d2 = _sqdist(T, X)                      # (M, N)
            P = np.exp(-d2 / (2.0 * self.sigma2))
            den = P.sum(0)[None, :] + outlier * (2.0 * np.pi * self.sigma2) ** (D / 2.0)
            den[den == 0] = np.finfo(float).eps
            P = P / den

            P1 = P.sum(1)                            # (M,)
            Pt1 = P.sum(0)                           # (N,)
            PX = P @ X                               # (M, D)
            Np = P1.sum()

            # ---- M step -------------------------------------------------
            A = self.G * P1[:, None] + self.lam * self.sigma2 * np.eye(M)
            B = PX - P1[:, None] * Y
            self.W = np.linalg.solve(A, B)
            T = Y + self.G @ self.W

            sigma2_prev = self.sigma2
            self.sigma2 = (
                (Pt1 * (X * X).sum(1)).sum()
                - 2.0 * (PX * T).sum()
                + (P1 * (T * T).sum(1)).sum()
            ) / (Np * D)
            if self.sigma2 <= 0:
                self.sigma2 = self.tol

            if self.verbose:
                print(f"    iter {it:3d}  sigma2 {self.sigma2:.10g}")
            if abs(self.sigma2 - sigma2_prev) < self.tol:
                break

        self.T = T
        self.n_iter = it + 1
        return self

    def transform(self, q=None):
        """Warped Y, or the map applied at arbitrary points q."""
        if q is None:
            return self.T
        q = np.asarray(q, dtype=np.float64)
        Gq = np.exp(-_sqdist(q, self.Y) / (2.0 * self.beta * self.beta))
        return q + Gq @ self.W

    def jacobian(self, q=None):
        """(len(q), D, D) Jacobian of x -> x + u(x), at the source points by default.

        T(y) = y + sum_m G(y, y_m) W[m]
        dT_i/dy_j = delta_ij + sum_m W[m, i] * dG(y, y_m)/dy_j
        dG/dy_j   = -(y_j - y_m_j) / beta^2 * G(y, y_m)
        """
        if q is None:
            q, G = self.Y, self.G
        else:
            q = np.asarray(q, dtype=np.float64)
            G = np.exp(-_sqdist(q, self.Y) / (2.0 * self.beta * self.beta))

        b2 = self.beta * self.beta
        # diff[n, m, j] = q[n, j] - Y[m, j]
        diff = q[:, None, :] - self.Y[None, :, :]
        # dG[n, m, j]
        dG = -(diff / b2) * G[:, :, None]
        # J[n, i, j] = delta_ij + sum_m W[m, i] * dG[n, m, j]
        J = np.einsum('mi,nmj->nij', self.W, dG)
        J += np.eye(self.D)[None, :, :]
        return J


def cpd_rigid(X, Y, w=0.2, with_scale=False, max_iter=100, tol=1e-6, floor=1e-8):
    """Rigid CPD. Returns dict with R, t, s. Y -> Y @ R.T + t (* s).

    tol and floor are two independent constants, recovered separately:

    tol=1e-6 is the convergence break, and is the same value NonRigidCPD uses.
    It is pinned by three specimens that each stop on it at a different
    iteration -- M05 at 19, M04 at 61, T02 at 15 (a transient dip; |dsigma2|
    rises again at 16). All three reproduce the published arrays to <=3e-13.

    floor=1e-8 is what sigma2 is reset to when it goes non-positive. It is NOT
    the same constant as tol, though writing `sigma2 = tol` is the obvious way
    to code it and was what I had first. Only M06 ever reaches the floor -- its
    sigma2 collapses rather than converging, so it runs to max_iter -- which
    means M06 alone pins this value. Treat it as a one-specimen determination:
    it is exact for the fold case it was fitted on and untested elsewhere.
    Specimens that converge normally never touch it.
    """
    X = np.asarray(X, dtype=np.float64)
    Y = np.asarray(Y, dtype=np.float64)
    N, D = X.shape
    M = Y.shape[0]

    R = np.eye(D)
    t = np.zeros(D)
    s = 1.0
    sigma2 = _sqdist(X, Y).sum() / (D * N * M)
    outlier = (w / (1.0 - w)) * (M / N)

    for _ in range(max_iter):
        T = s * (Y @ R.T) + t
        d2 = _sqdist(T, X)
        P = np.exp(-d2 / (2.0 * sigma2))
        den = P.sum(0)[None, :] + outlier * (2.0 * np.pi * sigma2) ** (D / 2.0)
        den[den == 0] = np.finfo(float).eps
        P = P / den

        P1 = P.sum(1)
        Pt1 = P.sum(0)
        Np = P1.sum()

        muX = (X * Pt1[:, None]).sum(0) / Np
        muY = (Y * P1[:, None]).sum(0) / Np
        Xc = X - muX
        Yc = Y - muY

        A = Xc.T @ P.T @ Yc
        U, S, Vt = np.linalg.svd(A)
        C = np.eye(D)
        C[-1, -1] = np.linalg.det(U @ Vt)
        R = U @ C @ Vt

        YPY = (P1 * (Yc * Yc).sum(1)).sum()
        if with_scale:
            s = np.trace(np.diag(S) @ C) / YPY
        else:
            s = 1.0
        t = muX - s * (R @ muY)

        sigma2_prev = sigma2
        XPX = (Pt1 * (Xc * Xc).sum(1)).sum()
        sigma2 = (XPX - s * np.trace(np.diag(S) @ C)) / (Np * D)
        if sigma2 <= 0:
            sigma2 = floor
            cpd_rigid.floor_hits += 1
        if abs(sigma2 - sigma2_prev) < tol:
            break

    return dict(R=R, t=t, s=s)


# Counts how often the sigma2 floor was applied. The floor is a one-specimen
# determination (see cpd_rigid's docstring), so any NEW specimen that touches it
# is relying on an untested constant and must not be published silently.
cpd_rigid.floor_hits = 0


def save_displacement_ply(path, pts, disp):
    """Not needed for recovery; kept so the import in plant_growth.py resolves."""
    return None
