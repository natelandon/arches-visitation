import requests
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

OLLAMA_API_URL = "http://localhost:11434/api/generate"
DEFAULT_MODEL = "mistral"

class OllamaService:
    """Service for interacting with Ollama local LLM"""
    
    @staticmethod
    def is_available() -> bool:
        """Check if Ollama service is available"""
        try:
            response = requests.get("http://localhost:11434/api/tags", timeout=2)
            return response.status_code == 200
        except Exception as e:
            logger.warning(f"Ollama service not available: {e}")
            return False
    
    @staticmethod
    def explain_annual_trends(data: dict) -> str:
        """Generate explanation for annual visitation trends"""
        prompt = f"""
Analyze this annual visitation data for Arches National Park and provide a brief, insightful explanation (2-3 sentences):

Data: {json.dumps(data, indent=2)}

Focus on:
- Overall trend direction (increasing/decreasing)
- Notable peaks or drops
- Year-over-year changes

Keep explanation concise and accessible to park visitors."""
        
        return OllamaService._call_ollama(prompt)
    
    @staticmethod
    def explain_monthly_breakdown(data: dict, month: str, year: int) -> str:
        """Generate explanation for monthly breakdown"""
        prompt = f"""
Explain why {month} {year} had these visitation statistics for Arches National Park (1-2 sentences):

Data: {json.dumps(data, indent=2)}

Consider:
- How this month ranks compared to others
- Possible seasonal factors (weather, holidays, school schedules)
- Notable increases or decreases

Keep explanation brief and insightful."""
        
        return OllamaService._call_ollama(prompt)
    
    @staticmethod
    def explain_heatmap_patterns(data: dict) -> str:
        """Generate explanation for heatmap patterns"""
        prompt = f"""
Analyze this heatmap data showing monthly visitation patterns across years and identify key patterns (2-3 sentences):

Data: {json.dumps(data, indent=2)}

Highlight:
- Seasonal patterns
- Years with unusual visitation
- Most and least busy months

Keep explanation concise."""
        
        return OllamaService._call_ollama(prompt)
    
    @staticmethod
    def explain_monthly_rank(data: dict, month: str, rank: int) -> str:
        """Generate explanation for monthly ranking"""
        prompt = f"""
Explain this monthly ranking for Arches National Park in one sentence:

{month} was the #{rank} busiest month with {data.get('visitors', 0):,} visitors.

Consider seasonal factors and make it interesting for park visitors."""
        
        return OllamaService._call_ollama(prompt)
    
    @staticmethod
    def _call_ollama(prompt: str, model: str = DEFAULT_MODEL) -> str:
        """Make request to Ollama API"""
        try:
            response = requests.post(
                OLLAMA_API_URL,
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False
                },
                timeout=120
            )
            
            if response.status_code == 200:
                result = response.json()
                return result.get("response", "Unable to generate explanation").strip()
            else:
                logger.error(f"Ollama API error: {response.status_code}")
                return "Unable to generate explanation at this time."
                
        except requests.exceptions.ConnectionError:
            logger.warning("Could not connect to Ollama service")
            return "AI explanation service is not available. Please ensure Ollama is running."
        except requests.exceptions.Timeout:
            logger.warning("Ollama request timeout")
            return "Explanation generation timed out. Please try again."
        except Exception as e:
            logger.error(f"Error calling Ollama: {e}")
            return "Error generating explanation. Please try again."
