import asyncio
import logging
from langchain_core.messages import HumanMessage
from app.core.config import get_settings
from app.llm.provider import LLMProvider

logger = logging.getLogger(__name__)

class LlmProviderService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.provider = LLMProvider(self.settings)

    def generate(self, prompt: str) -> tuple[str, str]:
        try:
            # Run async chat query using the event loop safely
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
            response = loop.run_until_complete(
                self.provider.chat([HumanMessage(content=prompt)])
            )
            return (response.content, self.provider.model)
        except Exception as e:
            logger.exception("Failed to query Groq LLM service:")
            return (
                f"AI service error during Groq query: {str(e)}\n\n"
                "Please verify your GROQ_API_KEY environment variable configuration in the `.env` file.",
                self.provider.model
            )


llm_provider_service = LlmProviderService()
