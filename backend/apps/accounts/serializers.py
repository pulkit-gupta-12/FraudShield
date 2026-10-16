from rest_framework import serializers
from django.contrib.auth import password_validation
from apps.accounts.models import User, UserSession

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'name',
            'role',
            'organisation',
            'department',
            'city',
            'phone',
            'status',
            'is_active',
            'last_login',
            'created_at',
        ]
        read_only_fields = ['id', 'last_login', 'created_at']


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['name', 'organisation', 'department', 'city', 'phone']


class RegisterSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    role = serializers.ChoiceField(choices=['customer', 'merchant', 'analyst', 'admin'], default='customer')
    city = serializers.CharField(max_length=100, required=False, default='Mumbai')
    phone = serializers.CharField(max_length=50, required=False, default='')
    department = serializers.CharField(max_length=255, required=False, default='')
    organisation = serializers.CharField(max_length=255, required=False, default='')

    def validate_email(self, value):
        normalized = value.strip().lower()
        if User.objects.filter(email=normalized).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return normalized

    def validate_password(self, value):
        password_validation.validate_password(value)
        return value


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_new_password(self, value):
        password_validation.validate_password(value)
        return value


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class UserSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserSession
        fields = ['id', 'session_key', 'ip_address', 'user_agent', 'is_current', 'last_activity', 'created_at']
