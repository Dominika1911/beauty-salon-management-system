from django.apps import AppConfig


class BeautySalonConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "beauty_salon"
    verbose_name = "Beauty Salon"

    def ready(self) -> None:
        from . import signals  # noqa: F401
