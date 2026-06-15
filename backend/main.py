import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from bootstrap_admin import bootstrap_admin
from database import init_db
from rate_limit import limiter
from routers import projects, agents, tasks, stream, downloads, agent_templates, auth, sharing, users, admin, github


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await bootstrap_admin()
    yield


app = FastAPI(title="SDLC Orchestrator", lifespan=lifespan, redirect_slashes=False)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Allowed CORS origins are driven by env so production hosts can be configured.
# FRONTEND_URL may be a single origin or a comma-separated list.
_allowed_origins = [
    o.strip() for o in os.getenv("FRONTEND_URL", "http://localhost:3000").split(",") if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])
app.include_router(sharing.router, prefix="/projects", tags=["sharing"])
app.include_router(projects.router, prefix="/projects", tags=["projects"])
app.include_router(agents.router, prefix="/projects", tags=["agents"])
app.include_router(tasks.router, prefix="/projects", tags=["tasks"])
app.include_router(stream.router, prefix="/projects", tags=["stream"])
app.include_router(downloads.router, prefix="/projects", tags=["downloads"])
app.include_router(agent_templates.router, prefix="/agent-templates", tags=["agent-templates"])
app.include_router(github.router, tags=["github"])
