from app.core.config import Settings
from app.inference.engine import InferenceEngine
from app.inference.stub_engine import StubEngine


def create_engine(settings: Settings) -> InferenceEngine:
    """Builds the engine selected by OCR_MODEL. It is not loaded yet."""
    match settings.ocr_model:
        case "stub":
            return StubEngine(delay=settings.ocr_stub_delay)
