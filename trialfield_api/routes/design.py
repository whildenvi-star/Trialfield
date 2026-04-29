"""POST /design — run the trial design pipeline and stream a ZIP bundle."""

from __future__ import annotations

import io
import os

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse

from ..schemas.request import DesignRequest
from ..services.design_service import run_design_to_zip
from trialfield_core.io.soil_zones import fetch_soil_zones

router = APIRouter()


def _check_credits(key: str | None) -> None:
    """Raise HTTP 402 if payment is required and the key has no credits.

    When PAYMENT_REQUIRED=false (default) this is a no-op, keeping the
    service free until the owner decides to flip the flag.
    """
    if os.getenv("PAYMENT_REQUIRED", "false").lower() != "true":
        return
    if not key:
        raise HTTPException(status_code=402, detail="Access key required — visit /buy to get one.")
    from ..services.billing_service import consume_credit
    if not consume_credit(key):
        raise HTTPException(status_code=402, detail="No credits remaining — visit /buy to top up.")


@router.post("/design")
def design(
    req: DesignRequest,
    x_access_key: str | None = Header(default=None),
) -> StreamingResponse:
    """Accept a trial design request and return the output file bundle as a ZIP."""
    _check_credits(x_access_key)
    try:
        zip_bytes, trial_name = run_design_to_zip(req)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Design pipeline failed: {exc}")

    return StreamingResponse(
        io.BytesIO(zip_bytes),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{trial_name}.zip"'},
    )


@router.post("/soil-zones")
def soil_zones(body: dict) -> dict:
    """Return soil map unit polygons intersecting the given field boundary."""
    field_geojson = body.get("field_boundary_geojson")
    if not field_geojson:
        return {"type": "FeatureCollection", "features": []}
    try:
        from shapely.geometry import shape as shapely_shape
        geom = shapely_shape(field_geojson)
        features = fetch_soil_zones(geom.wkt)
        return {"type": "FeatureCollection", "features": features}
    except Exception:
        return {"type": "FeatureCollection", "features": []}
