"""AB-aligned (u, v) coordinate frame: project geometries into and out of trial-local space.

Coordinate convention
---------------------
Origin  : midpoint of AB line (in UTM metres)
u-axis  : direction from B → A (roughly east for a west-running AB line)
          positive u = east of midpoint
v-axis  : 90° clockwise rotation of the A→B direction vector (roughly north)
          positive v = north of AB line (the working side for strip trials)

Units: all public coordinates in **feet**; internal UTM calculations in metres.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Tuple

import numpy as np

from trialfield_core.geometry.crs import utm_epsg, utm_to_wgs84, wgs84_to_utm

FT_PER_M = 3.280839895


@dataclass(frozen=True)
class UVFrame:
    """Immutable AB-aligned coordinate frame."""

    # UTM origin (midpoint of AB), metres
    origin_e: float  # easting
    origin_n: float  # northing
    # u-axis unit vector in UTM (east component, north component)
    u_hat_e: float
    u_hat_n: float
    # v-axis unit vector in UTM (east component, north component)
    v_hat_e: float
    v_hat_n: float
    # UTM EPSG used
    epsg: int
    # AB bearing (degrees, CW from north)
    bearing_deg: float
    # AB length in feet
    ab_length_ft: float

    # ------------------------------------------------------------------
    # Factory
    # ------------------------------------------------------------------

    @classmethod
    def from_ab_wgs84(
        cls,
        a_lon: float,
        a_lat: float,
        b_lon: float,
        b_lat: float,
    ) -> "UVFrame":
        """Build a UVFrame from WGS84 A and B points."""
        mid_lon = (a_lon + b_lon) / 2.0
        mid_lat = (a_lat + b_lat) / 2.0
        epsg = utm_epsg(mid_lon, mid_lat)
        to_utm = wgs84_to_utm(epsg)

        a_e, a_n = to_utm.transform(a_lon, a_lat)
        b_e, b_n = to_utm.transform(b_lon, b_lat)
        origin_e = (a_e + b_e) / 2.0
        origin_n = (a_n + b_n) / 2.0

        # d_ab: unit vector from A to B
        ab_e = b_e - a_e
        ab_n = b_n - a_n
        ab_len_m = math.hypot(ab_e, ab_n)
        d_ab_e = ab_e / ab_len_m
        d_ab_n = ab_n / ab_len_m

        # u-axis = d_BA = -d_ab  (positive east)
        u_hat_e = -d_ab_e
        u_hat_n = -d_ab_n

        # v-axis = CW 90° rotation of d_ab = (d_ab_n, -d_ab_e)  (positive north)
        v_hat_e = d_ab_n
        v_hat_n = -d_ab_e

        bearing_deg = math.degrees(math.atan2(ab_e, ab_n)) % 360.0
        ab_length_ft = ab_len_m * FT_PER_M

        return cls(
            origin_e=origin_e,
            origin_n=origin_n,
            u_hat_e=u_hat_e,
            u_hat_n=u_hat_n,
            v_hat_e=v_hat_e,
            v_hat_n=v_hat_n,
            epsg=epsg,
            bearing_deg=bearing_deg,
            ab_length_ft=ab_length_ft,
        )

    # ------------------------------------------------------------------
    # Transforms
    # ------------------------------------------------------------------

    def wgs84_to_uv(self, lon: float, lat: float) -> Tuple[float, float]:
        """Convert WGS84 (lon, lat) to (u_ft, v_ft) in trial-local frame."""
        to_utm = wgs84_to_utm(self.epsg)
        e, n = to_utm.transform(lon, lat)
        de = e - self.origin_e
        dn = n - self.origin_n
        u_m = de * self.u_hat_e + dn * self.u_hat_n
        v_m = de * self.v_hat_e + dn * self.v_hat_n
        return u_m * FT_PER_M, v_m * FT_PER_M

    def uv_to_wgs84(self, u_ft: float, v_ft: float) -> Tuple[float, float]:
        """Convert (u_ft, v_ft) to WGS84 (lon, lat)."""
        u_m = u_ft / FT_PER_M
        v_m = v_ft / FT_PER_M
        e = self.origin_e + u_m * self.u_hat_e + v_m * self.v_hat_e
        n = self.origin_n + u_m * self.u_hat_n + v_m * self.v_hat_n
        from_utm = utm_to_wgs84(self.epsg)
        lon, lat = from_utm.transform(e, n)
        return lon, lat

    def polygon_to_uv(
        self, coords_wgs84: list[Tuple[float, float]]
    ) -> list[Tuple[float, float]]:
        """Convert a list of (lon, lat) polygon vertices to (u_ft, v_ft)."""
        return [self.wgs84_to_uv(lon, lat) for lon, lat in coords_wgs84]

    def polygon_to_wgs84(
        self, coords_uv: list[Tuple[float, float]]
    ) -> list[Tuple[float, float]]:
        """Convert a list of (u_ft, v_ft) vertices to (lon, lat) WGS84."""
        return [self.uv_to_wgs84(u, v) for u, v in coords_uv]
