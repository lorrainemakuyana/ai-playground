from contextlib import asynccontextmanager
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from database import init_db
from routers import projects, agents, tasks, stream, downloads, agent_templates, auth, sharing

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="SDLC Orchestrator", lifespan=lifespan, redirect_slashes=False)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(sharing.router, prefix="/projects", tags=["sharing"])
app.include_router(projects.router, prefix="/projects", tags=["projects"])
app.include_router(agents.router, prefix="/projects", tags=["agents"])
app.include_router(tasks.router, prefix="/projects", tags=["tasks"])
app.include_router(stream.router, prefix="/projects", tags=["stream"])
app.include_router(downloads.router, prefix="/projects", tags=["downloads"])
app.include_router(agent_templates.router, prefix="/agent-templates", tags=["agent-templates"])
