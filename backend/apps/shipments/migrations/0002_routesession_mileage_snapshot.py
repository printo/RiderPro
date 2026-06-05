from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Snapshot the fuel-cost inputs onto each route session (vehicle type, fuel
    efficiency, fuel price used) so historical reimbursements stay fixed even if
    the rider's vehicle or the active fuel price changes later.
    """

    dependencies = [
        ('shipments', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='routesession',
            name='vehicle_type_used',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='routesession',
            name='fuel_efficiency_used',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='routesession',
            name='fuel_price_used',
            field=models.FloatField(blank=True, null=True),
        ),
    ]
