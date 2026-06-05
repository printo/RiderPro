from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Tidy-up to reconcile the hand-written 0005 migration with what Django's
    autodetector expects: rename the two indexes to Django's standard names and
    normalise the id field. Index renames + id alter are no-op-safe on the data.
    """

    dependencies = [
        ('authentication', '0005_vehiclechangerequest'),
    ]

    operations = [
        migrations.RenameIndex(
            model_name='vehiclechangerequest',
            new_name='vehicle_cha_status_4270be_idx',
            old_name='vcr_status_created',
        ),
        migrations.RenameIndex(
            model_name='vehiclechangerequest',
            new_name='vehicle_cha_rider_i_6cc40e_idx',
            old_name='vcr_rider_status',
        ),
        migrations.AlterField(
            model_name='vehiclechangerequest',
            name='id',
            field=models.AutoField(primary_key=True, serialize=False),
        ),
    ]
