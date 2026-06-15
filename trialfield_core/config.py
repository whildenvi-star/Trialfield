"""Top-level config loader: resolves CLI flags and YAML config into a single validated input object."""

from __future__ import annotations

from pathlib import Path
from typing import Literal, Optional

import yaml
from pydantic import BaseModel, Field, model_validator

from trialfield_core.models.geometry_inputs import ImplementWidths
from trialfield_core.models.trial_design import TrialDesign, TrialType, Treatment


class GeometryConfig(BaseModel):
    """Geometry section of the YAML config."""

    trial_swath_ft: float = Field(gt=0.0)
    combine_ft: Optional[float] = Field(default=None, gt=0.0)
    ab_line: str  # path to AB line shapefile or zip
    field_boundary: Optional[str] = None
    soil_mode: Literal["auto", "skip"] | str = "auto"  # "auto" | "shapefile:path" | "skip"


class OutputConfig(BaseModel):
    """Output section of the YAML config."""

    dir: str = "./out/"


class TrialSection(BaseModel):
    """Trial section of the YAML config — becomes a TrialDesign."""

    type: TrialType = TrialType.fertility
    name: str = "Untitled Trial"
    prose: Optional[str] = None  # free-text; LLM parses if treatments not given
    treatments: Optional[list[Treatment]] = None
    reps: int = Field(default=4, ge=2, le=8)
    plot_length_ft: Optional[float] = Field(default=None, gt=0.0)

    def to_trial_design(self) -> TrialDesign:
        if self.treatments is None:
            raise ValueError(
                "treatments must be provided in the config file. "
                "Use --design-prose on the CLI to let the LLM fill them in."
            )
        return TrialDesign(
            name=self.name,
            trial_type=self.type,
            treatments=self.treatments,
            reps=self.reps,
            plot_length_ft=self.plot_length_ft,
        )


class TrialRunConfig(BaseModel):
    """Complete validated config for a single trialfield design run."""

    trial: TrialSection
    geometry: GeometryConfig
    output: OutputConfig = Field(default_factory=OutputConfig)

    def to_trial_design(self) -> TrialDesign:
        return self.trial.to_trial_design()

    def to_implement_widths(self) -> ImplementWidths:
        return ImplementWidths(
            trial_swath_ft=self.geometry.trial_swath_ft,
            combine_ft=self.geometry.combine_ft,
        )


def load_config(path: str | Path) -> TrialRunConfig:
    """Load and validate a YAML config file into a TrialRunConfig.

    Raises FileNotFoundError if the file doesn't exist.
    Raises pydantic.ValidationError if the config is invalid.
    """
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Config file not found: {p}")
    with p.open() as fh:
        raw = yaml.safe_load(fh)
    if not isinstance(raw, dict):
        raise ValueError(f"Config file must be a YAML mapping, got {type(raw).__name__}")
    return TrialRunConfig.model_validate(raw)
