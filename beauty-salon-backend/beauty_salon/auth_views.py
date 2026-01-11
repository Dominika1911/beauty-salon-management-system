from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.views.decorators.csrf import ensure_csrf_cookie
from django.middleware.csrf import CsrfViewMiddleware
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView



from .models import SystemLog
from .serializers import PasswordChangeSerializer, UserDetailSerializer


@ensure_csrf_cookie
@api_view(["GET"])
@permission_classes([AllowAny])
def csrf(request):
    return Response({"detail": "CSRF cookie set"})


class SessionLoginView(APIView):

    permission_classes = [AllowAny]

    def post(self, request):
        # === WYMUSZENIE CSRF NA LOGIN ===
        csrf_mw = CsrfViewMiddleware(get_response=lambda r: None)
        csrf_failure = csrf_mw.process_view(request, None, (), {})
        if csrf_failure is not None:
            return Response(
                {"detail": "CSRF Failed."},
                status=status.HTTP_403_FORBIDDEN,
            )
        # === KONIEC CSRF CHECK ===

        username = request.data.get("username")
        password = request.data.get("password")

        if not username or not password:
            return Response(
                {"detail": "Wymagane pola: username i password."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = authenticate(request, username=username, password=password)
        if user is None:
            return Response(
                {"detail": "Nieprawidłowe dane logowania."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not user.is_active:
            return Response(
                {"detail": "Konto jest nieaktywne."},
                status=status.HTTP_403_FORBIDDEN,
            )

        login(request, user)

        SystemLog.log(
            action=SystemLog.Action.AUTH_LOGIN,
            performed_by=user,
            target_user=user,
        )

        return Response(
            {
                "detail": "Zalogowano pomyślnie.",
                "user": UserDetailSerializer(
                    user,
                    context={"request": request},
                ).data,
            },
            status=status.HTTP_200_OK,
        )


class SessionLogoutView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        SystemLog.log(
            action=SystemLog.Action.AUTH_LOGOUT,
            performed_by=user,
            target_user=user,
        )

        logout(request)

        return Response(
            {"detail": "Wylogowano pomyślnie."},
            status=status.HTTP_200_OK,
        )


class AuthStatusView(APIView):

    permission_classes = [AllowAny]

    def get(self, request):
        if request.user.is_authenticated:
            return Response(
                {
                    "isAuthenticated": True,
                    "user": UserDetailSerializer(
                        request.user, context={"request": request}
                    ).data,
                },
                status=status.HTTP_200_OK,
            )

        return Response(
            {"isAuthenticated": False, "user": None},
            status=status.HTTP_200_OK,
        )


class ChangePasswordView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PasswordChangeSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        user = request.user
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password"])

        update_session_auth_hash(request, user)

        SystemLog.log(
            action=SystemLog.Action.AUTH_PASSWORD_CHANGE,
            performed_by=user,
            target_user=user,
        )

        return Response(
            {"detail": "Hasło zostało zmienione."},
            status=status.HTTP_200_OK,
        )
