from typing import Any
from django.contrib.auth import authenticate, login, logout
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework.request import Request
from rest_framework.views import APIView

from .serializers import UserDetailSerializer


@ensure_csrf_cookie
@api_view(['GET'])
@permission_classes([])
@authentication_classes([])
def csrf(request: Request) -> Response:
    """
    Ustawia cookie CSRF.
    GET /api/auth/csrf/
    """
    return Response({'detail': 'CSRF cookie set'})


class SessionLoginView(APIView):
    """
    Logowanie użytkownika przy użyciu Django sesji.
    POST /api/auth/login/
    """
    permission_classes = [permissions.AllowAny]

    @method_decorator(csrf_exempt)
    def dispatch(self, *args: Any, **kwargs: Any) -> Any:
        return super().dispatch(*args, **kwargs)

    def post(self, request: Request) -> Response:
        email = request.data.get('email')
        password = request.data.get('password')

        if not email or not password:
            return Response(
                {'error': 'Email and password are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = authenticate(request, email=email, password=password)

        if user is None:
            return Response(
                {'error': 'Invalid credentials.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not user.is_active:
            return Response(
                {'error': 'User account is disabled.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if user.account_locked_until and user.account_locked_until > timezone.now():
            return Response(
                {
                    'error': 'Account is temporarily locked.',
                    'locked_until': user.account_locked_until.isoformat()
                },
                status=status.HTTP_403_FORBIDDEN
            )

        if user.is_superuser:
            return Response(
                {
                    'error': 'superuser_login_not_allowed',
                    'detail': 'Superuser must log in through /admin/',
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        login(request, user)

        user.last_login_ip = request.META.get('REMOTE_ADDR')
        user.failed_login_attempts = 0
        user.account_locked_until = None
        user.save(update_fields=['last_login_ip',
                                 'failed_login_attempts',
                                 'account_locked_until'])

        return Response({
            'message': 'Logged in successfully.',
            'user': UserDetailSerializer(user).data
        }, status=status.HTTP_200_OK)


class SessionLogoutView(APIView):
    """
    Wylogowanie użytkownika (niszczy sesję).
    POST /api/auth/logout/
    """
    permission_classes = [permissions.IsAuthenticated]

    @method_decorator(csrf_exempt)
    def dispatch(self, *args: Any, **kwargs: Any) -> Any:
        return super().dispatch(*args, **kwargs)

    def post(self, request: Request) -> Response:
        logout(request)
        return Response({
            'message': 'Logged out successfully.'
        }, status=status.HTTP_200_OK)


class AuthStatusView(APIView):
    """
    Sprawdza czy użytkownik jest zalogowany.
    GET /api/auth/status/
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request: Request) -> Response:
        if request.user.is_authenticated:
            return Response({
                'authenticated': True,
                'user': UserDetailSerializer(request.user).data
            })
        else:
            return Response({
                'authenticated': False,
                'user': None
            })