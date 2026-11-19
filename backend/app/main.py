from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.transguard.assist import router as transguard_assist_router
from app.transguard.router import router as transguard_router
from app.db import fetch_one

app = FastAPI(title="Transguard demo API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3002"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    fetch_one("select 1 as ok")
    return {"status": "ok"}


app.include_router(transguard_router)
app.include_router(transguard_assist_router)
