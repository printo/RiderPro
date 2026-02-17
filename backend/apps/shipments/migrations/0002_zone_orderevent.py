# Simple migration to create basic models without foreign key conflicts

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0001_initial'),
        ('shipments', '0001_initial'),
    ]

    operations = [
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
            ],
            options={
                'db_table': 'zones',
                'ordering': ['name'],
            },
        ),
    ]
