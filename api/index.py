"""
Vercel serverless entrypoint.

Vercel routes /api/* here; the React UI is served from frontend/dist (see vercel.json).
All HTTP routes are defined on the FastAPI app in main.py.
"""

from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from main import app  # noqa: E402

__all__ = ["app"]
