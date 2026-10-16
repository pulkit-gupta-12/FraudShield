from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from apps.accounts.views import (
    LoginView,
    RegisterView,
    LogoutView,
    MeView,
    ChangePasswordView,
    ForgotPasswordView,
    SessionsListView,
    SignOutOthersView,
    UserViewSet,
)

user_list = UserViewSet.as_view({'get': 'list', 'post': 'create'})
user_detail = UserViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'})
user_role = UserViewSet.as_view({'patch': 'update_role'})
user_status = UserViewSet.as_view({'patch': 'update_status'})
user_invite = UserViewSet.as_view({'post': 'invite'})

urlpatterns = [
    # Auth endpoints
    path('auth/login/', LoginView.as_view(), name='auth_login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='auth_refresh'),
    path('auth/logout/', LogoutView.as_view(), name='auth_logout'),
    path('auth/register/', RegisterView.as_view(), name='auth_register'),
    path('auth/forgot-password/', ForgotPasswordView.as_view(), name='auth_forgot_password'),
    path('auth/me/', MeView.as_view(), name='auth_me'),
    path('auth/change-password/', ChangePasswordView.as_view(), name='auth_change_password'),
    path('auth/sessions/', SessionsListView.as_view(), name='auth_sessions'),
    path('auth/sessions/sign-out-others/', SignOutOthersView.as_view(), name='auth_sign_out_others'),

    # Users management
    path('users/', user_list, name='user_list'),
    path('users/<int:pk>/', user_detail, name='user_detail'),
    path('users/<int:pk>/role/', user_role, name='user_role'),
    path('users/<int:pk>/status/', user_status, name='user_status'),
    path('users/invite/', user_invite, name='user_invite'),
]
