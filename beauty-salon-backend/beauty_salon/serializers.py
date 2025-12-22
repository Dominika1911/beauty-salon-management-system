from __future__ import annotations

import secrets
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from .models import (
    Service,
    EmployeeProfile,
    ClientProfile,
    EmployeeSchedule,
    TimeOff,
    Appointment,
    SystemSettings,
    SystemLog,
)

User = get_user_model()


# =============================================================================
# USER SERIALIZERS
# =============================================================================

class UserListSerializer(serializers.ModelSerializer):
    """Serializer dla listy użytkowników (widok tabelaryczny)"""
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'role', 'role_display', 'is_active',
                  'created_at']
        read_only_fields = ['id', 'username', 'created_at']


class UserDetailSerializer(serializers.ModelSerializer):
    """Serializer szczegółów użytkownika z dodatkowymi informacjami"""
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    employee_profile = serializers.SerializerMethodField()
    client_profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'first_name', 'last_name', 'email',
            'role', 'role_display', 'is_active',
            'employee_profile', 'client_profile',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'username', 'created_at', 'updated_at']

    def get_employee_profile(self, obj):
        """Zwraca ID profilu pracownika jeśli istnieje"""
        if hasattr(obj, 'employee_profile'):
            return {
                'id': obj.employee_profile.id,
                'employee_number': obj.employee_profile.employee_number,
                'full_name': obj.employee_profile.get_full_name()
            }
        return None

    def get_client_profile(self, obj):
        """Zwraca ID profilu klienta jeśli istnieje"""
        if hasattr(obj, 'client_profile'):
            return {
                'id': obj.client_profile.id,
                'client_number': obj.client_profile.client_number,
                'full_name': obj.client_profile.get_full_name()
            }
        return None


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer do tworzenia nowego użytkownika"""
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ['id', 'username', 'password', 'first_name', 'last_name', 'email', 'role']
        read_only_fields = ['id']

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = User(**validated_data)

        if password:
            user.set_password(password)
        else:
            # Generuj tymczasowe hasło jeśli nie podano
            temp_password = secrets.token_urlsafe(8)
            user.set_password(temp_password)

        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer do aktualizacji użytkownika"""

    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email', 'is_active']


class PasswordChangeSerializer(serializers.Serializer):
    """Serializer do zmiany hasła przez użytkownika"""
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Nieprawidłowe stare hasło.')
        return value

    def validate_new_password(self, value):
        if len(value) < 8:
            raise serializers.ValidationError('Hasło musi mieć co najmniej 8 znaków.')
        return value


class PasswordResetSerializer(serializers.Serializer):
    """Serializer do resetowania hasła przez administratora"""
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_new_password(self, value):
        if len(value) < 8:
            raise serializers.ValidationError('Hasło musi mieć co najmniej 8 znaków.')
        return value


# =============================================================================
# SERVICE SERIALIZERS
# =============================================================================

