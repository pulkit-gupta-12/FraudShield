from rest_framework import status, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied, ValidationError
from rest_framework_simplejwt.tokens import RefreshToken, UntypedToken
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken

from apps.accounts.models import User, UserSession
from apps.accounts.serializers import (
    UserSerializer,
    UserUpdateSerializer,
    RegisterSerializer,
    LoginSerializer,
    ChangePasswordSerializer,
    ForgotPasswordSerializer,
    UserSessionSerializer,
)
from apps.accounts.permissions import IsAdmin, ScopedQuerySetMixin
from apps.audit.models import audit
from config.throttling import LoginRateThrottle, RegisterRateThrottle, ForgotPasswordRateThrottle

def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '127.0.0.1')


class HealthCheckView(APIView):
    """Public system health check."""
    permission_classes = [AllowAny]

    def get(self, request):
        from apps.ml.ml_service import ml_service
        return Response({
            "status": "healthy",
            "modelLoaded": ml_service.is_loaded,
            "modelVersion": ml_service.version
        })



class LoginView(APIView):
    """
    POST /api/auth/login/
    Throttled: 5/min.
    Returns { access, refresh, user }.
    """
    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email'].strip().lower()
        password = serializer.validated_data['password']
        ip = get_client_ip(request)

        # Support both @fraudshield.com and @fraudshield.io
        user = None
        user_candidates = [email]
        if email.endswith('@fraudshield.com'):
            user_candidates.append(email.replace('@fraudshield.com', '@fraudshield.io'))
        elif email.endswith('@fraudshield.io'):
            user_candidates.append(email.replace('@fraudshield.io', '@fraudshield.com'))

        for candidate in user_candidates:
            try:
                found_user = User.objects.get(email=candidate)
                if found_user.check_password(password):
                    user = found_user
                    break
            except User.DoesNotExist:
                continue

        if not user:
            audit(
                user=None,
                action="LOGIN_FAILED",
                target="Auth",
                ip=ip,
                details={"attempted_email": email},
                status="FAILED"
            )
            # Never reveal whether the email exists
            raise AuthenticationFailed("Invalid email or password.")

        # Check user status & is_active
        if user.status == 'pending':
            audit(
                user=user,
                action="LOGIN_BLOCKED",
                target="Auth",
                ip=ip,
                details={"reason": "Account pending approval"},
                status="BLOCKED"
            )
            raise AuthenticationFailed("Your account is pending administrator approval.")

        if not user.is_active or user.status in ('disabled', 'suspended'):
            audit(
                user=user,
                action="LOGIN_BLOCKED",
                target="Auth",
                ip=ip,
                details={"reason": f"Account status: {user.status}"},
                status="BLOCKED"
            )
            raise AuthenticationFailed("Your account has been deactivated or disabled. Please contact support.")

        # Generate tokens
        refresh = RefreshToken.for_user(user)
        access = refresh.access_token

        # Record user session
        jti = refresh.payload.get('jti', '')
        UserSession.objects.create(
            user=user,
            session_key=str(jti),
            ip_address=ip,
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:255],
            is_current=True
        )

        audit(
            user=user,
            action="LOGIN_SUCCESS",
            target="Auth",
            ip=ip,
            details={"email": user.email, "role": user.role},
            status="SUCCESS"
        )

        return Response({
            "access": str(access),
            "refresh": str(refresh),
            "user": UserSerializer(user).data
        })


class RegisterView(APIView):
    """
    POST /api/auth/register/
    Throttled: 5/min.
    Creates a pending user with is_active=False.
    """
    permission_classes = [AllowAny]
    throttle_classes = [RegisterRateThrottle]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user = User.objects.create_user(
            email=data['email'],
            password=data['password'],
            name=data['name'],
            role=data.get('role', 'customer'),
            city=data.get('city', 'Mumbai'),
            phone=data.get('phone', ''),
            department=data.get('department', ''),
            organisation=data.get('organisation', ''),
            status='pending',
            is_active=False
        )

        audit(
            user=user,
            action="USER_REGISTERED",
            target=f"User:{user.email}",
            ip=get_client_ip(request),
            details={"role": user.role, "status": "pending"},
            status="SUCCESS"
        )

        return Response({
            "message": "Registration submitted successfully. Account pending approval.",
            "status": "pending",
            "user": UserSerializer(user).data
        }, status=status.HTTP_201_CREATED)


class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Blacklists the provided refresh token.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        ip = get_client_ip(request)

        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                jti = token.payload.get('jti')
                token.blacklist()
                if jti:
                    UserSession.objects.filter(user=request.user, session_key=str(jti)).delete()
            except Exception:
                # Still proceed to logout
                pass

        audit(
            user=request.user,
            action="LOGOUT",
            target="Auth",
            ip=ip,
            status="SUCCESS"
        )

        return Response({"success": True, "message": "Successfully logged out."})


