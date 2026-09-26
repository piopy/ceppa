import json
import os
import uuid
import logging
from openai import AsyncOpenAI
import httpx
from app.core.config import settings
from app.core.security import decrypt_value
from typing import Optional

logger = logging.getLogger(__name__)

# Evita 400 "Multiple credentials" verso Google: openai non deve ereditare credenziali Google.
_CRED_VARS = (
    "OPENAI_API_KEY",
    "OPENAI_BASE_URL",
    "GOOGLE_API_KEY",
    "GOOGLE_APPLICATION_CREDENTIALS",
    "GOOGLE_CLOUD_PROJECT",
    "GCLOUD_PROJECT",
    "CLOUDSDK_AUTH_ACCESS_TOKEN",
    "GOOGLE_OAUTH_ACCESS_TOKEN",
)
for _var in _CRED_VARS:
    os.environ.pop(_var, None)
os.environ["NO_GCE_CHECK"] = "true"
os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "false"


def _get_client(user=None) -> AsyncOpenAI:
    if user and getattr(user, "custom_openai_api_key", None):
        api_key = decrypt_value(user.custom_openai_api_key)
        base_url = (
            getattr(user, "custom_openai_base_url", None) or settings.OPENAI_BASE_URL
        )
    else:
        api_key = settings.OPENAI_API_KEY
        base_url = settings.OPENAI_BASE_URL
    # opencode zen/go: routing efficiente vuole sessione stabile + user agent proprio
    # https://opencode.ai/docs/go/#where-can-i-use-it
    headers = None
    if base_url and "opencode.ai/zen/go" in base_url:
        headers = {"x-opencode-session": _SESSION_ID, "user-agent": "ceppa/1.0"}
    return AsyncOpenAI(api_key=api_key, base_url=base_url, default_headers=headers)


# Sessione stabile per boot (prompt caching + routing zen/go)
_SESSION_ID = uuid.uuid4().hex

# Modelli serviti via Responses API su zen/go (non chat/completions)
_RESPONSES_PREFIXES = ("muse-spark-",)


async def _complete(user, messages: list, temperature: float = 0.7, max_tokens: int = None) -> str:
    """Testo risposta via chat o Responses API (zen/go + muse-spark)."""
    client = _get_client(user)
    model = _get_model(user)
    if "opencode.ai/zen/go" in str(client.base_url) and model.startswith(_RESPONSES_PREFIXES):
        kwargs = {"model": model, "input": messages, "temperature": temperature}
        if max_tokens:
            kwargs["max_output_tokens"] = max_tokens
        response = await client.responses.create(**kwargs)
        return response.output_text.strip()
    kwargs = {"model": model, "messages": messages, "temperature": temperature}
    if max_tokens:
        kwargs["max_tokens"] = max_tokens
    response = await client.chat.completions.create(**kwargs)
    return response.choices[0].message.content.strip()


