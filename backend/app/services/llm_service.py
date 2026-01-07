import json
from openai import AsyncOpenAI
from app.core.config import settings

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, base_url=settings.OPENAI_BASE_URL)


class LLMService:
    @staticmethod
    def _get_language_instruction(language: str) -> str:
        """Get language instruction based on language code."""
        language_names = {
            "it": "Italian",
            "en": "English",
            "es": "Spanish",
            "fr": "French",
            "de": "German",
            "pt": "Portuguese",
            "ru": "Russian",
            "zh": "Chinese",
            "ja": "Japanese",
            "ar": "Arabic",
        }
        lang_name = language_names.get(language, language.upper())
        return f"Respond in {lang_name}."

    @staticmethod
    async def generate_course_index(
        topic: str, instructions: str = None, language: str = "en"
    ) -> str:
        lang_instruction = LLMService._get_language_instruction(language)
        prompt = f"""
        Act as an expert curriculum designer. create a comprehensive and detailed course syllabus for the topic: "{topic}".
        {lang_instruction}
        
        {f"Additional User Instructions: {instructions}" if instructions else ""}

        The output MUST be a valid JSON array of Modules. Each Module has a "title" and a list of "lessons".
        Each Lesson has a "title" and a "path". The path should be a hierarchical number string (e.g. "1.1", "1.2").
        
        Example JSON format:
        [
            {{
                "title": "Module 1: Introduction",
                "lessons": [
                    {{"title": "What is {topic}?", "path": "1.1"}},
                    {{"title": "Setup and Installation", "path": "1.2"}}
                ]
            }}
        ]
        
        Provide ONLY the JSON output. Do not include markdown formatting (like ```json), just the raw JSON.
        Make the course deep and comprehensive.
        """

        response = await client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )

        content = response.choices[0].message.content.strip()
        # Simple cleanup if the LLM wraps in code blocks despite instructions
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]

        return content.strip()

    @staticmethod
    async def generate_lesson_content(
        topic: str,
        lesson_title: str,
        context_index: str,
        language: str = "en",
        feedback: str = None,
    ) -> str:
        lang_instruction = LLMService._get_language_instruction(language).replace(
            "Respond", "Write the lesson"
        )

        feedback_instruction = ""
        if feedback:
            feedback_instruction = f"\n\nIMPORTANT: The user provided this feedback about the previous version:\n{feedback}\nPlease address these concerns and improve the lesson accordingly."

        prompt = f"""
        Act as an expert instructor. Write a comprehensive lesson for the course "{topic}" on the specific lesson: "{lesson_title}".
        {lang_instruction}
        
        The course context (index) is:
        {context_index}
        
        Your output should be detailed, educational Markdown.
        Structure:
        1. Title
        2. Introduction
        3. Core Concepts (use subsections)
        4. Examples (code blocks or practical examples)
        5. Exercises (A section with 3-5 practical exercises or questions for the student to solve offline).
        
        Do not use LaTeX math delimiters like \\(. Use standard markdown.
        Make it engaging and clear.{feedback_instruction}
        """

        response = await client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )

        return response.choices[0].message.content.strip()
