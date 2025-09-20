import importlib


def _reload_settings():
    # Reload the module so the singleton picks up environment changes.
    module = importlib.import_module("Backend.settings")
    importlib.reload(module)
    return module.settings


def test_settings_fallbacks_to_sqlite(tmp_path, monkeypatch):
    monkeypatch.delenv("SQLALCHEMY_DATABASE_URI", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("DB_AUTO_CREATE", raising=False)

    settings = _reload_settings()
    assert settings.database_url == "sqlite:///./nutrition.db"
    assert settings.db_auto_create is True


def test_settings_respects_provided_database_url(monkeypatch):
    monkeypatch.setenv(
        "DATABASE_URL", "postgresql://nutrition_user:nutrition_pass@db:5432/nutrition"
    )
    monkeypatch.delenv("DB_AUTO_CREATE", raising=False)

    settings = _reload_settings()
    assert settings.database_url.endswith("@db:5432/nutrition")
    assert settings.db_auto_create is False


def test_db_auto_create_can_be_overridden(monkeypatch):
    monkeypatch.delenv("SQLALCHEMY_DATABASE_URI", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("DB_AUTO_CREATE", "false")

    settings = _reload_settings()
    assert settings.database_url == "sqlite:///./nutrition.db"
    assert settings.db_auto_create is False
