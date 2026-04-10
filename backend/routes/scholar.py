from fastapi import APIRouter, HTTPException, Query
import httpx
from typing import Optional

router = APIRouter()

S2_BASE = "https://api.semanticscholar.org/graph/v1"
S2_RECCO = "https://api.semanticscholar.org/recommendations/v1"

# Default fields expected by the frontend
DEFAULT_FIELDS = (
    "title,abstract,year,citationCount,influentialCitationCount,"
    "referenceCount,authors,venue,publicationTypes,publicationDate,"
    "url,openAccessPdf,fieldsOfStudy,tldr,externalIds"
)

@router.get("/search")
async def search_papers(
    query: str,
    limit: int = 15,
    fields: Optional[str] = Query(DEFAULT_FIELDS)
):
    """Proxy for Semantic Scholar search"""
    try:
        async with httpx.AsyncClient() as client:
            url = f"{S2_BASE}/paper/search"
            params = {
                "query": query,
                "fields": fields,
                "limit": limit
            }
            response = await client.get(url, params=params, timeout=10.0)
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code, 
                    detail=f"Semantic Scholar Error: {response.text}"
                )
            
            return response.json()
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Network error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/recommendations/{paper_id}")
async def get_recommendations(
    paper_id: str,
    limit: int = 6,
    fields: Optional[str] = Query(DEFAULT_FIELDS)
):
    """Proxy for Semantic Scholar recommendations"""
    try:
        async with httpx.AsyncClient() as client:
            url = f"{S2_RECCO}/papers/forpaper/{paper_id}"
            params = {
                "fields": fields,
                "limit": limit
            }
            response = await client.get(url, params=params, timeout=10.0)
            
            if response.status_code != 200:
                return {"recommendedPapers": []} # Return empty list on error for recommendations
                
            return response.json()
    except Exception as e:
        return {"recommendedPapers": [], "error": str(e)}

@router.get("/paper/{paper_id}")
async def get_paper(
    paper_id: str,
    fields: Optional[str] = Query(DEFAULT_FIELDS)
):
    """Proxy for getting a specific paper by ID or DOI"""
    try:
        async with httpx.AsyncClient() as client:
            # Paper ID can be DOI or S2ID
            url = f"{S2_BASE}/paper/{paper_id}"
            params = {"fields": fields}
            response = await client.get(url, params=params, timeout=10.0)
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code, 
                    detail="Paper not found"
                )
                
            return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
