# Generated migration for adding API source tracking to shipments

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('shipments', '0002_routesession_routetracking_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='shipment',
            name='api_source',
            field=models.CharField(
                blank=True,
                help_text='Source of the API call that created this shipment (e.g., printo_api_key_2024, external_system_key_1)',
                max_length=100,
                null=True
            ),
        ),
        migrations.AddIndex(
            model_name='shipment',
            index=models.Index(fields=['api_source'], name='shipments_shipment_api_source_idx'),
        ),
        migrations.AddIndex(
            model_name='shipment',
            index=models.Index(fields=['api_source', 'created_at'], name='shipments_shipment_api_source_created_at_idx'),
        ),
    ]