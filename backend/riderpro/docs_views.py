"""
Combined API Docs view - serves Scalar UI with schema embedded inline.
Single public URL: /api/docs/
Schema is also separately available at /api/schema/ for programmatic access.
"""
import json
from django.views import View
from django.shortcuts import render
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from drf_spectacular.generators import SchemaGenerator


class ScalarDocsView(View):
    """
    Serves the Scalar API docs UI with the OpenAPI schema embedded inline.
    No separate schema request needed - everything comes from /api/docs/.
    Publicly accessible - no auth required.
    """

    def get(self, request, *args, **kwargs):
        # Wrap Django request with DRF Request to provide proper auth context
        drf_request = Request(request)
        
        # Generate schema with proper DRF request context
        generator = SchemaGenerator(title='RiderPro API')
        schema = generator.get_schema(request=drf_request, public=True)

        # Serialize to JSON for embedding in HTML
        schema_json = json.dumps(schema)

        return render(request, 'scalar/index.html', {
            'schema_json': schema_json,
        })
