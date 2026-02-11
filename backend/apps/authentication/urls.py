"""
Authentication URLs
"""
from django.urls import path
from . import views

app_name = 'authentication'

urlpatterns = [
    path('login', views.login, name='login'),
    path('logout', views.logout, name='logout'),
    path('register', views.register, name='register'),
    path('local-login', views.local_login, name='local_login'),
    path('refresh', views.refresh_token, name='refresh_token'),
    path('fetch-rider', views.fetch_rider, name='fetch_rider'),
    path('pending-approvals', views.pending_approvals, name='pending_approvals'),
    path('all-users', views.all_users, name='all_users'),
    path('approve/<str:user_id>', views.approve_user, name='approve_user'),
    path('reject/<str:user_id>', views.reject_user, name='reject_user'),
    path('users/<str:user_id>', views.get_user, name='get_user'),
    path('reset-password/<str:user_id>', views.reset_password, name='reset_password'),
    
    # Homebase management
    path('homebases/', views.homebase_list, name='homebase_list'),
    path('homebases/<int:pk>/', views.homebase_detail, name='homebase_detail'),
    path('homebases/sync', views.sync_homebases_from_pops, name='sync_homebases_from_pops'),
    
    # POPS API proxy endpoints
    path('pops/homebases', views.pops_homebases, name='pops_homebases'),
    path('pops/riders', views.pops_create_rider, name='pops_create_rider'),
]

