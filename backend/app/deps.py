"""Shared FastAPI dependencies."""
from fastapi import Request
from sqlalchemy import Engine


def engine_from_request(request: Request) -> Engine:
    """Returns test_engine (set by test fixture) or prod engine."""
    if hasattr(request.app.state, "test_engine"):
        return request.app.state.test_engine
    return request.app.state.engine
