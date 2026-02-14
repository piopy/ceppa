"""
Tavily Web Search Service
Provides web research capabilities with graceful error handling.
"""

import logging
from typing import Optional, Dict, Any
from tavily import TavilyClient
from app.core.config import settings

logger = logging.getLogger(__name__)


class TavilyService:
    """
    Service for web research using Tavily API.
    Handles quota limits gracefully - if search fails, returns empty context.
    """

    def __init__(self):
        self.enabled = getattr(settings, "TAVILY_ENABLED", False)
        self.api_key = getattr(settings, "TAVILY_API_KEY", None)
        self.credit_threshold = getattr(settings, "TAVILY_CREDIT_THRESHOLD", 50)

        if self.enabled and self.api_key:
            try:
                self.client = TavilyClient(api_key=self.api_key)
            except Exception as e:
                logger.warning(f"Failed to initialize Tavily client: {e}")
                self.enabled = False
        else:
            self.client = None

    def _check_credits(self) -> bool:
        """
        Check if we have enough credits remaining.
        Returns True if we can proceed, False if below threshold.
        """
        if not self.enabled or not self.client:
            return False

        try:
            # Note: Tavily SDK doesn't have built-in usage check
            # We'll implement this if needed, for now assume we can proceed
            # In production, you'd call the /usage API endpoint here
            return True
        except Exception as e:
            logger.warning(f"Failed to check Tavily credits: {e}")
            return False

    async def get_credits_info(self) -> Dict[str, Any]:
        """
        Get current Tavily API usage and credits remaining.
        Returns dict with usage info or error message.
        """
        if not self.enabled or not self.api_key:
            return {
                "enabled": False,
                "error": "Tavily is not enabled or API key not configured",
            }

        try:
            import httpx

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://api.tavily.com/usage",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    timeout=5.0,
                )

                if response.status_code == 200:
                    data = response.json()
                    # Extract usage info from response
                    # Expected structure: {"key": {"usage": X, "limit": Y}, "account": {...}}
                    key_info = data.get("key", {})
                    usage = key_info.get("usage", 0)
                    limit = key_info.get("limit")

                    # If limit is None, assume free tier limit of 1000
                    if limit is None:
                        limit = 1000

                    return {
                        "enabled": True,
                        "usage": usage,
                        "limit": limit,
                        "remaining": limit - usage,
                    }
                else:
                    logger.warning(
                        f"Failed to fetch Tavily usage: HTTP {response.status_code}"
                    )
                    return {
                        "enabled": True,
                        "error": f"API returned status {response.status_code}",
                    }
        except Exception as e:
            logger.warning(f"Failed to fetch Tavily credits: {e}")
            return {"enabled": True, "error": str(e)}

    async def search_for_course_context(
        self, topic: str, language: str = "en"
    ) -> Optional[str]:
        """
        Search web for context to enrich course index generation.

        Args:
            topic: The course topic
            language: Language code (en, it, etc.)

        Returns:
            Formatted string with search results, or None if search fails/disabled
        """
        if not self.enabled or not self._check_credits():
            logger.info(
                "Tavily search disabled or credits low - skipping course context"
            )
            return None

        # Craft search query based on language
        query_templates = {
            "en": f"{topic} comprehensive guide tutorial overview latest",
            "it": f"{topic} guida completa tutorial panoramica aggiornata",
            "es": f"{topic} guía completa tutorial visión general",
            "fr": f"{topic} guide complet tutoriel aperçu",
            "de": f"{topic} umfassender Leitfaden Tutorial Überblick",
        }
        query = query_templates.get(language, query_templates["en"])

        try:
            logger.info(f"Tavily search for course: {topic} (language: {language})")
            response = self.client.search(
                query=query,
                search_depth="basic",  # 1 credit
                max_results=5,
                include_answer=False,
                include_raw_content=False,
            )

            # Format results for LLM
            results = response.get("results", [])
            if not results:
                logger.info("No Tavily results found")
                return None

            context = "\n\n--- WEB RESEARCH CONTEXT ---\n"
            context += f"(Found {len(results)} relevant sources for '{topic}')\n\n"

            for i, result in enumerate(results[:5], 1):
                context += f"{i}. **{result.get('title', 'Untitled')}**\n"
                context += f"   Source: {result.get('url', 'N/A')}\n"
                context += f"   {result.get('content', 'No content')[:500]}...\n\n"

            logger.info(
                f"Successfully retrieved {len(results)} Tavily results for course"
            )
            return context

        except Exception as e:
            # Graceful degradation: log error but don't fail the request
            logger.warning(f"Tavily search failed (likely quota exceeded): {e}")
            return None

    async def search_for_lesson_context(
        self, course_topic: str, lesson_title: str, language: str = "en"
    ) -> Optional[str]:
        """
        Search web for context to enrich lesson content generation.
        LLM will decide whether to use these sources.

        Args:
            course_topic: Overall course topic
            lesson_title: Specific lesson title
            language: Language code

        Returns:
            Formatted string with search results and citation instructions, or None
        """
        if not self.enabled or not self._check_credits():
            logger.info(
                "Tavily search disabled or credits low - skipping lesson context"
            )
            return None

        # Combine topic and lesson for better results
        query_templates = {
            "en": f"{course_topic}: {lesson_title} explained examples tutorial",
            "it": f"{course_topic}: {lesson_title} spiegazione esempi tutorial",
            "es": f"{course_topic}: {lesson_title} explicación ejemplos tutorial",
            "fr": f"{course_topic}: {lesson_title} explication exemples tutoriel",
            "de": f"{course_topic}: {lesson_title} Erklärung Beispiele Tutorial",
        }
        query = query_templates.get(language, query_templates["en"])

        try:
            logger.info(f"Tavily search for lesson: {lesson_title}")
            response = self.client.search(
                query=query,
                search_depth="advanced",  # basic 1 credit, advanced 2 credits
                max_results=5,
                include_answer=False,
                include_raw_content=False,
            )

            results = response.get("results", [])
            if not results:
                return None

            # Format with citation instructions for LLM
            context = "\n\n--- WEB SOURCES (Optional - Use if relevant) ---\n"
            context += (
                "IMPORTANT: If you use information from these sources, you MUST:\n"
            )
            context += "1. Add a '## Sources & Further Reading' section at the END of the lesson\n"
            context += "2. List each source with title and URL in markdown format\n"
            context += "3. Only cite sources you actually used\n\n"

            for i, result in enumerate(results[:5], 1):
                title = result.get("title", "Untitled")
                url = result.get("url", "N/A")
                content = result.get("content", "No content")  # [:500]

                context += f"{i}. **{title}**\n"
                context += f"   URL: {url}\n"
                context += f"   Content: {content}...\n\n"

            logger.info(
                f"Successfully retrieved {len(results)} Tavily results for lesson"
            )
            return context

        except Exception as e:
            logger.warning(f"Tavily search failed for lesson: {e}")
            return None

    async def search_for_question_context(
        self, question: str, lesson_context: str, language: str = "en"
    ) -> Optional[str]:
        """
        Search web to answer student question with current information.
        Useful for questions about recent events, latest updates, etc.

        Args:
            question: Student's question
            lesson_context: Context from the lesson (first 1000 chars)
            language: Language code

        Returns:
            Formatted string with search results, or None
        """
        if not self.enabled or not self._check_credits():
            logger.info(
                "Tavily search disabled - answering question without web context"
            )
            return None

        # Use the question directly, optionally enhanced with lesson context
        query = question

        try:
            logger.info(f"Tavily search for question: {question[:100]}...")
            response = self.client.search(
                query=query,
                search_depth="basic",  # 1 credit
                max_results=3,
                include_answer="basic",  # Get a quick answer from Tavily
                include_raw_content=False,
            )

            # Include both Tavily's answer and sources
            context = "\n\n--- CURRENT WEB INFORMATION ---\n"

            # Add Tavily's generated answer if available
            tavily_answer = response.get("answer")
            if tavily_answer:
                context += f"Quick Answer: {tavily_answer}\n\n"

            # Add sources with citation format instructions
            results = response.get("results", [])
            if results:
                context += (
                    "Sources (if used, cite them in a 'Fonti' section at the end):\n"
                )
                for i, result in enumerate(results[:3], 1):
                    title = result.get("title", "Untitled")
                    url = result.get("url", "N/A")
                    content = result.get("content", "")
                    context += f"{i}. {title}\n"
                    context += f"   URL: {url}\n"
                    context += f"   {content[:300]}...\n\n"

            logger.info(f"Successfully retrieved web context for question")
            return context

        except Exception as e:
            logger.warning(f"Tavily search failed for question: {e}")
            return None


# Singleton instance
tavily_service = TavilyService()
