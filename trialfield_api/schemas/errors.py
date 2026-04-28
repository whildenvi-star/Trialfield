from pydantic import BaseModel


class ErrorEnvelope(BaseModel):
    error: str
    detail: str
