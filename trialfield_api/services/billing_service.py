"""Supabase-backed access key and credit management."""

from __future__ import annotations

import os
import secrets
import string

from supabase import create_client, Client


def _db() -> Client:
    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_KEY"],
    )


def generate_key() -> str:
    chars = string.ascii_uppercase + string.digits
    return "TF-" + "".join(secrets.choice(chars) for _ in range(8))


def create_pending_key(key: str) -> None:
    _db().table("access_keys").insert({"key": key, "credits": 0}).execute()


def activate_key(key: str, credits: int) -> None:
    _db().table("access_keys").update({"credits": credits}).eq("key", key).execute()


def get_credits(key: str) -> int | None:
    """Return credit balance, or None if key does not exist."""
    row = (
        _db()
        .table("access_keys")
        .select("credits")
        .eq("key", key)
        .maybe_single()
        .execute()
    )
    if row is None or row.data is None:
        return None
    return row.data["credits"]


def consume_credit(key: str) -> bool:
    """Atomically decrement one credit. Returns True on success.

    credits == -1 means unlimited (preferred user) — always returns True.
    Returns False if key is unknown or has no credits remaining.
    """
    current = get_credits(key)
    if current is None:
        return False
    if current == -1:
        return True
    if current <= 0:
        return False
    # Optimistic update: only succeeds if credits haven't changed underneath us.
    result = (
        _db()
        .table("access_keys")
        .update({"credits": current - 1})
        .eq("key", key)
        .eq("credits", current)
        .execute()
    )
    return len(result.data) > 0
