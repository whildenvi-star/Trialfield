"""POST /design — run the trial design pipeline and stream a ZIP bundle."""

from __future__ import annotations

import io

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from ..schemas.request import DesignRequest
from ..services.design_service import run_design_to_zip

router = APIRouter()


@router.post("/design")
def design(req: DesignRequest) -> StreamingResponse:
    """Accept a trial design request and return the output file bundle as a ZIP.

    The route is a plain `def` (not `async def`) so FastAPI dispatches it to a
    thread-pool executor — appropriate for the CPU-bound geometry pipeline.
    """
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
