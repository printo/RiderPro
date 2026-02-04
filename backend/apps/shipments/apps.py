from django.apps import AppConfig


class ShipmentsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.shipments'
    
    def ready(self):
        """
        Import signals when the app is ready
        """
        import apps.shipments.signals
