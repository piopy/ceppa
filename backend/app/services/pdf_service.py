import os
import subprocess
import shutil
from pathlib import Path


class PDFService:
    BASE_DIR = Path("/app/user_files")  # Mapped volume

    @staticmethod
    def ensure_base_dir():
        """Ensure base directory exists with correct permissions"""
        PDFService.BASE_DIR.mkdir(parents=True, exist_ok=True)
        # Try to set permissions if possible (may fail in some environments)
        try:
            import os

            os.chmod(PDFService.BASE_DIR, 0o777)
        except (PermissionError, OSError):
            pass  # Ignore if we can't set permissions

    @staticmethod
    def _sanitize_filename(name: str) -> str:
        return "".join([c for c in name if c.isalnum() or c in (" ", "-", "_")]).strip()

    @staticmethod
    def ensure_user_directory(user_id: int, course_title: str):
        PDFService.ensure_base_dir()
        safe_course = PDFService._sanitize_filename(course_title)
        path = PDFService.BASE_DIR / str(user_id) / safe_course
        path.mkdir(parents=True, exist_ok=True)
        # Try to set permissions
        try:
            import os

            os.chmod(path, 0o777)
            os.chmod(path.parent, 0o777)
        except (PermissionError, OSError):
            pass
        return path

    @staticmethod
    async def convert_markdown_to_pdf(
        content_md: str, user_id: int, course_title: str, lesson_title: str
    ) -> str:
        """
        Converts markdown content to PDF and saves it. Returns relative path to the file.
        """
        safe_lesson = PDFService._sanitize_filename(lesson_title)
        dir_path = PDFService.ensure_user_directory(user_id, course_title)

        md_file = dir_path / f"{safe_lesson}.md"
        pdf_file = dir_path / f"{safe_lesson}.pdf"

        # Save MD
        with open(md_file, "w", encoding="utf-8") as f:
            f.write(content_md)

        # Run Pandoc
        # Try xelatex first, then fallback to pdflatex if it fails
        pdf_engines = ["xelatex", "pdflatex"]

        for engine in pdf_engines:
            try:
                result = subprocess.run(
                    [
                        "pandoc",
                        str(md_file),
                        "-o",
                        str(pdf_file),
                        f"--pdf-engine={engine}",
                        "-V",
                        "geometry:margin=1in",
                        "--toc",
                    ],
                    check=True,
                    capture_output=True,
                    text=True,
                    timeout=120,  # 2 minute timeout
                )
                # If successful, break out of loop
                break
            except subprocess.CalledProcessError as e:
                error_msg = (
                    f"Pandoc Error with {engine} (exit {e.returncode}): {e.stderr}"
                )
                print(error_msg)
                # If this was the last engine, return None
                if engine == pdf_engines[-1]:
                    return None
                # Otherwise, try next engine
                continue
            except subprocess.TimeoutExpired:
                print(f"Pandoc timeout with {engine} for lesson: {lesson_title}")
                if engine == pdf_engines[-1]:
                    return None
                continue
            return None

        # Return relative path for DB/Serving
        return (
            f"{user_id}/{PDFService._sanitize_filename(course_title)}/{safe_lesson}.pdf"
        )
