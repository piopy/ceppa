import os
from openai import OpenAI
from dotenv import load_dotenv

from .prompts import prompt
from .search_service import SearchService

load_dotenv()


class LLMService:
    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.base_url = os.getenv(
            "OPENAI_BASE_URL",
            "https://generativelanguage.googleapis.com/v1beta/openai/",
        )
        self.llm_model = os.getenv("OPENAI_MODEL", "gemini-3-pro-preview")
        self.client = OpenAI(api_key=self.api_key, base_url=self.base_url)
        self.search_service = SearchService()

    def generate_learning_content(
        self, topic: str, custom_instructions: str = None
    ) -> str:
        """
        Generates comprehensive learning content about the topic in Markdown format.
        """
        system_prompt = prompt

        # Perform web search to get context
        search_context = self.search_service.search(topic)

        user_prompt = f"""
        Argomento richiesto: {topic}
        
        Contesto aggiornato dal web (usa queste informazioni se rilevanti per arricchire la guida):
        {search_context}
        
        Approfondisci l'argomento creando la guida come richiesto.
        """

        if custom_instructions and custom_instructions.strip():
            user_prompt += f"""
            
            ISTRUZIONI AGGIUNTIVE DELL'UTENTE (Seguile scrupolosamente):
            {custom_instructions}
            """

        try:
            response = self.client.chat.completions.create(
                model=self.llm_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"Error calling LLM: {e}")
            raise e
