from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import Group

from .models import (
    Appointment,
    ClientProfile,
    CustomUser,
    EmployeeProfile,
    EmployeeSchedule,
    Service,
    SystemLog,
    SystemSettings,
    TimeOff,
)

admin.site.unregister(Group)


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    model = CustomUser

    list_display = (
        "username",
        "first_name",
        "last_name",
        "email",
        "role",
        "is_staff",
        "is_active",
    )
    list_filter = ("role", "is_staff", "is_superuser", "is_active")
    search_fields = ("username", "first_name", "last_name", "email")
    ordering = ("username",)

    fieldsets = (
        (None, {"fields": ("username", "password")}),
        ("Dane osobowe", {"fields": ("first_name", "last_name", "email")}),
        ("Rola w systemie", {"fields": ("role",)}),
        (
            "Uprawnienia",
            {"fields": ("is_active", "is_staff", "is_superuser", "user_permissions")},
        ),
        ("Ważne daty", {"fields": ("last_login", "date_joined")}),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "username",
                    "password1",
                    "password2",
                    "first_name",
                    "last_name",
                    "email",
                    "role",
                ),
            },
        ),
    )


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "category",
        "price",
        "duration_minutes",
        "is_active",
        "created_at",
    )
    list_filter = ("is_active", "category", "created_at")
    search_fields = ("name", "category", "description")
    readonly_fields = ("created_at", "updated_at")
    ordering = ("name",)

    fieldsets = (
        ("Podstawowe informacje", {"fields": ("name", "category", "description")}),
        ("Parametry usługi", {"fields": ("price", "duration_minutes", "is_active")}),
        (
            "Metadata",
            {"fields": ("created_at", "updated_at"), "classes": ("collapse",)},
        ),
    )


@admin.register(EmployeeProfile)
class EmployeeProfileAdmin(admin.ModelAdmin):
    list_display = (
        "employee_number",
        "first_name",
        "last_name",
        "phone",
        "is_active",
        "hired_at",
    )
    list_filter = ("is_active", "hired_at")
    search_fields = ("employee_number", "first_name", "last_name", "phone")
    filter_horizontal = ("skills",)
    readonly_fields = ("hired_at", "created_at", "updated_at")
    ordering = ("employee_number",)

    fieldsets = (
        (
            "Dane pracownika",
            {"fields": ("user", "employee_number", "first_name", "last_name", "phone")},
        ),
        ("Umiejętności", {"fields": ("skills",)}),
        ("Status", {"fields": ("is_active",)}),
        (
            "Metadata",
            {
                "fields": ("hired_at", "created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )


@admin.register(ClientProfile)
class ClientProfileAdmin(admin.ModelAdmin):
    list_display = (
        "client_number",
        "first_name",
        "last_name",
        "email",
        "phone",
        "is_active",
    )
    list_filter = ("is_active", "created_at")
    search_fields = ("client_number", "first_name", "last_name", "email", "phone")
    readonly_fields = ("created_at", "updated_at")
    ordering = ("client_number",)

    fieldsets = (
        (
            "Dane klienta",
            {
                "fields": (
                    "user",
                    "client_number",
                    "first_name",
                    "last_name",
                    "email",
                    "phone",
                )
            },
        ),
        ("Notatki wewnętrzne", {"fields": ("internal_notes",)}),
        ("Status", {"fields": ("is_active",)}),
        (
            "Metadata",
            {"fields": ("created_at", "updated_at"), "classes": ("collapse",)},
        ),
    )


@admin.register(EmployeeSchedule)
class EmployeeScheduleAdmin(admin.ModelAdmin):
    list_display = ("employee", "created_at", "updated_at")
    search_fields = (
        "employee__employee_number",
        "employee__first_name",
        "employee__last_name",
    )
    readonly_fields = ("created_at", "updated_at")


@admin.register(TimeOff)
class TimeOffAdmin(admin.ModelAdmin):
    list_display = ("employee", "date_from", "date_to", "reason", "created_at")
    list_filter = ("date_from", "date_to", "created_at")
    search_fields = (
        "employee__employee_number",
        "employee__first_name",
        "employee__last_name",
        "reason",
    )
    readonly_fields = ("created_at",)
    ordering = ("-date_from",)

    fieldsets = (
        ("Pracownik", {"fields": ("employee",)}),
        ("Okres nieobecności", {"fields": ("date_from", "date_to", "reason")}),
        ("Metadata", {"fields": ("created_at",), "classes": ("collapse",)}),
    )


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "client",
        "employee",
        "service",
        "start",
        "status",
        "created_at",
    )
    list_filter = ("status", "start", "created_at")
    search_fields = (
        "client__client_number",
        "client__first_name",
        "client__last_name",
        "employee__employee_number",
        "employee__first_name",
        "employee__last_name",
        "service__name",
    )
    readonly_fields = ("created_at", "updated_at")
    ordering = ("-start",)

    fieldsets = (
        ("Uczestnicy wizyty", {"fields": ("client", "employee", "service")}),
        ("Termin", {"fields": ("start", "end", "status")}),
        ("Notatki", {"fields": ("internal_notes",)}),
        (
            "Metadata",
            {"fields": ("created_at", "updated_at"), "classes": ("collapse",)},
        ),
    )


@admin.register(SystemSettings)
class SystemSettingsAdmin(admin.ModelAdmin):
    list_display = (
        "salon_name",
        "slot_minutes",
        "buffer_minutes",
        "updated_at",
        "updated_by",
    )
    readonly_fields = ("updated_at",)

    fieldsets = (
        ("Podstawowe ustawienia", {"fields": ("salon_name",)}),
        ("Ustawienia rezerwacji", {"fields": ("slot_minutes", "buffer_minutes")}),
        ("Godziny otwarcia", {"fields": ("opening_hours",)}),
        (
            "Metadata",
            {"fields": ("updated_at", "updated_by"), "classes": ("collapse",)},
        ),
    )


@admin.register(SystemLog)
class SystemLogAdmin(admin.ModelAdmin):
    list_display = ("action", "performed_by", "target_user", "timestamp")
    list_filter = ("action", "timestamp")
    search_fields = ("action", "performed_by__username", "target_user__username")
    readonly_fields = ("action", "performed_by", "target_user", "timestamp")
    ordering = ("-timestamp",)
