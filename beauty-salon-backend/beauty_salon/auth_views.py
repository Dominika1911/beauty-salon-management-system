"""
Beauty Salon Management System - Authentication Views
Autor: Dominika Jedynak, nr albumu: 92721

Widoki do logowania/wylogowania przy użyciu Django Session Authentication.
"""

from django.contrib.auth import authenticate, login, logout
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import UserDetailSerializer


# ==================== CSRF TOKEN VIEW ====================

@ensure_csrf_cookie
@api_view(['GET'])
@permission_classes([])
@authentication_classes([])
def csrf(request):
    """
    Ustawia cookie CSRF. Wywołujesz to z frontu przez GET,
    a potem używasz tego ciasteczka przy POST/PUT/DELETE.

    GET /api/auth/csrf/

    Response:
    {
        "detail": "CSRF cookie set"
    }
    """
    return Response({'detail': 'CSRF cookie set'})


# ==================== SESSION LOGIN VIEW ====================

class SessionLoginView(APIView):
    """
    Logowanie użytkownika przy użyciu Django sesji.

    POST /api/auth/login/
    {
        "email": "user@example.com",
        "password": "haslo123"
    }

    Response (sukces):
    {
        "message": "Logged in successfully.",
        "user": {
            "id": "...",
            "email": "user@example.com",
            "role": "client",
            ...
        }
    }

    Response (błąd):
    {
        "error": "Invalid credentials."
    }
    """
    permission_classes = [permissions.AllowAny]

    # Na produkcji usuń csrf_exempt i obsługuj CSRF token!
    # Na MVP możesz to zostawić, żeby nie męczyć się z CSRF z frontu
    @method_decorator(csrf_exempt)
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')

        if not email or not password:
            return Response(
                {'error': 'Email and password are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Django authenticate używa USERNAME_FIELD (u Ciebie to 'email')
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

        # Opcjonalnie: blokada konta
        if user.account_locked_until and user.account_locked_until > timezone.now():
            return Response(
                {
                    'error': 'Account is temporarily locked.',
                    'locked_until': user.account_locked_until.isoformat()
                },
                status=status.HTTP_403_FORBIDDEN
            )

        # Logowanie do sesji
        login(request, user)

        # Zapisz IP logowania
        user.last_login_ip = request.META.get('REMOTE_ADDR')
        user.failed_login_attempts = 0
        user.account_locked_until = None
        user.save(update_fields=['last_login_ip', 'failed_login_attempts', 'account_locked_until'])

        # Zwróć podstawowe info o użytkowniku
        return Response({
            'message': 'Logged in successfully.',
            'user': UserDetailSerializer(user).data
        }, status=status.HTTP_200_OK)


# ==================== SESSION LOGOUT VIEW ====================

class SessionLogoutView(APIView):
    """
    Wylogowanie użytkownika (niszczy sesję).

    POST /api/auth/logout/

    Response:
    {
        "message": "Logged out successfully."
    }
    """
    permission_classes = [permissions.IsAuthenticated]

    # Na produkcji usuń csrf_exempt i obsługuj CSRF token!
    @method_decorator(csrf_exempt)
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)

    def post(self, request):
        logout(request)
        return Response({
            'message': 'Logged out successfully.'
        }, status=status.HTTP_200_OK)


# ==================== CHECK AUTH STATUS VIEW ====================

class AuthStatusView(APIView):
    """
    Sprawdza czy użytkownik jest zalogowany.

    GET /api/auth/status/

    Response (zalogowany):
    {
        "authenticated": true,
        "user": {
            "id": "...",
            "email": "user@example.com",
            "role": "client",
            ...
        }
    }

    Response (niezalogowany):
    {
        "authenticated": false,
        "user": null
    }
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
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