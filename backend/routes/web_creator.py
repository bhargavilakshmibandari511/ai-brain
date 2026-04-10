from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel
from typing import List, Optional, Dict
import os
import uuid
import logging
from datetime import datetime
import shutil
from pathlib import Path
import json

import app_state
from services.database import get_db_connection
from utils.sanitizer import sanitize_prompt

logger = logging.getLogger(__name__)
router = APIRouter()

# Asset storage handled via static/assets/ for project-specific isolation

# ── Pydantic Models ──────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str
    domain: Optional[str] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    domain: Optional[str] = None

class PageCreate(BaseModel):
    project_id: str
    title: str
    slug: str
    html: Optional[str] = ""
    css: Optional[str] = ""
    js: Optional[str] = ""

class PageUpdate(BaseModel):
    html: Optional[str] = None
    css: Optional[str] = None
    js: Optional[str] = None
    thought_process: Optional[str] = None
    status: Optional[str] = None

class WebGenerateRequest(BaseModel):
    prompt: str
    style: str = "modern"
    project_id: str
    page_title: Optional[str] = None
    slug: Optional[str] = None
    color_scheme: Optional[str] = None
    sections: Optional[List[str]] = None

class WebRefineRequest(BaseModel):
    page_id: str
    instruction: str
    scope: Optional[str] = "all"  # 'all' | 'html' | 'css' | 'js'

class StyleGenerateRequest(BaseModel):
    prompt: str

class DocGenerateRequest(BaseModel):
    document_id: str
    project_id: str
    style: str = "immersive-simulation"

# ── Projects API ─────────────────────────────────────────────────────────────

