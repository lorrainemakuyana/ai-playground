"""Bootstrap an admin user from environment variables on startup.

Set ADMIN_EMAIL and ADMIN_PASSWORD in the deployment environment (e.g. Render).
If both are present, the user is created (or upgraded) to PlanTier.ULTRA with
no expiry every time the server starts. Safe to run repeatedly — it is idempotent.

If either variable is absent the function is a no-op, so local dev is unaffected
unless you explicitly set them.
"""
from __future__ import annotations

import logging
import os

import bcrypt
from sqlmodel import select

from database import async_session_factory, seed_default_templates_for_user
from models.db import User
from models.enums import PlanTier

logger = logging.getLogger(__name__)


async def bootstrap_admin() -> None:
    email = os.getenv("ADMIN_EMAIL", "").strip()
    password = os.getenv("ADMIN_PASSWORD", "").strip()

    if not email or not password:
        return

    async with async_session_factory() as session:
        result = await session.exec(select(User).where(User.email == email))
        user = result.first()

        if user is None:
            user = User(
                email=email,
                password_hash=bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode(),
                plan=PlanTier.ULTRA,
                plan_expires_at=None,
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            await seed_default_templates_for_user(user.id, session)
            await session.commit()
            logger.info("Admin user created: %s (ULTRA)", email)
        else:
            changed = False
            if user.plan != PlanTier.ULTRA or user.plan_expires_at is not None:
                user.plan = PlanTier.ULTRA
                user.plan_expires_at = None
                changed = True
            if not bcrypt.checkpw(password.encode(), user.password_hash.encode()):
                user.password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
                changed = True
            if changed:
                session.add(user)
                await session.commit()
                logger.info("Admin user updated: %s (ULTRA)", email)
            else:
                logger.info("Admin user already current: %s", email)
