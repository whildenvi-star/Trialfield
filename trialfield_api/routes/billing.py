"""Billing routes: checkout, Stripe webhook, credit lookup."""

from __future__ import annotations

import os

import stripe
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ..services.billing_service import (
    activate_key,
    create_pending_key,
    generate_key,
    get_credits,
)

router = APIRouter()

PACK_CREDITS = {"starter": 5, "pro": 15}


class CheckoutRequest(BaseModel):
    pack: str  # "starter" or "pro"


@router.get("/credits")
def credits_endpoint(key: str) -> JSONResponse:
    """Return credit balance for an access key."""
    balance = get_credits(key)
    if balance is None:
        return JSONResponse({"valid": False, "credits": 0, "key": key})
    return JSONResponse({"valid": True, "credits": balance, "key": key})


@router.post("/checkout")
def checkout(req: CheckoutRequest) -> JSONResponse:
    """Create a Stripe Checkout session for a credit pack.

    Returns {url, key} — the frontend saves the key to localStorage then
    redirects the user to the Stripe-hosted checkout URL.
    """
    if req.pack not in PACK_CREDITS:
        raise HTTPException(status_code=400, detail=f"Unknown pack '{req.pack}'. Use 'starter' or 'pro'.")

    price_env = "STRIPE_STARTER_PRICE_ID" if req.pack == "starter" else "STRIPE_PRO_PRICE_ID"
    price_id = os.environ.get(price_env)
    if not price_id:
        raise HTTPException(status_code=500, detail="Stripe price not configured.")

    frontend_url = os.getenv("FRONTEND_URL", "https://trialfield.vercel.app")
    stripe.api_key = os.environ["STRIPE_SECRET_KEY"]

    key = generate_key()
    create_pending_key(key)

    session = stripe.checkout.Session.create(
        mode="payment",
        line_items=[{"price": price_id, "quantity": 1}],
        metadata={"key": key, "pack": req.pack},
        success_url=f"{frontend_url}/success",
        cancel_url=f"{frontend_url}/buy",
    )

    return JSONResponse({"url": session.url, "key": key})


@router.post("/webhook/stripe")
async def stripe_webhook(request: Request) -> JSONResponse:
    """Receive Stripe events and activate keys on successful payment."""
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

    stripe.api_key = os.environ["STRIPE_SECRET_KEY"]

    try:
        event = stripe.Webhook.construct_event(payload, sig, webhook_secret)
    except stripe.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid Stripe signature")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        meta = session.get("metadata", {})
        key = meta.get("key")
        pack = meta.get("pack")
        if key and pack in PACK_CREDITS:
            activate_key(key, PACK_CREDITS[pack])

    return JSONResponse({"received": True})
