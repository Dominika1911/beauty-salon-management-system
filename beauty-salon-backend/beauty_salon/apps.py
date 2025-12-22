from django.apps import AppConfig


class BeautySalonConfig(AppConfig):
    """
    Konfiguracja aplikacji salonu kosmetycznego.
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'beauty_salon'
    verbose_name = 'Salon Kosmetyczny'

    def ready(self):
        """
        Metoda wywoływana gdy aplikacja jest gotowa.
        Importujemy sygnały, żeby były zarejestrowane.
        """
        import beauty_salon.signals