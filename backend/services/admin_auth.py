"""Admin authentication dependency.

Protects production-sensitive endpoints behind an `x-admin-key` header.
When `ADMIN_API_KEY` is empty (dev/staging), the gate is open so testing
tools and CI can run without configuration. Once a non-empty `ADMIN_API_KEY`
is set in the environment, the header is required and a missing/wrong key
returns 401.
"""
import hmac
import logging
from typing import Optional

from fastapi import Header, HTTPException, status

from config import settings

log = logging.getLogger('admin_auth')


def require_admin(x_admin_key: Optional[str] = Header(default=None)):
    """FastAPI dependency. If ADMIN_API_KEY is unset (empty), permits all.

    If set, the request must include header `x-admin-key` whose value matches
    `settings.ADMIN_API_KEY` (constant-time compare).
    """
    expected = settings.ADMIN_API_KEY or ''
    if not expected:
        return  # open in dev/staging
    if not x_admin_key:
        log.warning('admin endpoint hit without x-admin-key header')
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='admin key required')
    if not hmac.compare_digest(str(x_admin_key), str(expected)):
        log.warning('admin endpoint hit with invalid x-admin-key')
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='invalid admin key')
    return
