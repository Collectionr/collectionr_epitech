from typing import Protocol

from pydantic import JsonValue


class InferenceError(Exception):
    """The engine could not process this image.

    The message is returned to the client in the job result: keep it free of any
    internal detail (path, stack, library message).
    """


class InferenceEngine(Protocol):
    """What the worker needs from an OCR model. One implementation per model."""

    @property
    def name(self) -> str: ...

    def load(self) -> None:
        """Loads the model in memory. Called once, when the worker starts."""
        ...

    def predict(self, image_path: str) -> dict[str, JsonValue]:
        """Runs the model on one image. Raises InferenceError if it cannot."""
        ...