def _get_model(user=None) -> str:
    """Get LLM model - uses user's custom model if available, otherwise global default."""
    if user and getattr(user, "custom_llm_model", None):
        return user.custom_llm_model
    return settings.LLM_MODEL


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
        user=None,
    ) -> str:
        lang_instruction = LLMService._get_language_instruction(language)

        # Get web context if requested
        web_context = ""
        if use_web_research:
            from app.services.tavily_service import TavilyService

            tavily = TavilyService.for_user(user)
            web_context_result = await tavily.search_for_course_context(topic, language)
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
        Act as an expert curriculum designer. Create a comprehensive and detailed course syllabus for the topic: "{topic}".
        {lang_instruction}

        {web_context}

        {f"Additional User Instructions: {instructions}" if instructions else ""}

        STRUCTURE (no example provided on purpose: tailor the breakdown to THIS topic, not to a template):
        - At least 5 modules, at least 4 lessons each (20+ lessons total for a normal topic; more if the topic is vast).
        - Progression: fundamentals first, then practice, then advanced topics. Each module harder than the previous.
        - Every module MUST contain: core concepts, at least one hands-on/applied lesson, common mistakes or pitfalls.
        - The last module MUST be a capstone: a real end-to-end project or synthesis, not a summary.
        - Banned filler lessons: generic "Introduction", "Conclusion", "Overview", "Summary" as standalone lessons
          (fold intro material into the first real lesson, synthesis into the capstone).
        - Lesson titles specific and non-overlapping: a reader must tell lessons apart by title alone.
        - Paths are hierarchical numbers: module N uses "N.1", "N.2", ...

        The output MUST be a valid JSON array. Shape only (keys and types):
        [{{"title": str, "lessons": [{{"title": str, "path": str}}]}}]

        Provide ONLY the JSON output. Do not include markdown formatting (like ```json), just the raw JSON.
        """

        content = await _complete(
            user, [{"role": "user", "content": prompt}], max_tokens=4000
        )

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
        user=None,
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
            from app.services.tavily_service import TavilyService

            tavily = TavilyService.for_user(user)
            web_context_result = await tavily.search_for_lesson_context(
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

        content = await _complete(user, [{"role": "user", "content": prompt}])

        return content

    @staticmethod
    async def answer_lab_question(
        lab_title: str,
        lab_theory: str,
        lab_steps: str,
        question: str,
        language: str = "en",
        user=None,
        history: list = None,
    ) -> str:
        """
        Answer a user question about a specific lab using lab context.
        history: lista {role, content} ultimi turni chat.
        """
        lang_instruction = LLMService._get_language_instruction(language)

        # Truncate context to avoid token limits
        truncated_theory = (
            lab_theory[:3000] if len(lab_theory) > 3000 else lab_theory
        )
        truncated_steps = (
            lab_steps[:2000] if len(lab_steps) > 2000 else lab_steps
        )

        # Get web context for questions
        web_context = ""
        from app.services.tavily_service import TavilyService

        tavily = TavilyService.for_user(user)
        web_context_result = await tavily.search_for_question_context(
            question, truncated_theory[:1000], language
        )
        if web_context_result:
            web_context = web_context_result

        # History chat: ultimi 20 turni, 2000ch max
        history_block = ""
        if history:
            turns = [f"{h.get('role', 'user')}: {(h.get('content') or '')[:2000]}" for h in history[-20:]]
            history_block = "Previous conversation:\n" + "\n".join(turns) + "\n"

        prompt = f"""
        You are a helpful teaching assistant for a hands-on lab course. 
        A student is working on the lab "{lab_title}".
        {lang_instruction}

        Here is the lab theory content:
        ---
        {truncated_theory}
        ---

        Here are the practical steps:
        ---
        {truncated_steps}
        ---

        {web_context}

        {history_block}The student asks: "{question}"

        Provide a clear, educational answer based on the lab content and any current web information provided above.
        Focus on practical guidance and helping the student complete the lab exercises.
        If the question is not related to the lab topic, politely redirect them to ask questions about the lab.
        Keep your answer concise (2-3 paragraphs maximum).
        Use markdown formatting where appropriate.
        
        IMPORTANT CITATION RULES:
        - If you used web sources to answer, add a "**Fonti:**" section at the END of your answer
        - List each source used with format: [Title](URL)
        - Only cite sources you actually used in your answer
        - If no web sources were used, don't add the Fonti section
        """

        content = await _complete(user, [{"role": "user", "content": prompt}])

        return content

    @staticmethod
    async def generate_hands_on_course_index(
        topic: str,
        instructions: str = None,
        language: str = "en",
        use_web_research: bool = False,
        user=None,
        target_level: str = None,
    ) -> str:
        """
        Indice corso lab v2: spine project + mode tiers (foundation->applied->challenge).
        Output: {"spine_project": {...}, "modules": [...]} — vedi roadmap_service.demo per formato.
        """
        lang_instruction = LLMService._get_language_instruction(language)

        web_context = ""
        if use_web_research:
            from app.services.tavily_service import TavilyService

            tavily = TavilyService.for_user(user)
            web_context_result = await tavily.search_for_course_context(topic, language)
            if web_context_result:
                web_context = web_context_result

        prompt = f"""
        Act as an expert hands-on instructor. Design a LABORATORY course for: "{topic}".
        {lang_instruction}

        {web_context}

        {f"Additional User Instructions: {instructions}" if instructions else ""}
        {f"Target audience level: {target_level} (beginner|intermediate|advanced). Start one notch below it, end one notch above." if target_level else ""}

        CORE DESIGN (mandatory):
        1. SPINE PROJECT: every lab is a ticket on ONE evolving real project, not isolated snippets.
           Define "spine_project" with title, final_deliverable (what the student ships at the end),
           tech_stack (real tools, pinned versions where it matters).
        2. FADED GUIDANCE: modules regress foundation -> applied -> challenge.
           Early labs are "guided" (full instructions), later ones "challenge" (objective + acceptance
           criteria + revealable hints only). Same project, less hand-holding over time.
        3. SETUP ONCE: environment setup lives in the FIRST lab that needs it ("setup_required": true).
           Later labs assume the environment is ready and only add increments ("increment": what this lab adds).
        4. NO TRIVIAL TASKS: every lab ships a "deliverable" plus "acceptance_criteria" (checkable outcomes).
           Banned as deliverables: creating empty files, mkdir/cd only, echo-to-file, print hello-world.
           Each lab MUST advance the spine project.

        The output MUST be valid JSON with this exact shape:
        {{
            "spine_project": {{
                "title": "Real project name",
                "final_deliverable": "What the student ships",
                "tech_stack": ["tool1", "tool2"]
            }},
            "modules": [
                {{
                    "title": "Module 1: Foundations",
                    "level": "foundation",
                    "concepts": ["concept1", "concept2"],
                    "labs": [
                        {{"title": "Lab title", "path": "1.1", "type": "theory", "mode": "guided",
                          "difficulty": 1, "objective": "One-line goal",
                          "prerequisites": [], "setup_required": true,
                          "deliverable": "Concrete artifact",
                          "acceptance_criteria": ["Checkable outcome 1"],
                          "increment": "What this lab adds to the spine project"}}
                    ]
                }}
            ]
        }}
        Levels allowed: "foundation", "applied", "challenge". Types: "theory", "lab". Modes: "guided", "challenge".
        Difficulty: 1-5, rising across the course. Theory labs introduce concepts; practice labs advance the spine.

        Provide ONLY the JSON output. No markdown formatting, just raw JSON.
        """

        content = await _complete(user, [{"role": "user", "content": prompt}])

        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]

        return content.strip()

    @staticmethod
    async def generate_lab_content(
        topic: str,
        lab_title: str,
        context_index: str,
        language: str = "en",
        use_web_research: bool = False,
        user=None,
        mode: str = "guided",
        spine_project: dict = None,
        prerequisites: list = None,
        setup_already_done: bool = False,
        feedback: str = None,
    ) -> str:
        """
        Contenuto lab v2: wrapper {mode, objective, setup, steps[], deliverable, reflection}.
        Step: instructions (solo guided), acceptance_criteria, hints. Challenge = niente instructions.
        """
        lang_instruction = LLMService._get_language_instruction(language).replace(
            "Respond", "Write the lab"
        )

        web_context = ""
        if use_web_research:
            from app.services.tavily_service import TavilyService

            tavily = TavilyService.for_user(user)
            web_context_result = await tavily.search_for_lesson_context(
                topic, lab_title, language
            )
            if web_context_result:
                web_context = web_context_result

        prompt = f"""
        Act as an expert hands-on instructor. Create a practical LAB session for the course "{topic}" on: "{lab_title}".
        {lang_instruction}

        Course context (index):
        {context_index}

        {web_context}

        Lab mode: "{mode}" (guided|challenge).
        {f"Spine project: {spine_project}. This lab is one ticket on it: state the increment it adds." if spine_project else ""}
        {f"Prerequisites (already done by the student): {prerequisites}." if prerequisites else ""}
        {f"Setup already done: environment is ready, do NOT repeat setup steps." if setup_already_done else "Setup NOT done yet: include a minimal setup section if the lab needs it."}
        {f"Student feedback on previous version (MUST address): {feedback}" if feedback else ""}

        RULES:
        - Guided: every step has full "instructions" (commands to type, files to write, what to observe).
        - Challenge: NO "instructions" — only objective, per-step acceptance_criteria, and revealable "hints".
        - Every step has checkable "acceptance_criteria". Deliverable = real artifact advancing the spine.
        - BANNED as tasks: "mkdir X && cd X", "echo ... > file" as the deliverable, hello-world prints,
          re-explaining setup done in previous labs.

        GOOD example (real task):
        {{"step_number": 1, "title": "Add JSON export to the CLI",
          "instructions": "Open cli.py, add --format json using argparse...",
          "description": "Users need machine-readable output.",
          "command": "python cli.py --format json > out.json",
          "expected_output": "Valid JSON file out.json",
          "acceptance_criteria": ["out.json parses with json.load", "exit code 0 on empty input"],
          "hints": ["argparse choices=['table','json']"]}}

        BAD example (never do this):
        {{"title": "Setup the Environment", "command": "mkdir lab-project && cd lab-project",
          "expected_output": "Directory created successfully"}}

        Output VALID JSON object, exact shape:
        {{
            "mode": "{mode}",
            "objective": "One-line goal",
            "setup": {{"needed": true, "description": "...", "commands": ["..."]}},
            "theory_content": "Concise markdown theory (max 30%)",
            "steps": [ ... 5-8 steps as above ... ],
            "deliverable": "Concrete artifact",
            "reflection": ["Question 1 for the student"]
        }}

        Provide ONLY the JSON output. No markdown formatting. No extra text.
        Make sure the steps are realistic and the commands are correct for the topic.
        """

        content = await _complete(user, [{"role": "user", "content": prompt}])

        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]

        return content.strip()

    @staticmethod
    async def answer_lesson_question(
        lesson_title: str,
        lesson_content: str,
        question: str,
        language: str = "en",
        user=None,
        history: list = None,
    ) -> str:
        """
        Answer a user question about a specific lesson using lesson context.
        history: lista {role, content} ultimi turni chat (costo token limitato).
        Uses Tavily to get current information if relevant.
        """
        lang_instruction = LLMService._get_language_instruction(language)

        # Limit context to avoid token limits (keep first 4000 chars)
        truncated_content = (
            lesson_content[:4000] if len(lesson_content) > 4000 else lesson_content
        )

        # ALWAYS try to get web context for questions (good for current events)
        web_context = ""
        from app.services.tavily_service import TavilyService

        tavily = TavilyService.for_user(user)
        web_context_result = await tavily.search_for_question_context(
            question, truncated_content[:1000], language
        )
        if web_context_result:
            web_context = web_context_result

        # History chat: ultimi 20 turni, 2000ch max (single-user: costo ok)
        history_block = ""
        if history:
            turns = [f"{h.get('role', 'user')}: {(h.get('content') or '')[:2000]}" for h in history[-20:]]
            history_block = "Previous conversation:\n" + "\n".join(turns) + "\n"

        prompt = f"""
        You are a helpful teaching assistant. A student is studying the lesson "{lesson_title}".
        {lang_instruction}

        Here is the lesson content:
        ---
        {truncated_content}
        ---

        {web_context}

        {history_block}The student asks: "{question}"

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

        content = await _complete(user, [{"role": "user", "content": prompt}])

        return content