class ServiceSerializer(serializers.ModelSerializer):
    """Serializer dla usług salonu"""
    duration_display = serializers.SerializerMethodField()

    class Meta:
        model = Service
        fields = [
            'id', 'name', 'category', 'description',
            'price', 'duration_minutes', 'duration_display',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_duration_display(self, obj):
        """Zwraca czas trwania w formacie czytelnym dla użytkownika"""
        hours = obj.duration_minutes // 60
        minutes = obj.duration_minutes % 60
        if hours > 0 and minutes > 0:
            return f"{hours}h {minutes}min"
        elif hours > 0:
            return f"{hours}h"
        else:
            return f"{minutes}min"


# =============================================================================
# EMPLOYEE SERIALIZERS
# =============================================================================

class EmployeeSerializer(serializers.ModelSerializer):
    """Serializer dla profili pracowników"""
    user_username = serializers.CharField(source='user.username', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    skills = ServiceSerializer(many=True, read_only=True)
    skill_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Service.objects.filter(is_active=True),
        write_only=True,
        required=False,
        source='skills'
    )

    # Pola do tworzenia nowego użytkownika (tylko przy dodawaniu)
    email = serializers.EmailField(write_only=True, required=False)
    password = serializers.CharField(write_only=True, required=False, min_length=8)

    class Meta:
        model = EmployeeProfile
        fields = [
            'id', 'user', 'user_username', 'user_email',
            'employee_number', 'first_name', 'last_name', 'phone',
            'skills', 'skill_ids',
            'email', 'password',  # Dodane pola
            'is_active', 'hired_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'employee_number', 'created_at', 'updated_at']
        extra_kwargs = {
            'user': {'required': False}  # Nie wymagane - zostanie stworzone automatycznie
        }

    def validate(self, data):
        """Walidacja danych pracownika"""
        # Przy tworzeniu (POST) - sprawdź czy są email i password
        if not self.instance:  # Tworzenie nowego
            if 'email' not in data or 'password' not in data:
                raise serializers.ValidationError(
                    'Email i hasło są wymagane przy tworzeniu pracownika.'
                )

        # Sprawdź czy użytkownik ma rolę EMPLOYEE (jeśli podano user)
        user = data.get('user')
        if user and user.role != 'EMPLOYEE':
            raise serializers.ValidationError('Użytkownik musi mieć rolę EMPLOYEE.')

        return data

    def create(self, validated_data):
        """Tworzy nowego pracownika wraz z użytkownikiem"""
        email = validated_data.pop('email', None)
        password = validated_data.pop('password', None)
        skills_data = validated_data.pop('skills', [])

        with transaction.atomic():
            # Jeśli nie podano user, utwórz nowego
            if 'user' not in validated_data:
                # Generuj unikalny username
                base_username = f"employee-{validated_data.get('first_name', 'user').lower()}"
                username = base_username
                counter = 1
                while User.objects.filter(username=username).exists():
                    username = f"{base_username}-{counter}"
                    counter += 1

                user = User.objects.create(
                    username=username,
                    email=email,
                    first_name=validated_data.get('first_name', ''),
                    last_name=validated_data.get('last_name', ''),
                    role='EMPLOYEE',
                    is_active=True
                )
                user.set_password(password)
                user.save()

                validated_data['user'] = user

            # Utwórz profil pracownika
            employee = EmployeeProfile.objects.create(**validated_data)

            # Dodaj umiejętności
            if skills_data:
                employee.skills.set(skills_data)

        return employee

    def update(self, instance, validated_data):
        """Aktualizuje profil pracownika"""
        skills_data = validated_data.pop('skills', None)
        email = validated_data.pop('email', None)
        password = validated_data.pop('password', None)

        # Aktualizuj pola profilu
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Aktualizuj umiejętności
        if skills_data is not None:
            instance.skills.set(skills_data)

        # Aktualizuj dane użytkownika jeśli podano
        if email or password:
            user = instance.user
            if email:
                user.email = email
            if password:
                user.set_password(password)
            user.save()

        return instance


class EmployeeScheduleSerializer(serializers.ModelSerializer):
    """Serializer dla grafiku pracownika"""

    class Meta:
        model = EmployeeSchedule
        fields = ['id', 'employee', 'weekly_hours', 'created_at', 'updated_at']
        read_only_fields = ['id', 'employee', 'created_at', 'updated_at']


class TimeOffSerializer(serializers.ModelSerializer):
    """Serializer dla nieobecności pracownika"""
    employee_name = serializers.CharField(source='employee.get_full_name', read_only=True)

    class Meta:
        model = TimeOff
        fields = ['id', 'employee', 'employee_name', 'date_from', 'date_to', 'reason', 'created_at']
        read_only_fields = ['id', 'created_at']


# =============================================================================
# CLIENT SERIALIZERS
# =============================================================================

class ClientSerializer(serializers.ModelSerializer):
    """Serializer dla profili klientów"""
    user_username = serializers.CharField(source='user.username', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)

    # Pola do tworzenia nowego użytkownika
    email = serializers.EmailField(write_only=True, required=False)
    password = serializers.CharField(write_only=True, required=False, min_length=8)

    class Meta:
        model = ClientProfile
        fields = [
            'id', 'user', 'user_username', 'user_email',
            'client_number', 'first_name', 'last_name',
            'email', 'phone', 'password',
            'date_of_birth', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'client_number', 'created_at', 'updated_at']
        extra_kwargs = {
            'user': {'required': False}
        }

    def validate(self, data):
        """Walidacja danych klienta"""
        if not self.instance:  # Tworzenie nowego
            if 'email' not in data or 'password' not in data:
                raise serializers.ValidationError(
                    'Email i hasło są wymagane przy tworzeniu klienta.'
                )

        user = data.get('user')
        if user and user.role != 'CLIENT':
            raise serializers.ValidationError('Użytkownik musi mieć rolę CLIENT.')

        return data

    def create(self, validated_data):
        """Tworzy nowego klienta wraz z użytkownikiem"""
        email = validated_data.pop('email', None)
        password = validated_data.pop('password', None)

        with transaction.atomic():
            if 'user' not in validated_data:
                # Generuj unikalny username
                base_username = f"client-{validated_data.get('first_name', 'user').lower()}"
                username = base_username
                counter = 1
                while User.objects.filter(username=username).exists():
                    username = f"{base_username}-{counter}"
                    counter += 1

                user = User.objects.create(
                    username=username,
                    email=email,
                    first_name=validated_data.get('first_name', ''),
                    last_name=validated_data.get('last_name', ''),
                    role='CLIENT',
                    is_active=True
                )
                user.set_password(password)
                user.save()

                validated_data['user'] = user

            # Utwórz profil klienta
            client = ClientProfile.objects.create(**validated_data)

        return client

    def update(self, instance, validated_data):
        """Aktualizuje profil klienta"""
        email = validated_data.pop('email', None)
        password = validated_data.pop('password', None)

        # Aktualizuj pola profilu
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Aktualizuj dane użytkownika jeśli podano
        if email or password:
            user = instance.user
            if email:
                user.email = email
            if password:
                user.set_password(password)
            user.save()

        return instance


# =============================================================================
# APPOINTMENT SERIALIZERS
# =============================================================================

class AppointmentSerializer(serializers.ModelSerializer):
    """Serializer dla wizyt"""
    client_name = serializers.CharField(source='client.get_full_name', read_only=True, allow_null=True)
    employee_name = serializers.CharField(source='employee.get_full_name', read_only=True)
    service_name = serializers.CharField(source='service.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Appointment
        fields = [
            'id', 'client', 'client_name',
            'employee', 'employee_name',
            'service', 'service_name',
            'start', 'end', 'status', 'status_display',
            'internal_notes',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, data):
        """Walidacja wizyty"""
        # Sprawdź czy koniec jest po początku
        if data['end'] <= data['start']:
            raise serializers.ValidationError({
                'end': 'Czas zakończenia musi być po czasie rozpoczęcia.'
            })

        # Sprawdź konflikty czasowe dla pracownika
        employee = data.get('employee')
        start = data.get('start')
        end = data.get('end')

        if employee and start and end:
            # Pobierz ID obecnej wizyty jeśli to update
            instance_id = self.instance.id if self.instance else None

            conflicts = Appointment.objects.filter(
                employee=employee,
                start__lt=end,
                end__gt=start
            ).exclude(status=Appointment.Status.CANCELLED)

            if instance_id:
                conflicts = conflicts.exclude(id=instance_id)

            if conflicts.exists():
                raise serializers.ValidationError({
                    'employee': 'Pracownik ma już zajęty termin w tym czasie.'
                })
        # Sprawdź konflikty czasowe dla klienta
        client = data.get('client')
        if client and start and end:
            instance_id = self.instance.id if self.instance else None

            client_conflicts = Appointment.objects.filter(
                client=client,
                start__lt=end,
                end__gt=start
            ).exclude(status=Appointment.Status.CANCELLED)

            if instance_id:
                client_conflicts = client_conflicts.exclude(id=instance_id)

            if client_conflicts.exists():
                raise serializers.ValidationError({
                    'client': 'Klient ma już zarezerwowaną wizytę w tym czasie.'
                })


        return data


# =============================================================================
# SYSTEM SETTINGS SERIALIZERS
# =============================================================================

class SystemSettingsSerializer(serializers.ModelSerializer):
    """Serializer dla ustawień systemowych"""
    updated_by_username = serializers.CharField(source='updated_by.username', read_only=True, allow_null=True)

    class Meta:
        model = SystemSettings
        fields = [
            'id', 'salon_name', 'slot_minutes', 'buffer_minutes',
            'opening_hours', 'updated_at', 'updated_by', 'updated_by_username'
        ]
        read_only_fields = ['id', 'updated_at', 'updated_by']

    def validate_slot_minutes(self, value):
        """Walidacja długości slotu"""
        if value < 5:
            raise serializers.ValidationError('Slot musi mieć co najmniej 5 minut.')
        if value > 120:
            raise serializers.ValidationError('Slot nie może być dłuższy niż 120 minut.')
        return value

    def validate_buffer_minutes(self, value):
        """Walidacja bufora czasowego"""
        if value < 0:
            raise serializers.ValidationError('Bufor nie może być ujemny.')
        if value > 60:
            raise serializers.ValidationError('Bufor nie może być dłuższy niż 60 minut.')
        return value


# =============================================================================
# SYSTEM LOG SERIALIZERS
# =============================================================================

class SystemLogSerializer(serializers.ModelSerializer):
    """Serializer dla logów systemowych"""
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    performed_by_username = serializers.CharField(source='performed_by.username', read_only=True, allow_null=True)
    target_user_username = serializers.CharField(source='target_user.username', read_only=True, allow_null=True)

    class Meta:
        model = SystemLog
        fields = [
            'id', 'action', 'action_display',
            'performed_by', 'performed_by_username',
            'target_user', 'target_user_username',
            'timestamp'
        ]
        read_only_fields = fields  # Wszystkie pola read-only - logi nie są edytowalne


# =============================================================================
# BOOKING SERIALIZER - NAPRAWIONY
# =============================================================================

class BookingCreateSerializer(serializers.Serializer):
    """
    Serializer do tworzenia rezerwacji wizyty.
    Wzorowany na systemie biblioteki - automatycznie przypisuje klienta z request.user
    """
    service_id = serializers.IntegerField(required=True)
    employee_id = serializers.IntegerField(required=True)
    start = serializers.DateTimeField(required=True)

class BookingCreateSerializer(serializers.Serializer):
    """
    Serializer do tworzenia rezerwacji wizyty.
    Automatycznie przypisuje klienta z request.user
    """
    service_id = serializers.IntegerField(required=True)
    employee_id = serializers.IntegerField(required=True)
    start = serializers.DateTimeField(required=True)

    def validate(self, data):
        """Walidacja danych rezerwacji"""
        request = self.context.get('request')

        # Sprawdź czy user jest zalogowany
        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError('Musisz być zalogowany aby zarezerwować wizytę.')

        user = request.user

        # Sprawdź czy user ma profil klienta
        if not hasattr(user, 'client_profile'):
            raise serializers.ValidationError('Użytkownik nie ma profilu klienta. Skontaktuj się z administratorem.')

        try:
            client = user.client_profile
        except Exception:
            raise serializers.ValidationError('Nie można pobrać profilu klienta. Skontaktuj się z administratorem.')

        # Pobierz service i employee z bazy
        try:
            service = Service.objects.get(id=data['service_id'], is_active=True)
        except Service.DoesNotExist:
            raise serializers.ValidationError({'service_id': 'Nie znaleziono usługi.'})

        try:
            employee = EmployeeProfile.objects.get(id=data['employee_id'], is_active=True)
        except EmployeeProfile.DoesNotExist:
            raise serializers.ValidationError({'employee_id': 'Nie znaleziono pracownika.'})

        start = data.get('start')

        # Sprawdź czy pracownik ma umiejętność tej usługi
        if not employee.skills.filter(id=service.id).exists():
            raise serializers.ValidationError('Ten pracownik nie wykonuje wybranej usługi.')

        # Oblicz czas zakończenia
        settings = SystemSettings.get_settings()
        buffer_minutes = settings.buffer_minutes
        duration = timedelta(minutes=service.duration_minutes + buffer_minutes)
        end = start + duration

        # Sprawdź czy termin nie jest w przeszłości
        if start < timezone.now():
            raise serializers.ValidationError('Nie można rezerwować wizyt w przeszłości.')

        # Sprawdź konflikty czasowe dla pracownika
        employee_conflicts = Appointment.objects.filter(
            employee=employee,
            start__lt=end,
            end__gt=start
        ).exclude(status=Appointment.Status.CANCELLED)

        if employee_conflicts.exists():
            raise serializers.ValidationError('Ten pracownik ma już zajęty termin w tym czasie.')

        # Sprawdź konflikty czasowe dla klienta
        client_conflicts = Appointment.objects.filter(
            client=client,
            start__lt=end,
            end__gt=start
        ).exclude(status=Appointment.Status.CANCELLED)

        if client_conflicts.exists():
            raise serializers.ValidationError('Masz już zarezerwowaną wizytę w tym czasie.')

        # Sprawdź czy pracownik jest dostępny w tym dniu (urlopy)
        date = start.date()
        if TimeOff.objects.filter(
                employee=employee,
                date_from__lte=date,
                date_to__gte=date
        ).exists():
            raise serializers.ValidationError('Pracownik jest nieobecny w tym dniu.')

        # Dodaj przetworzone dane do validated_data
        data['end'] = end
        data['client'] = client
        data['service'] = service
        data['employee'] = employee

        return data

    def create(self, validated_data):
        """Utwórz wizytę"""
        with transaction.atomic():
            appointment = Appointment.objects.create(
                client=validated_data['client'],
                employee=validated_data['employee'],
                service=validated_data['service'],
                start=validated_data['start'],
                end=validated_data['end'],
                status=Appointment.Status.PENDING
            )

        return appointment