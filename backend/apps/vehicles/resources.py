"""
Resources for CSV import/export in vehicles app
"""
from import_export import resources
from .models import VehicleType, FuelSetting


class VehicleTypeResource(resources.ModelResource):
    """Resource for VehicleType model CSV import/export"""
    class Meta:
        model = VehicleType
        fields = (
            'id', 'name', 'fuel_efficiency', 'description', 'icon',
            'fuel_type', 'co2_emissions', 'created_at', 'updated_at'
        )
        export_order = (
            'id', 'name', 'fuel_efficiency', 'description', 'icon',
            'fuel_type', 'co2_emissions', 'created_at', 'updated_at'
        )


class FuelSettingResource(resources.ModelResource):
    """Resource for FuelSetting model CSV import/export"""
    class Meta:
        model = FuelSetting
        fields = (
            'id', 'fuel_type', 'price_per_liter', 'currency', 'region',
            'effective_date', 'is_active', 'created_by', 'created_at', 'updated_at'
        )
        export_order = (
            'id', 'fuel_type', 'price_per_liter', 'currency', 'region',
            'effective_date', 'is_active', 'created_by', 'created_at', 'updated_at'
        )

