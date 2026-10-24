"""
Growth fields from non-rigid Coherent Point Drift.

Registers a plant's day-t point cloud onto its day-t+1 cloud, and reports the
displacement field and the local volume change (det J) that the fitted map
implies.

    python -m pipeline demo          synthetic plant, no dataset needed
    python -m pipeline register      a real pair of scans
    python -m pipeline validate      check this code against archived results
    python -m pipeline export        write viewer assets

See README.md to run it and METHOD.md for the mathematics.
"""
from .growth import (
    chamfer,
    days_between,
    find_scans,
    label_check,
    load_scan,
    preprocess,
    register_growth,
    subsample_uniform,
)
from .ply import save_displacement_ply
from .registration import NonRigidCPD, cpd_rigid, gaussian_kernel

__all__ = [
    "NonRigidCPD",
    "cpd_rigid",
    "gaussian_kernel",
    "chamfer",
    "days_between",
    "find_scans",
    "label_check",
    "load_scan",
    "preprocess",
    "register_growth",
    "subsample_uniform",
    "save_displacement_ply",
]

# The parameters every shipped specimen was fitted with. Transcribed from
# docs/plant_growth_slides.pdf. Changing them here changes what new runs do; it
# does not change the archived results, which were produced with these.
PARAMETERS = {
    "beta": 1.2,
    "lam": 30.0,
    "w": 0.2,
    "n_points": 3000,
    "rigid_prealignment": True,
    "soil_label": 0,
    "shared_centre_and_scale": True,
}

# No calibration exists. Pheno4D documents its files only as x, y, z and a
# label, and never states a physical unit. Probably millimetres -- the scanner
# is a Perceptron ScanWorks V5 on a ROMER Infinite 2.0 arm, which reports in mm,
# and the plants then stand 26-47 cm. That is an inference, and it is
# deliberately NOT applied: every distance this package reports is in scan
# units. Do not relabel them without a calibration to point at.
UNITS = "scan units"
