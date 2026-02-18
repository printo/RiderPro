# Fix OrderEvent shipment ForeignKey field

from django.db import migrations, models
import django.db.models.deletion


def convert_shipment_id_to_fk(apps, schema_editor):
    """
    Convert shipment_id CharField to shipment ForeignKey
    """
    OrderEvent = apps.get_model('shipments', 'OrderEvent')
    Shipment = apps.get_model('shipments', 'Shipment')
    
    # Update existing records to have proper foreign key relationship
    for event in OrderEvent.objects.all():
        if event.shipment_id:
            try:
                # Try to convert shipment_id to integer and find the shipment
                shipment_id = int(event.shipment_id) if event.shipment_id.isdigit() else None
                if shipment_id:
                    shipment = Shipment.objects.filter(id=shipment_id).first()
                    if shipment:
                        event.shipment = shipment
                        event.save()
            except (ValueError, TypeError):
                # If conversion fails, leave shipment as null
                pass


class Migration(migrations.Migration):

    dependencies = [
        ('shipments', '0002_comprehensive_models'),
    ]

    operations = [
        # Add the shipment ForeignKey as nullable initially
        migrations.AddField(
            model_name='orderevent',
            name='shipment',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='events',
                to='shipments.shipment'
            ),
        ),
        
        # Convert existing shipment_id values to proper foreign keys
        migrations.RunPython(convert_shipment_id_to_fk),
        
        # Remove the old shipment_id field
        migrations.RemoveField(
            model_name='orderevent',
            name='shipment_id',
        ),
        
        # Make the shipment field non-nullable
        migrations.AlterField(
            model_name='orderevent',
            name='shipment',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='events',
                to='shipments.shipment'
            ),
        ),
    ]
