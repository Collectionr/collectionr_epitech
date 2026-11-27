import pytest

from app.inference.engine import InferenceError
from app.inference.factory import create_engine
from app.inference.stub_engine import StubEngine
from tests.conftest import build_settings


def test_predict_returns_a_fake_result_without_opening_the_image() -> None:
    engine = StubEngine()
    engine.load()

    assert engine.predict("jobs/abc/input.jpg") == {
        "engine": "stub",
        "image_path": "jobs/abc/input.jpg",
    }


def test_predict_waits_for_the_configured_delay() -> None:
    waits: list[float] = []
    engine = StubEngine(delay=1.5, sleep=waits.append)

    engine.predict("jobs/abc/input.jpg")

    assert waits == [1.5]


def test_a_file_name_with_the_failure_marker_simulates_a_failure() -> None:
    with pytest.raises(InferenceError):
        StubEngine().predict("jobs/abc/fail.jpg")


def test_the_failure_marker_is_only_looked_for_in_the_file_name() -> None:
    assert StubEngine().predict("jobs/fail/input.jpg")["engine"] == "stub"


def test_factory_builds_the_engine_selected_by_the_settings() -> None:
    waits: list[float] = []
    engine = create_engine(build_settings(ocr_model="stub", ocr_stub_delay=2))

    assert isinstance(engine, StubEngine)
    assert engine.name == "stub"
    engine._sleep = waits.append
    engine.predict("jobs/abc/input.jpg")
    assert waits == [2.0]
