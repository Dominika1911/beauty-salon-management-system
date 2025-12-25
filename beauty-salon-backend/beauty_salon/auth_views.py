from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny


from .models import SystemLog
from .serializers import UserDetailSerializer


@ensure_csrf_cookie
@api_view(["GET"])
@permission_classes([AllowAny])
@authentication_classes([])
def csrf(request):
    return Response({"detail": "CSRF cookie set"})



class SessionLoginView(APIView):
    """
    Endpoint do logowania użytkownika przez sesję.

    POST /api/auth/login/

    Body:
    {
        "username": "admin-1234",
        "password": "password123"
    }

    Response (sukces):
    {
        "detail": "Zalogowano pomyślnie.",
        "user": {...}
    }

    Response (błąd):
    {
        "detail": "Nieprawidłowe dane logowania."
    }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')

        if not username or not password:
            return Response(
                {'detail': 'Wymagane pola: username i password.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Autentykacja
        user = authenticate(request, username=username, password=password)

        if user is None:
            return Response(
                {'detail': 'Nieprawidłowe dane logowania.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not user.is_active:
            return Response(
                {'detail': 'Konto jest nieaktywne.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Zaloguj użytkownika
        # Zaloguj użytkownika
        login(request, user)

        # Loguj akcję w systemie (audyt)
        SystemLog.log(
            action=SystemLog.Action.AUTH_LOGIN,
            performed_by=user,
            target_user=user,
        )

        return Response({
            "detail": "Zalogowano pomyślnie.",
            "user": UserDetailSerializer(user, context={"request": request}).data
        }, status=status.HTTP_200_OK)


class SessionLogoutView(APIView):
    """
    Endpoint do wylogowania użytkownika.

    POST /api/auth/logout/

    Response:
    {
        "detail": "Wylogowano pomyślnie."
    }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        # Loguj akcję przed wylogowaniem
        SystemLog.log(
            action=SystemLog.Action.AUTH_LOGOUT,
            performed_by=user,
            target_user=user,
        )

        logout(request)

        return Response(
            {"detail": "Wylogowano pomyślnie."},
            status=status.HTTP_200_OK
        )


class AuthStatusView(APIView):
    """
    Endpoint sprawdzający status autoryzacji użytkownika.
    Używany przez frontend do sprawdzenia czy użytkownik jest zalogowany.

    GET /api/auth/status/

    Response (zalogowany):
    {
        "isAuthenticated": true,
        "user": {...}
    }

    Response (niezalogowany):
    {
        "isAuthenticated": false,
        "user": null
    }
    """
    permission_classes = [AllowAny]

    def get(self, request):
        if request.user.is_authenticated:
            return Response({
                "isAuthenticated": True,
                "user": UserDetailSerializer(request.user, context={"request": request}).data
            })
