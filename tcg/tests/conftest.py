import pytest

from tcg_service.config import Settings


class FakeDatabase:
    """Doublure de `Database` : aucune connexion réelle."""

    def __init__(self, error: Exception | None = None) -> None:
        self.error = error
        self.ping_calls = 0
        self.opened = False
        self.closed = False

    def open(self) -> None:
        self.opened = True

    def close(self) -> None:
        self.closed = True

    def ping(self) -> None:
        self.ping_calls += 1
        if self.error is not None:
            raise self.error


@pytest.fixture
def settings() -> Settings:
    return Settings(
        _env_file=None,
        app_env="dev",
        database_url="postgresql://tcg_user:s3cr3t-pwd@db.invalid:5432/tcg_db",
    )
