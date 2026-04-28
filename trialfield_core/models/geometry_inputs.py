"""Pydantic models for FieldBoundary, ABLine, and ImplementWidths."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field, model_validator


class ABLine(BaseModel):
    """A-B guidance line as two WGS84 points."""

    a_lon: float
    a_lat: float
    b_lon: float
    b_lat: float
    bearing_deg: Optional[float] = None  # filled by io/abline.py if available

    @model_validator(mode="after")
    def _validate_distinct(self) -> "ABLine":
        if abs(self.a_lon - self.b_lon) < 1e-9 and abs(self.a_lat - self.b_lat) < 1e-9:
            raise ValueError("A and B points must be distinct")
        return self


class FieldBoundary(BaseModel):
    """WGS84 polygon(s) defining the field boundary."""

    wkt: str  # WKT of the (possibly Multi-)Polygon

    @classmethod
    def from_shapely(cls, geom: object) -> "FieldBoundary":
        return cls(wkt=geom.wkt)  # type: ignore[attr-defined]


class ImplementWidths(BaseModel):
    """Implement width settings for the trial."""

    trial_swath_ft: float = Field(gt=0.0)
    combine_ft: Optional[float] = Field(default=None, gt=0.0)
