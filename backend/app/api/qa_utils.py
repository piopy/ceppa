"""Helper condivisi Q&A thread/chat (lezioni + lab)."""
from sqlalchemy.future import select


async def thread_history(db, model, fk_name, fk_value, parent_id, limit=20):
    """Catena antenati (vecchio -> nuovo) come history LLM. Cap turni e loop-safe."""
    chain, seen, cur = [], set(), parent_id
    while cur and len(chain) < limit and cur not in seen:
        seen.add(cur)
        res = await db.execute(select(model).where(model.id == cur))
        row = res.scalars().first()
        if not row or getattr(row, fk_name) != fk_value:
            break
        text = row.answer or row.question or ""
        role = row.role or ("assistant" if row.answer else "user")
        chain.append({"role": role, "content": text[:2000]})
        cur = row.parent_id
    return list(reversed(chain))
