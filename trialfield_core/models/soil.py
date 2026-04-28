"""Pydantic models for MajoritySoilZone and SSURGOComponent."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class SSURGOComponent(BaseModel):
    """A single SSURGO map-unit component."""

    mukey: str
    compname: str
    comppct_r: float
    hydgrp: Optional[str] = None
    taxorder: Optional[str] = None


class MajoritySoilZone(BaseModel):
    """Dominant soil for a plot block, derived from SDA query."""

    wkt: str  # WKT of the zone polygon
    components: list[SSURGOComponent]
    source: str = "SDA"  # "SDA" | "user_shapefile" | "unavailable"
    note: Optional[str] = None  # populated when source == "unavailable"
