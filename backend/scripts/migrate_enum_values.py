"""One-off migration: rewrite enum columns from member *name* to member *value*.

Historically most enum columns were persisted by SQLAlchemy's default (the
member name, e.g. "TECH_LEAD"), while ``users.plan`` was stored by value
("free"). The models now persist every enum by value, so this script aligns the
existing rows.

Idempotent: each enum member's name differs from its value, so re-running only
ever matches rows still holding a name and is a no-op once converted.

Run from the backend/ directory:  python -m scripts.migrate_enum_values
"""

from __future__ import annotations

import asyncio

from sqlalchemy import text

from database import engine
from models.enums import (
    AgentRole,
    AgentStatus,
    PlanTier,
    ProjectStatus,
    SDLCPhase,
    TaskStatus,
)

# (table, column, enum) for every enum-typed column in the schema.
_COLUMNS = [
    ("users", "plan", PlanTier),
    ("agent_templates", "role", AgentRole),
    ("projects", "status", ProjectStatus),
    ("projects", "current_phase", SDLCPhase),
    ("agents", "role", AgentRole),
    ("agents", "status", AgentStatus),
    ("tasks", "phase", SDLCPhase),
    ("tasks", "status", TaskStatus),
    ("tasks", "role", AgentRole),
]


async def migrate() -> None:
    total = 0
    async with engine.begin() as conn:
        for table, column, enum_cls in _COLUMNS:
            for member in enum_cls:
                if member.name == member.value:
                    continue
                result = await conn.execute(
                    text(
                        f"UPDATE {table} SET {column} = :value "
                        f"WHERE {column} = :name"
                    ),
                    {"value": member.value, "name": member.name},
                )
                if result.rowcount:
                    total += result.rowcount
                    print(
                        f"  {table}.{column}: {member.name} -> {member.value} "
                        f"({result.rowcount} row(s))"
                    )
    print(f"Done. {total} row(s) updated.")


if __name__ == "__main__":
    asyncio.run(migrate())
