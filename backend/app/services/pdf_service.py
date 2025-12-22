import pypandoc
import os
import uuid
import re


class PDFService:
    def _sanitize_markdown(self, content: str) -> str:
        """
        Remove or replace problematic Unicode characters that LaTeX can't handle.
        """
        # Replace box-drawing characters (tree structure characters)
        replacements = {
            "├": "|--",
            "└": "`--",
            "│": "|",
            "─": "-",
            "┌": "+--",
            "┐": "--+",
            "┘": "--+",
            "┴": "-+-",
            "┬": "-+-",
            "┤": "--|",
            "┼": "-+-",
            "╭": "+--",
            "╮": "--+",
            "╯": "--+",
            "╰": "+--",
            "╴": "-",
            "╵": "|",
            "╶": "-",
            "╷": "|",
        }

        for unicode_char, ascii_char in replacements.items():
            content = content.replace(unicode_char, ascii_char)

        return content

    def convert_to_pdf(self, markdown_content: str, output_dir: str = "/tmp") -> str:
        """
        Converts markdown content to PDF using pypandoc.
        Returns the path to the generated PDF file.
        """
        filename = f"learning_guide_{uuid.uuid4()}.pdf"
        output_path = os.path.join(output_dir, filename)

        # Ensure output directory exists (though /tmp usually does)
        os.makedirs(output_dir, exist_ok=True)

        # Sanitize content before conversion
        sanitized_content = self._sanitize_markdown(markdown_content)

        try:
            # Use xelatex which has better Unicode support
            pypandoc.convert_text(
                sanitized_content,
                "pdf",
                format="md",
                outputfile=output_path,
                extra_args=[
                    "--pdf-engine=xelatex",
                    "--variable",
                    "geometry:margin=1in",
                    "--toc",
                ],
            )
            return output_path
        except RuntimeError as e:
            print(f"Pandoc conversion error: {e}")
            raise e
