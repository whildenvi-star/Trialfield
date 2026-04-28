"""Pydantic request/response schemas for the Trialfield API."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

from trialfield_core.models.trial_design import TrialType


class TreatmentIn(BaseModel):
    label: str
    value: Optional[float] = None  # None → categorical
    unit: str = ""


class DesignSource(BaseModel):
    """Trial design specification — either structured treatments or a prose description."""

    name: str = "Untitled Trial"
    trial_type: TrialType = TrialType.fertility
    treatments: Optional[list[TreatmentIn]] = None
    reps: int = Field(default=4, ge=2, le=8)
    plot_length_ft: Optional[float] = Field(default=None, gt=0.0)
    # When set, the core's LLM parser derives treatments; takes precedence over treatments list.
    prose: Optional[str] = None

    @model_validator(mode="after")
    def _require_source(self) -> "DesignSource":
        if self.treatments is None and self.prose is None:
            raise ValueError("provide either 'treatments' (list) or 'prose' (string)")
        if self.treatments is not None and len(self.treatments) < 2:
            raise ValueError("treatments must have at least 2 entries")
        return self


class GeometryIn(BaseModel):
    """AB line + field geometry inputs expressed as WGS84 coordinates."""

    a_lon: float
    a_lat: float
    b_lon: float
    b_lat: float
    trial_swath_ft: float = Field(gt=0.0)
    combine_ft: Optional[float] = Field(default=None, gt=0.0)
    # GeoJSON Polygon or MultiPolygon geometry object (no Feature wrapper needed).
    field_boundary_geojson: Optional[dict] = None


class DesignRequest(BaseModel):
    design: DesignSource
    geometry: GeometryIn
    soil_mode: Literal["auto", "skip"] = "skip"
    seed: int = 42
