"""Pydantic models for TrialDesign, Treatment, and RepLayout."""

from __future__ import annotations

from enum import Enum
from typing import Annotated, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class TrialType(str, Enum):
    fertility = "fertility"
    seeding = "seeding"
    spray = "spray"
    fungicide = "fungicide"
    herbicide = "herbicide"
    lime = "lime"
    cover_crop = "cover_crop"
    biologicals = "biologicals"
    tillage = "tillage"
    variety = "variety"
    ground_speed = "ground_speed"
    planting_depth = "planting_depth"
    other = "other"


DEFAULT_PLOT_LENGTH_FT: dict[TrialType, Optional[float]] = {
    TrialType.fertility: 400.0,
    TrialType.seeding: 400.0,
    TrialType.spray: 300.0,
    TrialType.fungicide: 300.0,
    TrialType.herbicide: 300.0,
    TrialType.lime: 400.0,
    TrialType.cover_crop: 400.0,
    TrialType.biologicals: 300.0,
    TrialType.tillage: 600.0,
    TrialType.variety: 400.0,
    TrialType.ground_speed: 800.0,
    TrialType.planting_depth: 400.0,
    TrialType.other: None,
}


class Treatment(BaseModel):
    """One level in the treatment list.

    Numeric trial: value is a float (the application rate).
    Categorical trial: value is None; only label is meaningful.
    """

    label: str
    value: Optional[float] = None  # None → categorical treatment
    unit: str = ""

    @field_validator("value", mode="before")
    @classmethod
    def _coerce_numeric_string(cls, v: object) -> Optional[float]:
        """Accept numeric strings ("150") and coerce to float; leave None alone."""
        if v is None:
            return None
        try:
            return float(v)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            raise ValueError(
                f"Treatment value must be a number or null, got {v!r}. "
                "For categorical treatments, omit value or set it to null."
            )

    @property
    def is_categorical(self) -> bool:
        return self.value is None


class RepLayout(BaseModel):
    """Position and treatment assignment for one rep-block in the field.

    Produced by the placement engine; consumed by the outputs layer.
    All coordinates are in the UV frame (feet).
    """

    rep: int
    label: str  # e.g. "NW", "SW"
    u_west_ft: float
    u_east_ft: float
    v_south_ft: float
    v_north_ft: float
    treatment_order: list[int]  # 0-based indices into TrialDesign.treatments, strip 1..N

    @property
    def plot_length_ft(self) -> float:
        return self.u_east_ft - self.u_west_ft

    @property
    def block_height_ft(self) -> float:
        return self.v_north_ft - self.v_south_ft


class TrialDesign(BaseModel):
    """Fully specified trial design, ready for the geometry engine."""

    name: str = "Untitled Trial"
    trial_type: TrialType = TrialType.fertility
    treatments: list[Treatment] = Field(min_length=2)
    reps: Annotated[int, Field(ge=2, le=8)] = 4
    plot_length_ft: Optional[float] = Field(default=None, gt=0.0)
    categorical: bool = False  # set automatically; can be overridden

    @model_validator(mode="after")
    def _derive_and_validate(self) -> "TrialDesign":
        # Auto-detect categorical from treatment values
        any_categorical = any(t.is_categorical for t in self.treatments)
        all_categorical = all(t.is_categorical for t in self.treatments)

        if any_categorical and not all_categorical:
            raise ValueError(
                "All treatments must be either all numeric or all categorical. "
                "Mixed trials are not supported."
            )

        if any_categorical:
            self.categorical = True

        # Set default plot length for non-other types
        if self.plot_length_ft is None and self.trial_type != TrialType.other:
            self.plot_length_ft = DEFAULT_PLOT_LENGTH_FT[self.trial_type]

        # Require explicit plot_length_ft for 'other' type
        if self.trial_type == TrialType.other and self.plot_length_ft is None:
            raise ValueError(
                "plot_length_ft is required for trial_type='other'. "
                "No default exists; the farmer must specify plot dimensions."
            )

        return self

    @property
    def n_treatments(self) -> int:
        return len(self.treatments)
