"""Native HA tests use real HA components, registries, flows and HTTP routes."""
import pytest

pytest_plugins = ("pytest_homeassistant_custom_component",)


@pytest.fixture(autouse=True)
def enable_native_custom_integration(enable_custom_integrations):
    """Allow HA's actual loader to load this repository's custom integration."""
