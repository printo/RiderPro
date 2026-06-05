from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    """Rider-raised, admin-approved vehicle change requests (governs mileage)."""

    dependencies = [
        ('vehicles', '0001_initial'),
        ('authentication', '0004_add_vehicle_type_to_rider'),
    ]

    operations = [
        migrations.CreateModel(
            name='VehicleChangeRequest',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('reason', models.TextField(blank=True, null=True)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')], default='pending', max_length=20)),
                ('reviewed_by', models.CharField(blank=True, max_length=255, null=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('current_vehicle_type', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='vehicles.vehicletype')),
                ('requested_vehicle_type', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='change_requests', to='vehicles.vehicletype')),
                ('rider', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='vehicle_change_requests', to='authentication.rideraccount')),
            ],
            options={
                'db_table': 'vehicle_change_requests',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='vehiclechangerequest',
            index=models.Index(fields=['status', '-created_at'], name='vcr_status_created'),
        ),
        migrations.AddIndex(
            model_name='vehiclechangerequest',
            index=models.Index(fields=['rider', 'status'], name='vcr_rider_status'),
        ),
    ]