class MeView(APIView):
    """
    GET, PATCH /api/auth/me/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        audit(
            user=request.user,
            action="PROFILE_UPDATED",
            target=f"User:{request.user.id}",
            ip=get_client_ip(request),
            details={"updated_fields": list(request.data.keys())},
            status="SUCCESS"
        )

        return Response(UserSerializer(request.user).data)


class ChangePasswordView(APIView):
    """
    POST /api/auth/change-password/
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        old_password = serializer.validated_data['old_password']
        new_password = serializer.validated_data['new_password']

        if not user.check_password(old_password):
            audit(
                user=user,
                action="PASSWORD_CHANGE_FAILED",
                target="Auth",
                ip=get_client_ip(request),
                details={"reason": "Incorrect old password"},
                status="FAILED"
            )
            raise ValidationError({"old_password": ["Current password is incorrect."]})

        user.set_password(new_password)
        user.save()

        audit(
            user=user,
            action="PASSWORD_CHANGE_SUCCESS",
            target="Auth",
            ip=get_client_ip(request),
            status="SUCCESS"
        )

        return Response({"message": "Password changed successfully."})


class ForgotPasswordView(APIView):
    """
    POST /api/auth/forgot-password/
    Always returns the exact same 200 message; writes nothing sensitive.
    """
    permission_classes = [AllowAny]
    throttle_classes = [ForgotPasswordRateThrottle]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        audit(
            user=None,
            action="PASSWORD_RESET_REQUESTED",
            target="Auth",
            ip=get_client_ip(request),
            details={"email": email},
            status="SUCCESS"
        )

        return Response({
            "message": "If the account exists, password reset instructions have been sent."
        })


class SessionsListView(APIView):
    """
    GET /api/auth/sessions/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        sessions = UserSession.objects.filter(user=request.user)
        serializer = UserSessionSerializer(sessions, many=True)
        return Response({
            "results": serializer.data,
            "count": sessions.count()
        })


class SignOutOthersView(APIView):
    """
    POST /api/auth/sessions/sign-out-others/
    Blacklists all outstanding refresh tokens except the current one.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        current_refresh = request.data.get('refresh')
        current_jti = None

        if current_refresh:
            try:
                current_jti = str(RefreshToken(current_refresh).payload.get('jti', ''))
            except Exception:
                pass

        # Blacklist other tokens in simplejwt OutstandingToken
        outstanding = OutstandingToken.objects.filter(user=user)
        for token_obj in outstanding:
            if current_jti and str(token_obj.jti) == current_jti:
                continue
            BlacklistedToken.objects.get_or_create(token=token_obj)

        # Remove other sessions
        session_qs = UserSession.objects.filter(user=user)
        if current_jti:
            session_qs = session_qs.exclude(session_key=current_jti)
        session_qs.delete()

        audit(
            user=user,
            action="SESSIONS_REVOKED_OTHERS",
            target=f"User:{user.id}",
            ip=get_client_ip(request),
            status="SUCCESS"
        )

        return Response({"message": "Other sessions signed out successfully."})


class UserViewSet(ScopedQuerySetMixin, viewsets.ModelViewSet):
    """
    Admin user management:
    GET /api/users/
    PATCH /api/users/{id}/role/
    PATCH /api/users/{id}/status/
    POST /api/users/invite/
    """
    queryset = User.objects.all().order_by('-created_at')
    serializer_class = UserSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ['role', 'status', 'is_active']
    search_fields = ['name', 'email', 'organisation', 'city']
    ordering_fields = ['created_at', 'name', 'email', 'last_login']

    def update_role(self, request, pk=None):
        user = self.get_object()
        new_role = request.data.get('role')
        if new_role not in ('admin', 'analyst', 'customer', 'merchant'):
            return Response({"message": "Invalid role."}, status=status.HTTP_400_BAD_REQUEST)
        user.role = new_role
        user.save()
        audit(user=request.user, action="ROLE_UPDATED", target=f"User:{user.id}", ip=get_client_ip(request), details={"new_role": new_role})
        return Response(UserSerializer(user).data)

    def update_status(self, request, pk=None):
        user = self.get_object()
        new_status = request.data.get('status')
        if not new_status:
            new_status = 'suspended' if user.status == 'active' else 'active'
        user.status = new_status
        user.is_active = (new_status == 'active')
        user.save()
        audit(user=request.user, action="USER_STATUS_UPDATED", target=f"User:{user.id}", ip=get_client_ip(request), details={"status": new_status})
        return Response(UserSerializer(user).data)

    def invite(self, request):
        email = request.data.get('email', '').strip().lower()
        role = request.data.get('role', 'analyst')
        name = request.data.get('name', email.split('@')[0])
        department = request.data.get('department', 'Risk Operations')

        if not email:
            return Response({"message": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email=email).exists():
            return Response({"message": "User with this email already exists."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(
            email=email,
            password='Password@123',
            name=name,
            role=role,
            department=department,
            status='active',
            is_active=True
        )
        audit(user=request.user, action="USER_INVITED", target=f"User:{user.id}", ip=get_client_ip(request), details={"role": role, "email": email})
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
