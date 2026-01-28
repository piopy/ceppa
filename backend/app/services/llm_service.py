import json
from openai import AsyncOpenAI
from app.core.config import settings
from typing import Optional

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
        topic: str,
        instructions: str = None,
        language: str = "en",
        use_web_research: bool = False,
    ) -> str:
        lang_instruction = LLMService._get_language_instruction(language)

        # Get web context if requested
        web_context = ""
        if use_web_research:
            from app.services.tavily_service import tavily_service

            web_context_result = await tavily_service.search_for_course_context(
                topic, language
            )
            if web_context_result:
                import logging

                logging.info("Web research for course index successful")
                web_context = web_context_result
            else:
                # Log that web research was requested but unavailable
                import logging

                logging.info(
                    "Web research requested but Tavily returned no results or is disabled"
                )

        prompt = f"""
        Act as an expert curriculum designer. create a comprehensive and detailed course syllabus for the topic: "{topic}".
        {lang_instruction}
        
        {web_context}
        
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
        use_web_research: bool = False,
    ) -> str:
        lang_instruction = LLMService._get_language_instruction(language).replace(
            "Respond", "Write the lesson"
        )

        feedback_instruction = ""
        if feedback:
            feedback_instruction = f"\n\nIMPORTANT: The user provided this feedback about the previous version:\n{feedback}\nPlease address these concerns and improve the lesson accordingly."

        # Get web context only if requested
        web_context = ""
        if use_web_research:
            from app.services.tavily_service import tavily_service

            web_context_result = await tavily_service.search_for_lesson_context(
                topic, lesson_title, language
            )
            if web_context_result:
                import logging

                logging.info("Web research for lesson content successful")
                web_context = web_context_result

        prompt = f"""
        Act as an expert instructor. Write a comprehensive lesson for the course "{topic}" on the specific lesson: "{lesson_title}".
        {lang_instruction}
        
        The course context (index) is:
        {context_index}
        
        {web_context}
        
        Your output should be detailed, educational Markdown.
        Structure:
        1. Title
        2. Introduction
        3. Core Concepts (use subsections)
        4. Examples (code blocks or practical examples)
        5. Exercises (A section with 3-5 practical exercises or questions for the student to solve offline).
        
        IMPORTANT CITATION RULES:
        - If you used information from the web sources above, you MUST add a final section: "## Sources & Further Reading"
        - List each source you referenced with: [Title](URL)
        - Only cite sources you actually used in the lesson content
        - If you didn't use web sources, don't add the Sources section
        
        Do not use LaTeX math delimiters like \\(. Use standard markdown.
        Make it engaging and clear.{feedback_instruction}
        """

        response = await client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )

        return response.choices[0].message.content.strip()

    @staticmethod
    async def answer_lesson_question(
        lesson_title: str,
        lesson_content: str,
        question: str,
        language: str = "en",
    ) -> str:
        """
        Answer a user question about a specific lesson using lesson context.
        Uses Tavily to get current information if relevant.
        """
        lang_instruction = LLMService._get_language_instruction(language)

        # Limit context to avoid token limits (keep first 4000 chars)
        truncated_content = (
            lesson_content[:4000] if len(lesson_content) > 4000 else lesson_content
        )

        # ALWAYS try to get web context for questions (good for current events)
        web_context = ""
        from app.services.tavily_service import tavily_service

        web_context_result = await tavily_service.search_for_question_context(
            question, truncated_content[:1000], language
        )
        if web_context_result:
            web_context = web_context_result

        prompt = f"""
        You are a helpful teaching assistant. A student is studying the lesson "{lesson_title}".
        {lang_instruction}

        Here is the lesson content:
        ---
        {truncated_content}
        ---

        {web_context}

        The student asks: "{question}"

        Provide a clear, educational answer based on the lesson content and any current web information provided above.
        If the question is not related to the lesson, politely redirect them to ask questions about the lesson topic.
        Keep your answer concise (2-3 paragraphs maximum).
        Use markdown formatting where appropriate.
        
        IMPORTANT CITATION RULES:
        - If you used web sources to answer, add a "**Fonti:**" section at the END of your answer
        - List each source used with format: [Title](URL)
        - Only cite sources you actually used in your answer
        - If no web sources were used, don't add the Fonti section
        """

        response = await client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )

        return response.choices[0].message.content.strip()
