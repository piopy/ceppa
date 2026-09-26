"""Roadmap.sh integration: catalogo roadmap ufficiali + conversione grafo -> index_json corsi.

Le API roadmap.sh non sono documentate/ufficiali: tutto l'uso resta isolato qui.
Cache in-memory con TTL, niente Redis.
"""

import json
import logging
import time
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

LIST_URL = "https://roadmap.sh/api/v1-list-official-roadmaps"
ROADMAP_URL = "https://roadmap.sh/api/v1-official-roadmap/{slug}"

_LIST_TTL = 3600  # catalogo: 1h
_ROADMAP_TTL = 900  # singola roadmap: 15min

_cache: Dict[str, tuple] = {}  # key -> (expires_at, value)


def _cached(key: str) -> Optional[Any]:
    hit = _cache.get(key)
    if hit and hit[0] > time.time():
        return hit[1]
    _cache.pop(key, None)
    return None


def _store(key: str, value: Any, ttl: int) -> None:
    _cache[key] = (time.time() + ttl, value)


async def fetch_roadmap_list() -> List[Dict[str, Any]]:
    """Catalogo roadmap ufficiali: [{slug, title, description}]."""
    hit = _cached("list")
    if hit is not None:
        return hit
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(LIST_URL)
        r.raise_for_status()
        raw = r.json()
    items = [
        {
            "slug": x.get("slug"),
            "title": (x.get("title") or {}).get("card") if isinstance(x.get("title"), dict) else x.get("title"),
            "description": (x.get("description") or "").replace("@currentYear@", str(2026)),
        }
        for x in raw
        if x.get("slug") and x.get("status", "published") == "published"
    ]
    _store("list", items, _LIST_TTL)
    return items


async def fetch_roadmap(slug: str) -> Dict[str, Any]:
    """Grafo roadmap: {title, nodes, edges}."""
    key = f"roadmap:{slug}"
    hit = _cached(key)
    if hit is not None:
        return hit
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(ROADMAP_URL.format(slug=slug))
        r.raise_for_status()
        raw = r.json()
    data = {"title": raw.get("title"), "nodes": raw.get("nodes", []), "edges": raw.get("edges", [])}
    _store(key, data, _ROADMAP_TTL)
    return data


def _label(node: Dict[str, Any]) -> str:
    data = node.get("data") or {}
    return (data.get("label") or "").strip()


def nodes_to_index(nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Converter euristico grafo -> [{"title": capitolo, "lessons": [{"title", "path"}]}].

    - Capitoli = nodi topic ordinati per position.y (tie-break x).
    - Sottocapitoli: edge entrante topic->subtopic; orfani al topic piu' vicino
      per |dy| + 0.15*|dx|. Ordinati per y.
    - Dedupe per label dentro il capitolo. path = "{cap}.{lez}".
    - Topic senza figli -> lezione singola col titolo del topic.
    """
    topics = [n for n in nodes if n.get("type") == "topic" and _label(n)]
    topics.sort(key=lambda n: (n.get("position", {}).get("y", 0), n.get("position", {}).get("x", 0)))
    if not topics:
        raise ValueError("Nessun topic nella roadmap")

    subtopics = [n for n in nodes if n.get("type") == "subtopic" and _label(n)]
    topic_ids = {n["id"] for n in topics}
    parent_of: Dict[str, str] = {}
    for e in edges:
        src, tgt = e.get("source"), e.get("target")
        if src in topic_ids and tgt:
            parent_of.setdefault(tgt, src)

    children: Dict[str, List[Dict[str, Any]]] = {t["id"]: [] for t in topics}
    for s in subtopics:
        pid = parent_of.get(s["id"])
        if pid is None:
            sy = s.get("position", {}).get("y", 0)
            sx = s.get("position", {}).get("x", 0)
            pid = min(
                topics,
                key=lambda t: abs(t.get("position", {}).get("y", 0) - sy)
                + 0.15 * abs(t.get("position", {}).get("x", 0) - sx),
            )["id"]
        if pid in children:
            children[pid].append(s)

    modules = []
    for i, t in enumerate(topics, start=1):
        kids = sorted(children[t["id"]], key=lambda n: (n.get("position", {}).get("y", 0), n.get("position", {}).get("x", 0)))
        seen, lessons = set(), []
        for j, k in enumerate(kids, start=1):
            label = _label(k)
            if label.lower() in seen:
                continue
            seen.add(label.lower())
            lessons.append({"title": label, "path": f"{i}.{j}"})
        if not lessons:
            lessons = [{"title": _label(t), "path": f"{i}.1"}]
        modules.append({"title": _label(t), "lessons": lessons})
    return modules


async def roadmap_to_index_json(slug: str) -> tuple:
    """(title, index_json_str) per creare un corso da roadmap."""
    data = await fetch_roadmap(slug)
    title = data["title"] if isinstance(data.get("title"), str) else (data.get("title") or {}).get("page", slug)
    return title, json.dumps(nodes_to_index(data["nodes"], data["edges"]), ensure_ascii=False)


def demo() -> None:
    """Self-check converter: capitoli + orfani + duplicati. Ponytail: un check basta."""
    nodes = [
        {"id": "t1", "type": "topic", "position": {"x": 0, "y": 10}, "data": {"label": "A"}},
        {"id": "t2", "type": "topic", "position": {"x": 0, "y": 100}, "data": {"label": "B"}},
        {"id": "s1", "type": "subtopic", "position": {"x": 0, "y": 20}, "data": {"label": "a1"}},
        {"id": "s2", "type": "subtopic", "position": {"x": 0, "y": 90}, "data": {"label": "orfano"}},
        {"id": "s3", "type": "subtopic", "position": {"x": 0, "y": 25}, "data": {"label": "A1"}},
        {"id": "t3", "type": "topic", "position": {"x": 0, "y": 200}, "data": {"label": "Vuoto"}},
    ]
    edges = [{"source": "t1", "target": "s1"}]
    idx = nodes_to_index(nodes, edges)
    assert [m["title"] for m in idx] == ["A", "B", "Vuoto"], idx
    assert [l["title"] for l in idx[0]["lessons"]] == ["a1"], idx[0]  # s3 dedupato (case-insensitive)
    assert idx[1]["lessons"] == [{"title": "orfano", "path": "2.1"}], idx[1]  # orfano -> B (vicino)
    assert idx[2]["lessons"] == [{"title": "Vuoto", "path": "3.1"}], idx[2]  # topic senza figli
    print("roadmap converter OK:", len(idx), "capitoli")


if __name__ == "__main__":
    demo()
