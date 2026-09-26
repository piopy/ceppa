from typing import Any
from fastapi import APIRouter, HTTPException
from app.services import roadmap_service

router = APIRouter()


@router.get("", response_model=list[dict])
async def list_roadmaps() -> Any:
    """Catalogo roadmap ufficiali roadmap.sh (cache 1h)."""
    try:
        return await roadmap_service.fetch_roadmap_list()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"roadmap.sh non raggiungibile: {e}")


@router.get("/{slug}")
async def get_roadmap(slug: str) -> Any:
    """Singola roadmap convertita in indice corso (cache 15min)."""
    try:
        data = await roadmap_service.fetch_roadmap(slug)
        return {
            "slug": slug,
            "title": data["title"],
            "index": roadmap_service.nodes_to_index(data["nodes"], data["edges"]),
        }
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"roadmap.sh non raggiungibile: {e}")
