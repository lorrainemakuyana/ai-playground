from contextlib import asynccontextmanager
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from routers import projects, agents, tasks, stream, downloads, agent_templates


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="SDLC Orchestrator", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router, prefix="/projects", tags=["projects"])
app.include_router(agents.router, prefix="/projects", tags=["agents"])
app.include_router(tasks.router, prefix="/projects", tags=["tasks"])
app.include_router(stream.router, prefix="/projects", tags=["stream"])
app.include_router(downloads.router, prefix="/projects", tags=["downloads"])
app.include_router(agent_templates.router, prefix="/agent-templates", tags=["agent-templates"])