@router.post("/projects")
def create_project(req: ProjectCreate):
    """Create a new project."""
    conn = get_db_connection()
    try:
        project_id = f"proj_{str(uuid.uuid4().hex)[:8]}"
        conn.execute(
            "INSERT INTO projects (id, name, domain) VALUES (?, ?, ?)",
            (project_id, req.name, req.domain)
        )
        conn.commit()
        return {
            "id": project_id, 
            "name": req.name, 
            "domain": req.domain,
            "status": "draft",
            "created_at": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to create project: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.get("/projects")
def list_projects():
    """List all projects."""
    conn = get_db_connection()
    try:
        rows = conn.execute("SELECT * FROM projects ORDER BY created_at DESC").fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()

@router.get("/projects/{project_id}")
def get_project(project_id: str):
    """Get a single project."""
    conn = get_db_connection()
    try:
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Project not found")
        return dict(row)
    finally:
        conn.close()

@router.put("/projects/{project_id}")
def update_project(project_id: str, req: ProjectUpdate):
    """Update project name or domain."""
    conn = get_db_connection()
    try:
        updates = []
        params = []
        if req.name is not None:
            updates.append("name = ?")
            params.append(req.name)
        if req.domain is not None:
            updates.append("domain = ?")
            params.append(req.domain)
        
        if not updates:
            return {"success": True}
        
        params.append(project_id)
        query = f"UPDATE projects SET {', '.join(updates)} WHERE id = ?"
        conn.execute(query, tuple(params))
        conn.commit()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.delete("/projects/{project_id}")
def delete_project(project_id: str):
    """Delete project and all its pages."""
    conn = get_db_connection()
    try:
        conn.execute("DELETE FROM assets WHERE project_id = ?", (project_id,))
        conn.execute("DELETE FROM pages WHERE project_id = ?", (project_id,))
        conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        conn.commit()
        return {"success": True}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.post("/projects/{project_id}/publish")
def publish_project(project_id: str):
    """Publish all pages of a project."""
    conn = get_db_connection()
    try:
        # Mark all pages as published
        conn.execute("UPDATE pages SET status = 'published' WHERE project_id = ?", (project_id,))
        conn.execute("UPDATE projects SET status = 'published' WHERE id = ?", (project_id,))
        conn.commit()
        
        # Count published pages
        count = conn.execute("SELECT COUNT(*) as cnt FROM pages WHERE project_id = ? AND status = 'published'", (project_id,)).fetchone()
        published_count = count['cnt'] if count else 0
        
        url = f"https://{project_id}.ai-brain.local"
        return {
            "project_id": project_id,
            "url": url,
            "published_pages": published_count
        }
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.get("/projects/{project_id}/pages")
def list_project_pages(project_id: str):
    """List all pages in a project."""
    conn = get_db_connection()
    try:
        rows = conn.execute(
            "SELECT id, title, slug, status, updated_at FROM pages WHERE project_id = ? ORDER BY updated_at DESC", 
            (project_id,)
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()

@router.get("/projects/{project_id}/assets")
def list_project_assets(project_id: str):
    """List all assets for a project."""
    conn = get_db_connection()
    try:
        rows = conn.execute(
            "SELECT id, filename, file_url, file_type, size FROM assets WHERE project_id = ? ORDER BY uploaded_at DESC",
            (project_id,)
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()

# ── Pages API ────────────────────────────────────────────────────────────────

@router.post("/pages")
def create_page(req: PageCreate):
    """Create a new page."""
    conn = get_db_connection()
    try:
        page_id = f"page_{str(uuid.uuid4().hex)[:8]}"
        conn.execute(
            "INSERT INTO pages (id, project_id, title, slug, html, css, js) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (page_id, req.project_id, req.title, req.slug, req.html, req.css, req.js)
        )
        conn.commit()
        return {
            "id": page_id, 
            "project_id": req.project_id, 
            "title": req.title, 
            "slug": req.slug
        }
    except Exception as e:
        logger.error(f"Failed to create page: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.get("/pages/{page_id}")
def get_page(page_id: str):
    """Get full page content (html, css, js)."""
    conn = get_db_connection()
    try:
        row = conn.execute("SELECT * FROM pages WHERE id = ?", (page_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Page not found")
        page_data = dict(row)
        # Parse style_tokens if it's a string
        if isinstance(page_data.get('style_tokens'), str):
            try:
                page_data['style_tokens'] = json.loads(str(page_data['style_tokens']))
            except:
                page_data['style_tokens'] = {}
        return page_data
    finally:
        conn.close()

@router.put("/pages/{page_id}")
def update_page(page_id: str, req: PageUpdate):
    """Manually update page html/css/js."""
    conn = get_db_connection()
    try:
        updates = []
        params = []
        if req.html is not None:
            updates.append("html = ?")
            params.append(req.html)
        if req.css is not None:
            updates.append("css = ?")
            params.append(req.css)
        if req.js is not None:
            updates.append("js = ?")
            params.append(req.js)
        if req.thought_process is not None:
            updates.append("thought_process = ?")
            params.append(req.thought_process)
        if req.status is not None:
            updates.append("status = ?")
            params.append(req.status)
            
        if not updates:
            return {"success": True}
            
        updates.append("updated_at = CURRENT_TIMESTAMP")
        param_tuple = tuple(params) + (page_id,)
        
        query = f"UPDATE pages SET {', '.join(updates)} WHERE id = ?"
        conn.execute(query, param_tuple)
        conn.commit()
        return {"success": True}
    except Exception as e:
        logger.error(f"Failed to update page: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.delete("/pages/{page_id}")
def delete_page(page_id: str):
    """Delete a single page."""
    conn = get_db_connection()
    try:
        conn.execute("DELETE FROM pages WHERE id = ?", (page_id,))
        conn.commit()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.get("/pages/{page_id}/export")
def export_page(page_id: str):
    """Export page as single self-contained HTML file."""
    conn = get_db_connection()
    try:
        page = conn.execute("SELECT * FROM pages WHERE id = ?", (page_id,)).fetchone()
        if not page:
            raise HTTPException(status_code=404, detail="Page not found")
        
        page = dict(page)
        html_content = page.get('html', '')
        css_content = page.get('css', '')
        js_content = page.get('js', '')
        
        # Create self-contained HTML
        export_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{page.get('title', 'Exported Page')}</title>
    <style>
{css_content}
    </style>
</head>
<body>
{html_content}
    <script>
{js_content}
    </script>
</body>
</html>"""
        
        return HTMLResponse(content=export_html, headers={
            "Content-Disposition": f"attachment; filename={page_id}.html"
        })
    finally:
        conn.close()

# ── AI Generation & Refinement ───────────────────────────────────────────────

@router.post("/generate")
async def generate_website(req: WebGenerateRequest):
    """AI: Generate a new page from a text prompt."""
    sanitize_prompt(req.prompt)
    try:
        # Check project exists (using short-lived connection)
        with get_db_connection() as conn:
            proj = conn.execute("SELECT id FROM projects WHERE id = ?", (req.project_id,)).fetchone()
            if not proj:
                raise HTTPException(status_code=404, detail="Project not found")
        
        # Call AI Engine to generate content (outside of DB connection)
        try:
            content = await app_state.ai_engine.generate_web_content(
                prompt=req.prompt,
                style=req.style,
                color_scheme=req.color_scheme,
                sections=req.sections
            )
        except Exception as ai_error:
            logger.error(f"AI generation failed: {ai_error}")
            raise HTTPException(status_code=503, detail=f"AI engine failed: {str(ai_error)}")

        
        # Save as Page
        page_id = f"page_{str(uuid.uuid4().hex)[:8]}"
        title = req.page_title or content.get("title", "Untitled Page")
        slug = (req.slug or title.lower().replace(" ", "-")).replace("/", "-")
        
        try:
            style_tokens_json = json.dumps(content.get("style_tokens", {}))
        except:
            style_tokens_json = '{}'
        
        with get_db_connection() as conn:
            conn.execute(
                "INSERT INTO pages (id, project_id, title, slug, html, css, js, thought_process, style_tokens, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    page_id,
                    req.project_id,
                    title,
                    slug,
                    content.get("html", ""),
                    content.get("css", ""),
                    content.get("js", ""),
                    content.get("thought_process", ""),
                    style_tokens_json,
                    "draft"
                )
            )
            conn.commit()

        
        return {
            "id": page_id,
            "project_id": req.project_id,
            "title": title,
            "slug": slug,
            "html": content.get("html", ""),
            "css": content.get("css", ""),
            "js": content.get("js", ""),
            "thought_process": content.get("thought_process", ""),
            "style_tokens": content.get("style_tokens", {}),
            "status": "draft"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Web generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/refine")
async def refine_website(req: WebRefineRequest):
    """AI: Refine/modify an existing page with instructions."""
    sanitize_prompt(req.instruction)
    # Check page exists (using short-lived connection)
    with get_db_connection() as conn:
        page = conn.execute(
            "SELECT html, css, js FROM pages WHERE id = ?", 
            (req.page_id,)
        ).fetchone()
        if not page:
            raise HTTPException(status_code=404, detail="Page not found")
        
        page_dict = dict(page)
    
    # Call AI Engine (outside of DB connection)
    try:
        content = await app_state.ai_engine.refine_web_content(
            current_html=page_dict.get("html", ""),
            current_css=page_dict.get("css", ""),
            current_js=page_dict.get("js", ""),
            instruction=req.instruction,
            scope=req.scope
        )
    except Exception as ai_error:
        logger.error(f"AI refinement failed: {ai_error}")
        raise HTTPException(status_code=503, detail=f"AI engine failed: {str(ai_error)}")

        
        # Update Page in DB
        new_html = content.get("html", page_dict.get("html", ""))
        new_css = content.get("css", page_dict.get("css", ""))
        new_js = content.get("js", page_dict.get("js", ""))
        thought_process = content.get("thought_process", "")
        
        with get_db_connection() as conn:
            conn.execute(
                "UPDATE pages SET html = ?, css = ?, js = ?, thought_process = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (new_html, new_css, new_js, thought_process, req.page_id)
            )
            conn.commit()

        
        return {
            "id": req.page_id,
            "html": new_html,
            "css": new_css,
            "js": new_js,
            "thought_process": thought_process
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Web refinement failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate/style")
async def generate_style(req: StyleGenerateRequest):
    """AI: Generate only style tokens (colors, fonts, spacing) from prompt."""
    sanitize_prompt(req.prompt)
    try:
        content = await app_state.ai_engine.generate_style_tokens(req.prompt)
        return {
            "style_tokens": content.get("style_tokens", {})
        }
    except Exception as e:
        logger.error(f"Style generation failed: {e}")
        raise HTTPException(status_code=503, detail=str(e))

@router.post("/generate/from-doc")
async def generate_from_document(req: DocGenerateRequest):
    """AI: Generate a full simulation site from a PDF document's knowledge."""
    from routes.documents import documents, pdf_reader, UPLOAD_DIR as DOC_UPLOAD_DIR
    
    if req.document_id not in documents:
        raise HTTPException(status_code=404, detail="Document not found")
        
    doc = documents[req.document_id]
    file_path = os.path.join(DOC_UPLOAD_DIR, f"{req.document_id}_{doc.filename}")
    
    # Extract text from document
    try:
        if doc.filename.lower().endswith('.pdf'):
            text_content = await pdf_reader.extract_text(file_path)
        else:
            import aiofiles
            async with aiofiles.open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                text_content = await f.read()
    except Exception as e:
        logger.error(f"Failed to extract document text: {e}")
        raise HTTPException(status_code=500, detail=f"Content extraction failed: {str(e)}")

    if not text_content.strip():
        raise HTTPException(status_code=400, detail="Document has no content")

    # Call AI Engine specialized generation
    try:
        content = await app_state.ai_engine.generate_simulation_site(
            document_text=text_content,
            filename=doc.filename
        )
    except Exception as ai_error:
        logger.error(f"AI generation failed: {ai_error}")
        raise HTTPException(status_code=503, detail=f"AI engine failed: {str(ai_error)}")
    
    # Save as Page
    page_id = f"page_{str(uuid.uuid4().hex)[:8]}"
    title = f"Simulation: {doc.filename}"
    slug = f"sim-{req.document_id[:8]}"
    
    try:
        style_tokens_json = json.dumps(content.get("style_tokens", {}))
    except:
        style_tokens_json = '{}'
    
    conn = get_db_connection()
    try:
        conn.execute(
            "INSERT INTO pages (id, project_id, title, slug, html, css, js, thought_process, style_tokens, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                page_id,
                req.project_id,
                title,
                slug,
                content.get("html", ""),
                content.get("css", ""),
                content.get("js", ""),
                content.get("thought_process", ""),
                style_tokens_json,
                "draft"
            )
        )
        conn.commit()
    finally:
        conn.close()
    
    return {
        "id": page_id,
        "project_id": req.project_id,
        "title": title,
        "slug": slug,
        "html": content.get("html", ""),
        "css": content.get("css", ""),
        "js": content.get("js", ""),
        "thought_process": content.get("thought_process", ""),
        "style_tokens": content.get("style_tokens", {}),
        "status": "draft"
    }

# ── Assets API ───────────────────────────────────────────────────────────────

@router.post("/assets/upload")
async def upload_asset(project_id: str = Form(...), file: UploadFile = File(...)):
    """Upload an asset file (image, font, etc.)."""
    asset_storage = Path("static/assets") / project_id
    asset_storage.mkdir(parents=True, exist_ok=True)
    
    asset_id = str(uuid.uuid4().hex)[:8]
    file_name = f"{asset_id}_{file.filename}"
    file_path = asset_storage / file_name
    
    try:
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")
    
    file_url = f"/static/assets/{project_id}/{file_name}"
    
    conn = get_db_connection()
    try:
        conn.execute(
            "INSERT INTO assets (id, project_id, filename, file_url, file_type, size) VALUES (?, ?, ?, ?, ?, ?)",
            (asset_id, project_id, file.filename, file_url, file.content_type, file_path.stat().st_size)
        )
        conn.commit()
        return {
            "id": asset_id,
            "project_id": project_id,
            "filename": file.filename,
            "file_url": file_url,
            "file_type": file.content_type,
            "size": file_path.stat().st_size
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.delete("/assets/{asset_id}")
def delete_asset(asset_id: str):
    """Delete an asset."""
    conn = get_db_connection()
    try:
        asset = conn.execute("SELECT file_url FROM assets WHERE id = ?", (asset_id,)).fetchone()
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        
        # Extract path from URL /static/assets/{project_id}/{file_name}
        file_url = asset['file_url']
        file_path = Path(".") / file_url.lstrip('/')
        if file_path.exists():
            file_path.unlink()
        
        # Delete from DB
        conn.execute("DELETE FROM assets WHERE id = ?", (asset_id,))
        conn.commit()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

