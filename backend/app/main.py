from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os
import shutil
from app.services.llm_service import LLMService
from app.services.pdf_service import PDFService

app = FastAPI(
    title="Dynamic Learning App Backend", version="1.0.0", documentation_url="/docs"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from typing import Optional


class TopicRequest(BaseModel):
    topic: str
    custom_instructions: Optional[str] = None


llm_service = LLMService()
pdf_service = PDFService()


def clean_up_file(path: str):
    """Background task to remove temporary file after sending"""
    try:
        os.remove(path)
    except Exception as e:
        print(f"Error removing file {path}: {e}")


@app.post("/generate")
async def generate_guide(request: TopicRequest, background_tasks: BackgroundTasks):
    try:
        # 1. Generate Content
        markdown_content = llm_service.generate_learning_content(
            request.topic, request.custom_instructions
        )

        # 2. Convert to PDF
        pdf_path = pdf_service.convert_to_pdf(markdown_content)

        # 3. Return File
        # We use BackgroundTasks to delete the file after response
        background_tasks.add_task(clean_up_file, pdf_path)

        return FileResponse(
            pdf_path,
            media_type="application/pdf",
            filename=f"guida_{request.topic.replace(' ', '_')}.pdf",
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
def health_check():
    return {"status": "ok"}
