from ddgs import DDGS
import requests


class SearchService:
    def __init__(self):
        pass

    def search(self, query: str, max_results: int = 5) -> str:
        """
        Performs a web search using DuckDuckGo and returns formatted results.
        """
        try:
            # backend='api' is often more stable, but standard text search is default
            results = DDGS().text(query, max_results=max_results)

            if not results:
                return "Nessun risultato trovato."

            formatted_results = "Ecco alcune informazioni recenti trovate sul web:\n\n"
            for result in results:
                formatted_results += f"Titolo: {result['title']}\n"
                formatted_results += f"Link: {result['href']}\n"
                formatted_results += f"Descrizione: {result['body']}\n\n"

                body = requests.get(result["href"]).text
                formatted_results += f"Contesto: {body}\n\n"

            return formatted_results
        except Exception as e:
            print(f"Search error: {e}")
            return ""
