"""
Web Agent — Fetches real-time information from the internet
using requests + BeautifulSoup. Summarizes web content with the LLM.
"""

import logging
import asyncio
from typing import List

from agents.base_agent import BaseAgent, AgentTask, AgentResult

logger = logging.getLogger(__name__)


class WebAgent(BaseAgent):
    """
    Responsible for real-time internet data retrieval.
    Uses requests + BeautifulSoup to search and extract web content.
    """

    def __init__(self, ai_engine):
        super().__init__()
        self.ai_engine = ai_engine
        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        }

    @property
    def name(self) -> str:
        return "Web Agent"

    @property
    def description(self) -> str:
        return "Fetches real-time information from the internet via web scraping"

    @property
    def capabilities(self) -> List[str]:
        return ["web_search", "web_scraping", "real_time_data", "url_extraction"]

    async def _fetch_url(self, url: str) -> str:
        """Fetch and extract text content from a URL."""
        try:
            import requests
            from bs4 import BeautifulSoup

            response = await asyncio.to_thread(
                requests.get, url, headers=self.headers, timeout=10
            )
            response.raise_for_status()

            soup = BeautifulSoup(response.text, "html.parser")

            # Remove script and style elements
            for tag in soup(["script", "style", "nav", "footer", "header"]):
                tag.decompose()

            text = soup.get_text(separator="\n", strip=True)
            # Limit to first 3000 chars to avoid overwhelming the LLM
            return text[:3000]

        except Exception as e:
            logger.warning(f"Failed to fetch {url}: {e}")
            return ""

    async def _search_web(self, query: str) -> List[dict]:
        """
        Perform a basic web search using DuckDuckGo HTML.
        Returns list of {"title", "url", "snippet"}.
        """
        try:
            import requests
            from bs4 import BeautifulSoup

            search_url = "https://html.duckduckgo.com/html/"
            data = {"q": query}

            response = await asyncio.to_thread(
                requests.post, search_url, data=data, headers=self.headers, timeout=10
            )
            response.raise_for_status()

            soup = BeautifulSoup(response.text, "html.parser")
            results = []

            for result_div in soup.select(".result")[:5]:  # Top 5 results
                title_tag = result_div.select_one(".result__title a")
                snippet_tag = result_div.select_one(".result__snippet")

                if title_tag:
                    title = title_tag.get_text(strip=True)
                    url = title_tag.get("href", "")
                    snippet = snippet_tag.get_text(strip=True) if snippet_tag else ""
                    results.append({"title": title, "url": url, "snippet": snippet})

            return results

        except Exception as e:
            logger.error(f"Web search failed: {e}")
            return []

    async def execute(self, task: AgentTask) -> AgentResult:
        """Search the web and summarize findings."""
        query = task.query
        max_results = task.parameters.get("max_results", 3)

        import time
        start_time = time.time()
        
        # Step 1: Search the web
        search_results = await self._search_web(query)

        if not search_results:
            return AgentResult(
                agent_name=self.name,
                task_id=task.task_id,
                content="Unable to retrieve web results. The internet may be unavailable.",
                confidence=0.1,
                metadata={"results_found": 0, "execution_time": time.time() - start_time},
            )

        # Step 2: Fetch content from top results
        fetched_content = []
        sources = []
        for result in search_results[:max_results]:
            url = result["url"]
            if url and url.startswith("http"):
                content = await self._fetch_url(url)
                if content:
                    fetched_content.append(
                        f"[{result['title']}] ({url})\n{content[:1500]}"
                    )
                    sources.append(url)
                else:
                    fetched_content.append(
                        f"[{result['title']}] ({url})\n{result['snippet']}"
                    )
                    sources.append(url)

        combined = "\n\n---\n\n".join(fetched_content)

        # Step 3: Summarize with LLM
        prompt = (
            f"Based on the following web search results, provide a clear and "
            f"up-to-date answer to the query.\n\n"
            f"Query: {query}\n\n"
            f"Web results:\n{combined}\n\n"
            f"Provide a concise, factual summary based on the web results above."
        )

        try:
            summary = await self.ai_engine.chat(
                prompt,
                temperature=0.3,
                max_tokens=1024,
            )
        except Exception as e:
            logger.warning(f"LLM summarization failed in web agent, using combined content: {e}")
            summary = combined

        execution_time = time.time() - start_time
        # Rough token estimation if real count isn't available
        tokens = len(prompt.split()) + len(summary.split())

        return AgentResult(
            agent_name=self.name,
            task_id=task.task_id,
            content=summary,
            sources=sources,
            confidence=0.7,
            metadata={
                "results_found": len(search_results),
                "pages_fetched": len(fetched_content),
                "execution_time": execution_time,
                "tokens_used": tokens,
                "speed": tokens / execution_time if execution_time > 0 else 0
            },
        )
