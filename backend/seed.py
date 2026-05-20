"""
Seed the database with test users, projects, and sharing scenarios.

Usage (from backend/):
    SECRET_KEY=dev python seed.py
    or with the full stack:
    SECRET_KEY=dev python seed.py --reset   (drops and recreates all tables first)

Test accounts created:
    alice@example.com  / Alice1234
    bob@example.com    / Bob1234
    carol@example.com  / Carol1234
"""
from __future__ import annotations

import asyncio
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv
load_dotenv()

import bcrypt
from sqlmodel import SQLModel, select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool
from sqlmodel.ext.asyncio.session import AsyncSession

import models.db  # noqa: F401 — register all tables with metadata
from models.db import (
    Agent,
    AgentTemplate,
    Project,
    ProjectShare,
    ProjectShareLink,
    Task,
    User,
)
from models.enums import AgentRole, ProjectStatus, SDLCPhase
import services.prompt_builder as prompt_builder

import os, secrets

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./data/orchestrator.db")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _hash(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


async def _seed_agents(session: AsyncSession, project: Project) -> None:
    templates_result = await session.exec(
        select(AgentTemplate).where(AgentTemplate.is_active == True)
    )
    templates = templates_result.all() or [
        AgentTemplate(role=AgentRole.TECH_LEAD,  specialization="Tech Lead",           model_name="claude-sonnet-4-6"),
        AgentTemplate(role=AgentRole.ENGINEER_1, specialization="Software Engineer 1", model_name="claude-sonnet-4-6"),
        AgentTemplate(role=AgentRole.ENGINEER_2, specialization="Software Engineer 2", model_name="claude-sonnet-4-6"),
        AgentTemplate(role=AgentRole.QA,         specialization="QA Engineer",         model_name="claude-sonnet-4-6"),
        AgentTemplate(role=AgentRole.SRE,        specialization="SRE",                 model_name="claude-sonnet-4-6"),
    ]
    for tmpl in templates:
        agent = Agent(
            project_id=project.id,
            role=tmpl.role,
            specialization=tmpl.specialization,
            model_name=tmpl.model_name,
            system_prompt=prompt_builder.build_system_prompt(tmpl.role, tmpl.specialization, project),
            is_template_agent=True,
        )
        session.add(agent)


async def run(reset: bool = False) -> None:
    engine = create_async_engine(DATABASE_URL, echo=False)

    async with engine.begin() as conn:
        if reset:
            await conn.run_sync(SQLModel.metadata.drop_all)
        await conn.run_sync(SQLModel.metadata.create_all)

    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with factory() as session:
        # ------------------------------------------------------------------
        # Users
        # ------------------------------------------------------------------
        existing = await session.exec(select(User).where(User.email == "alice@example.com"))
        if existing.first():
            print("Seed data already present — skipping. Pass --reset to reseed.")
            return

        alice = User(email="alice@example.com", password_hash=_hash("Alice1234"))
        bob   = User(email="bob@example.com",   password_hash=_hash("Bob1234"))
        carol = User(email="carol@example.com", password_hash=_hash("Carol1234"))
        for u in (alice, bob, carol):
            session.add(u)
        await session.commit()
        for u in (alice, bob, carol):
            await session.refresh(u)

        # ------------------------------------------------------------------
        # Alice's projects
        # ------------------------------------------------------------------
        p_ecommerce = Project(
            name="E-commerce Platform",
            description="Full-stack e-commerce site with cart, checkout, and payment integration.",
            user_id=alice.id,
            status=ProjectStatus.ACTIVE,
            current_phase=SDLCPhase.IMPLEMENTATION,
        )
        p_pipeline = Project(
            name="Data Pipeline",
            description="ETL pipeline for ingesting and transforming analytics events into a data warehouse.",
            user_id=alice.id,
            status=ProjectStatus.DONE,
            current_phase=SDLCPhase.DONE,
            archived_at=_now(),
        )
        for p in (p_ecommerce, p_pipeline):
            session.add(p)
        await session.commit()
        for p in (p_ecommerce, p_pipeline):
            await session.refresh(p)
        await _seed_agents(session, p_ecommerce)
        await _seed_agents(session, p_pipeline)

        # ------------------------------------------------------------------
        # Bob's projects
        # ------------------------------------------------------------------
        p_mobile = Project(
            name="Mobile App",
            description="React Native mobile app with push notifications and offline support.",
            user_id=bob.id,
            status=ProjectStatus.ACTIVE,
            current_phase=SDLCPhase.ARCHITECTURE,
        )
        session.add(p_mobile)
        await session.commit()
        await session.refresh(p_mobile)
        await _seed_agents(session, p_mobile)

        # ------------------------------------------------------------------
        # Carol's projects
        # ------------------------------------------------------------------
        p_analytics = Project(
            name="Analytics Dashboard",
            description="Real-time analytics dashboard with charts, filters, and export functionality.",
            user_id=carol.id,
            status=ProjectStatus.ACTIVE,
            current_phase=SDLCPhase.TESTING,
        )
        session.add(p_analytics)
        await session.commit()
        await session.refresh(p_analytics)
        await _seed_agents(session, p_analytics)

        # ------------------------------------------------------------------
        # Sharing scenarios
        # ------------------------------------------------------------------

        # 1. Alice shares E-commerce with Bob (active collaborator)
        share_alice_bob = ProjectShare(
            project_id=p_ecommerce.id,
            user_id=bob.id,
            invited_email=bob.email,
            invite_method="email",
            joined_at=_now(),
        )

        # 2. Alice shares E-commerce with Carol — then REVOKES it
        #    Carol will see this project greyed out in her list
        share_alice_carol = ProjectShare(
            project_id=p_ecommerce.id,
            user_id=carol.id,
            invited_email=carol.email,
            invite_method="email",
            joined_at=_now(),
            revoked_at=_now(),
        )

        # 3. Carol shares Analytics Dashboard with Bob (active collaborator via link)
        share_carol_bob = ProjectShare(
            project_id=p_analytics.id,
            user_id=bob.id,
            invited_email=bob.email,
            invite_method="link",
            joined_at=_now(),
        )

        for s in (share_alice_bob, share_alice_carol, share_carol_bob):
            session.add(s)

        # 4. Alice's E-commerce has a live share link
        share_link = ProjectShareLink(
            project_id=p_ecommerce.id,
            token=secrets.token_hex(32),
        )
        session.add(share_link)

        await session.commit()

        print("\n✓ Seed complete!\n")
        print("Test accounts:")
        print("  alice@example.com  / Alice1234")
        print("    → owns: 'E-commerce Platform' (shared with Bob), 'Data Pipeline' (archived)")
        print("  bob@example.com    / Bob1234")
        print("    → owns: 'Mobile App'")
        print("    → shared with: 'E-commerce Platform' (from Alice), 'Analytics Dashboard' (from Carol)")
        print("  carol@example.com  / Carol1234")
        print("    → owns: 'Analytics Dashboard' (shared with Bob)")
        print("    → revoked access: 'E-commerce Platform' (shows greyed out)")
        print(f"\nShare link for E-commerce Platform:")
        print(f"  http://localhost:3000/app/projects/join/{share_link.token}")


if __name__ == "__main__":
    asyncio.run(run(reset="--reset" in sys.argv))
