"""Trialfield FastAPI application entry point."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes.design import router as design_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    load_dotenv()
    yield


app = FastAPI(
    title="Trialfield API",
    version="0.1.0",
    description="On-farm trial geometry engine — HTTP wrapper around trialfield-core.",
    lifespan=lifespan,
)

# CORS_ORIGINS env var: comma-separated list of allowed origins.
# Defaults to localhost for local dev; set to the Vercel URL in production.
_raw = os.getenv("CORS_ORIGINS", "http://localhost:3000")
_origins = [o.strip() for o in _raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(design_router)
