# Generated comprehensive migration for all shipment models

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0003_homebase_riderhomebaseassignment_and_more'),
        ('shipments', '0001_initial'),
    ]

    operations = [
        # Add PDF URL and region fields to Shipment
        migrations.AddField(
            model_name='shipment',
            name='pdf_url',
            field=models.URLField(blank=True, null=True, help_text='URL to PDF document for signature'),
        ),
        migrations.AddField(
            model_name='shipment',
            name='region',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        
        # Create Zone model
        migrations.CreateModel(
            name='Zone',
            fields=[
                ('id', models.AutoField(primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True, null=True)),
                ('boundaries', models.JSONField(blank=True, help_text='Array of [lat, lng] coordinates defining zone polygon', null=True)),
                ('center_latitude', models.FloatField(blank=True, null=True)),
                ('center_longitude', models.FloatField(blank=True, null=True)),
                ('city', models.CharField(blank=True, max_length=100, null=True)),
                ('state', models.CharField(blank=True, max_length=100, null=True)),
                ('pincode', models.CharField(blank=True, max_length=20, null=True)),
                ('max_shipments', models.IntegerField(default=50, help_text='Maximum shipments per zone per day')),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('assigned_riders', models.ManyToManyField(blank=True, related_name='zones', to='authentication.rideraccount')),
            ],
            options={
                'db_table': 'zones',
                'ordering': ['name'],
            },
        ),
        
        # Create RouteSession model
        migrations.CreateModel(
            name='RouteSession',
            fields=[
                ('id', models.CharField(max_length=255, primary_key=True, serialize=False)),
                ('employee_id', models.CharField(max_length=255)),
                ('start_latitude', models.FloatField()),
                ('start_longitude', models.FloatField()),
                ('end_latitude', models.FloatField(blank=True, null=True)),
                ('end_longitude', models.FloatField(blank=True, null=True)),
                ('current_latitude', models.FloatField(blank=True, null=True)),
                ('current_longitude', models.FloatField(blank=True, null=True)),
                ('last_updated', models.DateTimeField(blank=True, null=True)),
                ('start_time', models.DateTimeField()),
                ('end_time', models.DateTimeField(blank=True, null=True)),
                ('total_time', models.IntegerField(blank=True, null=True)),
                ('total_distance', models.FloatField(blank=True, null=True)),
                ('status', models.CharField(choices=[('active', 'Active'), ('completed', 'Completed'), ('paused', 'Paused')], default='active', max_length=20)),
                ('shipment_id', models.CharField(blank=True, max_length=255, null=True)),
            ],
            options={
                'db_table': 'route_sessions',
                'ordering': ['-start_time'],
            },
        ),
        
        # Create RouteTracking model
        migrations.CreateModel(
            name='RouteTracking',
            fields=[
                ('id', models.AutoField(primary_key=True, serialize=False)),
                ('session', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tracking_points', to='shipments.routesession')),
                ('employee_id', models.CharField(max_length=255)),
                ('latitude', models.FloatField()),
                ('longitude', models.FloatField()),
                ('timestamp', models.DateTimeField()),
                ('accuracy', models.FloatField(blank=True, null=True)),
                ('speed', models.FloatField(blank=True, null=True)),
                ('event_type', models.CharField(choices=[('gps', 'GPS'), ('pickup', 'Pickup'), ('delivery', 'Delivery'), ('break', 'Break'), ('start', 'Start'), ('end', 'End')], default='gps', max_length=20)),
                ('shipment_id', models.CharField(blank=True, max_length=255, null=True)),
            ],
            options={
                'db_table': 'route_tracking',
                'ordering': ['-timestamp'],
            },
        ),
        
        # Add homebase fields to Shipment
        migrations.AddField(
            model_name='shipment',
            name='homebase',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='shipment',
            name='homebase_slot',
            field=models.IntegerField(blank=True, null=True),
        ),
        
        # Create OrderEvent model (without foreign key initially to avoid conflicts)
        migrations.CreateModel(
            name='OrderEvent',
            fields=[
                ('id', models.AutoField(primary_key=True, serialize=False)),
                ('event_type', models.CharField(choices=[('status_change', 'Status Change'), ('pickup', 'Pickup'), ('delivery', 'Delivery'), ('assignment', 'Assignment'), ('route_start', 'Route Start'), ('route_end', 'Route End'), ('acknowledgment', 'Acknowledgment'), ('sync', 'Sync Event'), ('error', 'Error')], max_length=50)),
                ('old_status', models.CharField(blank=True, max_length=50, null=True)),
                ('new_status', models.CharField(blank=True, max_length=50, null=True)),
                ('metadata', models.JSONField(blank=True, help_text='Additional event data', null=True)),
                ('triggered_by', models.CharField(blank=True, help_text='User or system that triggered the event', max_length=255, null=True)),
                ('synced_to_pops', models.BooleanField(default=False)),
                ('sync_attempted_at', models.DateTimeField(blank=True, null=True)),
                ('sync_error', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('shipment_id', models.CharField(max_length=255, null=True, blank=True, default='')),
            ],
            options={
                'db_table': 'order_events',
                'ordering': ['-created_at'],
            },
        ),
        
        # Add indexes
        migrations.AddIndex(
            model_name='zone',
            index=models.Index(fields=['city', 'is_active'], name='zones_city_b0240d_idx'),
        ),
        migrations.AddIndex(
            model_name='zone',
            index=models.Index(fields=['is_active'], name='zones_is_acti_eda58f_idx'),
        ),
        migrations.AddIndex(
            model_name='orderevent',
            index=models.Index(fields=['shipment_id', '-created_at'], name='order_event_shipmen_ddf1e5_idx'),
        ),
        migrations.AddIndex(
            model_name='orderevent',
            index=models.Index(fields=['event_type', '-created_at'], name='order_event_event_t_3cfcce_idx'),
        ),
        migrations.AddIndex(
            model_name='orderevent',
            index=models.Index(fields=['synced_to_pops', 'sync_attempted_at'], name='order_event_synced__3900a1_idx'),
        ),
    ]
