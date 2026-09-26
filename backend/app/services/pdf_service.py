import os
import re
import subprocess
import shutil
from pathlib import Path


# Blocchi script che pdflatex/xelatex senza font CJK non digeriscono.
# Nelle lezioni IT/EN sono rumore del LLM: si rimuovono invece di far fallire il PDF.
_STRIP_RANGES = [
    (0x4E00, 0x9FFF),    # CJK Unified
    (0x3400, 0x4DBF),    # CJK Ext A
    (0x20000, 0x2EBEF),  # CJK Ext B-F
    (0x3040, 0x309F),    # Hiragana
    (0x30A0, 0x30FF),    # Katakana
    (0xAC00, 0xD7AF),    # Hangul
    (0x0600, 0x06FF),    # Arabic
    (0x0590, 0x05FF),    # Hebrew
    (0x0E00, 0x0E7F),    # Thai
    (0x0900, 0x097F),    # Devanagari
    (0x1F000, 0x1FAFF),  # Emoji/simboli estesi
    (0x200B, 0x200F),    # Zero-width/format
    (0xFEFF, 0xFEFF),    # BOM
]
_STRIP_RE = re.compile("|".join(f"[\\U{c1:08X}-\\U{c2:08X}]" for c1, c2 in _STRIP_RANGES))


def _clean_markdown(content_md: str) -> str:
    """Rimuove caratteri che fanno fallire LaTeX. Ritorna (pulito, n_rimossi)."""
    cleaned, n = _STRIP_RE.subn("", content_md)
    return cleaned, n


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

        # Save MD (pulito da caratteri che uccidono LaTeX, es. CJK spuri del LLM)
        content_md, stripped = _clean_markdown(content_md)
        if stripped:
            print(f"PDF: rimossi {stripped} caratteri non-latin da '{lesson_title}'")
        with open(md_file, "w", encoding="utf-8") as f:
            f.write(content_md)

        try:
            # Run Pandoc
            # Try xelatex first, then fallback to pdflatex if it fails
            pdf_engines = ["xelatex", "pdflatex"]

            for engine in pdf_engines:
                try:
                    cmd = [
                        "pandoc",
                        str(md_file),
                        "-o",
                        str(pdf_file),
                        f"--pdf-engine={engine}",
                        "-V",
                        "geometry:margin=1in",
                        "--toc",
                    ]
                    # Niente mainfont custom: niente fontconfig nel container,
                    # xelatex usa Latin Modern da texmf. Unicode oltre latin
                    # gia' rimosso da _clean_markdown.
                    result = subprocess.run(
                        cmd,
                        check=True,
                        capture_output=True,
                        text=True,
                        timeout=300,  # doc interi corsi sono grossi
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
        finally:
            # Clean up the temporary .md file after conversion
            try:
                if md_file.exists():
                    os.remove(md_file)
            except OSError:
                pass  # Ignore cleanup errors

        # Return relative path for DB/Serving
        return (
            f"{user_id}/{PDFService._sanitize_filename(course_title)}/{safe_lesson}.pdf"
        )

    @staticmethod
    async def convert_markdown_to_epub(
        content_md: str, user_id: int, course_title: str, lesson_title: str
    ) -> str:
        """
        Converts markdown content to EPUB and saves it. Returns relative path to the file.
        """
        safe_lesson = PDFService._sanitize_filename(lesson_title)
        dir_path = PDFService.ensure_user_directory(user_id, course_title)

        md_file = dir_path / f"{safe_lesson}.md"
        epub_file = dir_path / f"{safe_lesson}.epub"

        try:
            # Save MD
            with open(md_file, "w", encoding="utf-8") as f:
                f.write(content_md)

            # Run Pandoc to generate EPUB
            try:
                result = subprocess.run(
                    [
                        "pandoc",
                        str(md_file),
                        "-o",
                        str(epub_file),
                        "--toc",
                        "--toc-depth=3",
                    ],
                    check=True,
                    capture_output=True,
                    text=True,
                    timeout=120,  # 2 minute timeout
                )
            except subprocess.CalledProcessError as e:
                error_msg = f"Pandoc EPUB Error (exit {e.returncode}): {e.stderr}"
                print(error_msg)
                return None
            except subprocess.TimeoutExpired:
                print(f"Pandoc EPUB timeout for: {lesson_title}")
                return None
        finally:
            # Clean up the temporary .md file after conversion
            try:
                if md_file.exists():
                    os.remove(md_file)
            except OSError:
                pass  # Ignore cleanup errors

        # Return relative path for DB/Serving
        return f"{user_id}/{PDFService._sanitize_filename(course_title)}/{safe_lesson}.epub"
