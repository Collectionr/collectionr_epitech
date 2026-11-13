import time
from collections.abc import Callable
from pathlib import PurePosixPath

from pydantic import JsonValue

from app.inference.engine import InferenceError

# An image whose file name contains this marker simulates an inference failure.
FAILURE_MARKER = "fail"


class StubEngine:
    """Fake engine: exercises the queue and the job lifecycle without any model.

    It never opens the image. It waits `delay` seconds to simulate the inference time.
    """

    name = "stub"

    def __init__(
        self, delay: float = 0.0, sleep: Callable[[float], None] = time.sleep
    ) -> None:
        self._delay = delay
        self._sleep = sleep

    def load(self) -> None:
        """Nothing to load."""

    def predict(self, image_path: str) -> dict[str, JsonValue]:
        if self._delay > 0:
            self._sleep(self._delay)
        if FAILURE_MARKER in PurePosixPath(image_path).name:
            raise InferenceError("Simulated inference failure")
        return {"engine": self.name, "image_path": image_path}
