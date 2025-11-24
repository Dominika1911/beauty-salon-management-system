"""
Beauty Salon Management System - Django Admin
Autor: Dominika Jedynak, nr albumu: 92721

W pełni poprawiona wersja: Usunięto błędy AlreadyRegistered i admin.E108.
"""

import csv
from decimal import Decimal
from datetime import timedelta
from typing import TYPE_CHECKING, Optional

from django.contrib import admin
from django.contrib.admin import SimpleListFilter, AdminSite
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.db.models import Sum, Q, QuerySet
from django.http import HttpResponse
from django.urls import reverse
from django.utils import timezone
from django.utils.html import format_html
from django.utils.translation import gettext_lazy as _

# Importy dla formularzy użytkownika
from django import forms
from django.contrib.auth.forms import ReadOnlyPasswordHashField

# ============================================================================
# 1. IMPORTY MODELI
# ============================================================================
from .models import (
    User as CustomUser, Service, Employee, Schedule, TimeOff, Client,
    Appointment, Note, MediaAsset, Payment, Invoice, Notification,
    ReportPDF, AuditLog, SystemSettings, StatsSnapshot
)
from .utils import generate_invoice_number, calculate_vat

if TYPE_CHECKING:
    from .models import User as UserModel

# ============================================================================
# 2. FORMULARZE UŻYTKOWNIKA
# ============================================================================

class CustomUserCreationForm(forms.ModelForm):
    """Formularz tworzenia użytkownika w adminie (email + hasło 2x)."""
    password1 = forms.CharField(label=_("Hasło"), widget=forms.PasswordInput)
    password2 = forms.CharField(label=_("Powtórz hasło"), widget=forms.PasswordInput)

    class Meta:
        model = CustomUser
        fields = ("email", "role", "is_active", "is_staff")

    def clean_password2(self):
        password1 = self.cleaned_data.get("password1")
        password2 = self.cleaned_data.get("password2")
        if password1 and password2 and password1 != password2:
            raise forms.ValidationError(_("Hasła w obu polach muszą być takie same."))
        return password2

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data["password1"])
        if commit:
            user.save()
        return user


class CustomUserChangeForm(forms.ModelForm):
    """Formularz edycji użytkownika w adminie (hasło tylko do odczytu)."""
    password = ReadOnlyPasswordHashField(
        label=_("Hasło"),
        help_text=_("Możesz zmienić hasło używając formularza 'Zmień hasło' z panelu użytkownika."),
    )

    class Meta:
        model = CustomUser
        fields = (
            "email",
            "role",
            "is_active",
            "is_staff",
            "is_superuser",
            "groups",
            "user_permissions",
            "password",
        )

    def clean_password(self):
        return self.initial.get("password")


class UserAdmin(BaseUserAdmin):
    """Standardowy Admin dla CustomUser."""
    form = CustomUserChangeForm
    add_form = CustomUserCreationForm
    list_display = ('email', 'role', 'is_staff', 'is_active', 'account_status') # <-- Używa 'account_status'
    list_filter = ('role', 'is_staff', 'is_active')
    fieldsets = (
        (_('Dane konta'), {'fields': ('email', 'password')}),
        (_('Dane osobowe'), {'fields': ('first_name', 'last_name')}),
        (_('Role i uprawnienia'), {'fields': ('role', 'is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        (_('Zabezpieczenia'), {'fields': ('failed_login_attempts', 'account_locked_until', 'last_login_ip')}),
        (_('Daty'), {'fields': ('last_login', 'created_at')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password1', 'password2', 'role', 'is_active', 'is_staff'),
        }),
    )
    search_fields = ('email', 'first_name', 'last_name')
    ordering = ('email',)
    readonly_fields = ('last_login', 'created_at', 'failed_login_attempts', 'account_locked_until', 'last_login_ip')
    actions = ['activate_users', 'deactivate_users']
    inlines = []

    # ✅ DODANA METODA: Rozwiązuje błąd admin.E108
    def account_status(self, obj: 'UserModel'):
        locked_until_str = obj.account_locked_until.strftime('%Y-%m-%d %H:%M') if obj.account_locked_until else ''
        if obj.account_locked_until and obj.account_locked_until > timezone.now():
            return format_html(
                '<span style="color: red; font-weight: bold;">Zablokowane do {}</span>',
                locked_until_str
            )
        elif obj.failed_login_attempts >= 3:
            return format_html(
                '<span style="color: orange;">{} nieudanych prób</span>',
                obj.failed_login_attempts
            )
        elif obj.is_active:
            return format_html('<span style="color: green;">{}</span>', 'Aktywne')
        else:
            return format_html('<span style="color: gray;">{}</span>', 'Nieaktywne')

    account_status.short_description = 'Status konta'

    def get_inline_instances(self, request, obj: Optional['UserModel'] = None):
        """Dynamiczne inlines na podstawie roli."""
        if obj is None:
            return []

        inlines = []
        if obj.role == 'employee' or obj.is_superuser:
            if hasattr(obj, 'employee'):
                inlines.append(EmployeeInline(self.model, self.admin_site))

        if obj.role == 'client' or obj.is_superuser:
            if hasattr(obj, 'client_profile'):
                inlines.append(ClientInline(self.model, self.admin_site))

        inlines.extend(super().get_inline_instances(request, obj))
        return inlines


# ============================================================================
# 3. DEFINICJA CUSTOM ADMIN SITE
# ============================================================================

class BeautySalonAdminSite(AdminSite):
    """Niestandardowa klasa AdminSite dla panelu zarządzania salonem."""
    site_header = _("Beauty Salon Management System - Panel Administratora")
    site_title = _("BSMS Admin")
    index_title = _("Zarządzanie Systemem")
    index_template = "admin/index.html"

    def get_dashboard_context(self):
        """Dane do kafelków i list na stronie głównej admina."""
        today = timezone.now().date()
        tomorrow = today + timedelta(days=1)
        month_start = today.replace(day=1)

        # --- proste liczniki ---
        # aktywni = nieusunięci (SoftDeletableModel.active)
        active_clients = Client.active.count()
        active_employees = Employee.active.filter(
            is_active=True,
            schedule__status=Schedule.Status.ACTIVE,
        ).distinct().count()
        active_services = Service.active.filter(
            is_published=True,
        ).count()

        # --- przychód w bieżącym miesiącu (tylko opłacone płatności) ---
        month_payments = Payment.objects.filter(
            status=Payment.Status.PAID,
            paid_at__isnull=False,
            paid_at__date__gte=month_start,
            paid_at__date__lte=today,
        )
        revenue_month = month_payments.aggregate(
            total=Sum("amount")
        )["total"] or Decimal("0.00")

        # --- nadchodzące wizyty (dziś + jutro) ---
        upcoming_appointments = (
            Appointment.objects.filter(
                start__date__gte=today,
                start__date__lte=tomorrow,
                status__in=[
                    Appointment.Status.PENDING,
                    Appointment.Status.CONFIRMED,
                    Appointment.Status.IN_PROGRESS,
                ],
            )
            .select_related("client", "employee", "service")
            .order_by("start")[:10]
        )

        # --- oczekujące urlopy ---
        pending_timeoffs = (
            TimeOff.objects.filter(
                status=TimeOff.Status.PENDING,
                date_to__gte=today,
            )
            .select_related("employee")
            .order_by("date_from")[:10]
        )

        # --- ostatnia miesięczna migawka statystyk (jak jest) ---
        latest_monthly_snapshot = StatsSnapshot.objects.filter(
            period=StatsSnapshot.Period.MONTHLY
        ).order_by("-date_from").first()

        return {
            "dashboard_active_clients": active_clients,
            "dashboard_active_employees": active_employees,
            "dashboard_active_services": active_services,
            "dashboard_revenue_month": revenue_month,
            "dashboard_upcoming_appointments": upcoming_appointments,
            "dashboard_pending_timeoffs": pending_timeoffs,
            "dashboard_latest_snapshot": latest_monthly_snapshot,
        }

    def index(self, request, extra_context=None):
        """Podmiana index tak, żeby dodać nasze zmienne do template'u."""
        if extra_context is None:
            extra_context = {}
        extra_context.update(self.get_dashboard_context())
        return super().index(request, extra_context=extra_context)



# ============================================================================
# 4. DEFINICJE AKCJI
# ============================================================================

def export_to_csv(modeladmin, request, queryset: QuerySet):
    """Uniwersalna akcja eksportu do CSV."""
    opts = modeladmin.model._meta
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename={opts.verbose_name_plural}.csv'

    writer = csv.writer(response)
    fields = [field for field in opts.get_fields() if not field.many_to_many and not field.one_to_many]

    writer.writerow([field.verbose_name for field in fields])

    for obj in queryset:
        row = []
        for field in fields:
            value = getattr(obj, field.name)
            if callable(value):
                value = value()
            row.append(value)
        writer.writerow(row)

    return response


export_to_csv.short_description = "Eksportuj do CSV"


def send_reminder_notifications(modeladmin, request, queryset: QuerySet):
    """Wyślij przypomnienia dla wybranych wizyt."""
    count = 0
    for appointment in queryset.filter(
            status__in=['pending', 'confirmed'],
            reminder_sent=False,
            start__gte=timezone.now()
    ):
        appointment.reminder_sent = True
        appointment.reminder_sent_at = timezone.now()
        appointment.save()
        count += 1

    modeladmin.message_user(request, format_html('Wysłano przypomnienia dla {} wizyt.', count))


send_reminder_notifications.short_description = 'Wyślij przypomnienia'


def generate_invoices(modeladmin, request, queryset: QuerySet):
    """Generuj faktury dla wybranych wizyt."""
    count = 0
    settings = SystemSettings.load()
    vat_rate = settings.default_vat_rate if settings and hasattr(settings, 'default_vat_rate') else Decimal('23.00')

    for appointment in queryset.filter(status='completed'):
        if appointment.invoices.exists():
            continue
        if not appointment.service:
            continue

        net_amount = appointment.service.price
        vat_amount, gross_amount = calculate_vat(net_amount, vat_rate)

        Invoice.objects.create(
            number=generate_invoice_number(),
            client=appointment.client,
            appointment=appointment,
            client_name=appointment.client.get_full_name() if appointment.client else "Klient nieznany",
            issue_date=timezone.now().date(),
            sale_date=appointment.start.date(),
            due_date=timezone.now().date() + timedelta(days=14),
            net_amount=net_amount,
            vat_rate=vat_rate,
            vat_amount=vat_amount,
            gross_amount=gross_amount,
            is_paid=False
        )
        count += 1

    modeladmin.message_user(request, format_html('Wygenerowano {} faktur.', count))


generate_invoices.short_description = 'Generuj faktury'


# ============================================================================
# 5. INLINE DEFINITIONS
# ============================================================================

class EmployeeInline(admin.StackedInline):
    model = Employee
    can_delete = False
    verbose_name_plural = _('Profil Pracownika')
    fk_name = 'user'
    fields = (
        ('number', 'is_active', 'hired_at'),
        ('first_name', 'last_name', 'phone'),
        'skills',
        ('appointments_count', 'average_rating'),
    )
    readonly_fields = ('number', 'appointments_count', 'average_rating',)
    raw_id_fields = ['skills']

class ClientInline(admin.StackedInline):
    model = Client
    can_delete = False
    verbose_name_plural = _('Profil Klienta')
    fk_name = 'user'
    fields = (
        ('number', 'first_name', 'last_name', 'email', 'phone'),
        ('visits_count', 'total_spent_amount'),
        ('marketing_consent', 'preferred_contact'),
        ('internal_notes',),
        ('deleted_at',)
    )
    readonly_fields = ('number', 'deleted_at', 'visits_count', 'total_spent_amount',)

class ScheduleInline(admin.TabularInline):
    model = Schedule
    extra = 0
    fields = ['status', 'created_at']
    readonly_fields = ['created_at']
    can_delete = False


class NoteInline(admin.TabularInline):
    model = Note
    extra = 0
    fields = ['content', 'author', 'visible_for_client', 'created_at']
    readonly_fields = ['created_at', 'author']
    show_change_link = True
    raw_id_fields = ['author']


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0
    fields = ['type', 'amount', 'status', 'method', 'paid_at']
    readonly_fields = ['created_at']
    show_change_link = True


# ============================================================================
# 6. CUSTOM FILTERS
# ============================================================================

class TodayAppointmentsFilter(SimpleListFilter):
    title = 'dzisiejsze wizyty'
    parameter_name = 'today'

    def lookups(self, request, model_admin):
        return (('yes', 'Dzisiaj'), ('tomorrow', 'Jutro'), ('week', 'Ten tydzień'))

    def queryset(self, request, queryset):
        today = timezone.now().date()
        if self.value() == 'yes':
            return queryset.filter(start__date=today)
        elif self.value() == 'tomorrow':
            tomorrow = today + timedelta(days=1)
            return queryset.filter(start__date=tomorrow)
        elif self.value() == 'week':
            week_end = today + timedelta(days=7)
            return queryset.filter(start__date__gte=today, start__date__lte=week_end)
        return queryset


class RevenueRangeFilter(SimpleListFilter):
    title = 'zakres wydatków'
    parameter_name = 'revenue'

    def lookups(self, request, model_admin):
        return (
            ('0-500', '0 - 500 PLN'),
            ('500-1000', '500 - 1000 PLN'),
            ('1000-5000', '1000 - 5000 PLN'),
            ('5000+', 'Powyżej 5000 PLN'),
        )

    def queryset(self, request, queryset):
        if self.value() == '0-500':
            return queryset.filter(total_spent_amount__gte=0, total_spent_amount__lt=500)
        elif self.value() == '500-1000':
            return queryset.filter(total_spent_amount__gte=500, total_spent_amount__lt=1000)
        elif self.value() == '1000-5000':
            return queryset.filter(total_spent_amount__gte=1000, total_spent_amount__lt=5000)
        elif self.value() == '5000+':
            return queryset.filter(total_spent_amount__gte=5000)
        return queryset


# ============================================================================
# 7. ADMIN CLASSES (KLASY BEZ DEKORATORÓW @admin.register)
# ============================================================================

class ServiceAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'price_display', 'duration',
                    'is_published', 'reservations_count', 'promotion_status']
    list_filter = ['category', 'is_published', 'created_at']
    search_fields = ['name', 'category', 'description']
    ordering = ['category', 'name']
    readonly_fields = ['reservations_count']
    actions = ['publish_services', 'unpublish_services']
    fieldsets = (
        (_('Podstawowe informacje'), {
            'fields': ('name', 'category', 'description', 'image_url'),
        }),
        (_('Cena i czas'), {
            'fields': ('price', 'duration', 'promotion'),
        }),
        (_('Publikacja'), {
            'fields': ('is_published',),
        }),
        (_('Statystyki'), {
            'fields': ('reservations_count',),
            'classes': ('collapse',),
        }),
    )

    def price_display(self, obj):
        if obj.promotion and obj.promotion.get('active'):
            try:
                promo_price = obj.get_price_with_promotion()
                return format_html(
                    '<span style="text-decoration: line-through;">{} PLN</span> '
                    '<span style="color: red; font-weight: bold;">{} PLN</span>',
                    obj.price, promo_price
                )
            except AttributeError:
                return format_html("{} PLN", obj.price)

        return format_html("{} PLN", obj.price)

    price_display.short_description = 'Cena'

    def promotion_status(self, obj):
        if obj.promotion and obj.promotion.get('active'):
            discount = obj.promotion.get('discount_percent', 0)
            return format_html(
                '<span style="background-color: #ff4444; color: white; padding: 2px 8px; '
                'border-radius: 3px;">-{}%</span>',
                discount
            )
        return format_html("{}", '-')

    promotion_status.short_description = 'Promocja'

    def publish_services(self, request, queryset: QuerySet):
        updated = queryset.update(is_published=True)
        self.message_user(request, format_html('Opublikowano {} usług.', updated))

    publish_services.short_description = 'Publikuj wybrane usługi'

    def unpublish_services(self, request, queryset: QuerySet):
        updated = queryset.update(is_published=False)
        self.message_user(request, format_html('Ukryto {} usług.', updated))

    unpublish_services.short_description = 'Ukryj wybrane usługi'


class EmployeeAdmin(admin.ModelAdmin):
    list_display = ['number', 'get_full_name', 'user', 'is_active', 'appointments_count',
                    'average_rating', 'hired_at']
    list_filter = ['is_active', 'hired_at']
    search_fields = ['number', 'first_name', 'last_name', 'user__email']
    ordering = ['last_name', 'first_name']
    readonly_fields = ['number', 'appointments_count', 'average_rating']
    filter_horizontal = ['skills']
    inlines = [ScheduleInline]
    raw_id_fields = ['user']
    fieldsets = (
        (_('Dane osobowe'), {
            'fields': ('first_name', 'last_name', 'user', 'phone'),
        }),
        (_('Zatrudnienie'), {
            'fields': ('hired_at', 'is_active'),
        }),
        (_('Kompetencje'), {
            'fields': ('skills',),
        }),
        (_('Statystyki'), {
            'fields': ('number', 'appointments_count', 'average_rating'),
            'classes': ('collapse',),
        }),
    )

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('user').prefetch_related('skills')


class ScheduleAdmin(admin.ModelAdmin):
    list_display = ['employee', 'status', 'created_at', 'availability_days_count']
    list_filter = ['status', 'created_at']
    search_fields = ['employee__first_name', 'employee__last_name', 'employee__number']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at']
    raw_id_fields = ['employee']
    fieldsets = (
        (_('Pracownik'), {
            'fields': ('employee', 'status'),
        }),
        (_('Harmonogram'), {
            'fields': ('availability_periods', 'breaks'),
        }),
        (_('Timestamps'), {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    def availability_days_count(self, obj):
        return format_html("{}", len(obj.availability_periods))

    availability_days_count.short_description = 'Dni w tygodniu'


class TimeOffAdmin(admin.ModelAdmin):
    list_display = ['employee', 'type', 'date_from', 'date_to', 'status',
                    'days_count', 'approved_by']
    list_filter = ['status', 'type', 'date_from']
    search_fields = ['employee__first_name', 'employee__last_name', 'reason']
    ordering = ['-date_from']
    readonly_fields = ['approved_at']
    raw_id_fields = ['employee', 'approved_by']
    actions = ['approve_time_offs', 'reject_time_offs']
    fieldsets = (
        (_('Pracownik'), {
            'fields': ('employee', 'type'),
        }),
        (_('Okres'), {
            'fields': ('date_from', 'date_to', 'reason'),
        }),
        (_('Zatwierdzenie'), {
            'fields': ('status', 'approved_by', 'approved_at'),
        }),
    )

    def days_count(self, obj):
        days = (obj.date_to - obj.date_from).days + 1
        return format_html("{}", days)

    days_count.short_description = 'Liczba dni'

    def approve_time_offs(self, request, queryset: QuerySet):
        for time_off in queryset.filter(status='pending'):
            time_off.status = 'approved'
            time_off.approved_by = request.user
            time_off.approved_at = timezone.now()
            time_off.save()
        self.message_user(request, format_html('Zatwierdzono {} urlopów.', queryset.filter(status='approved').count()))

    approve_time_offs.short_description = 'Zatwierdź wybrane urlopy'

    def reject_time_offs(self, request, queryset: QuerySet):
        updated = queryset.filter(status='pending').update(status='rejected')
        self.message_user(request, format_html('Odrzucono {} urlopów.', updated))

    reject_time_offs.short_description = 'Odrzuć wybrane urlopy'


class ClientAdmin(admin.ModelAdmin):
    list_display = ['number', 'get_full_name', 'email', 'phone', 'visits_count',
                    'total_spent_amount', 'marketing_consent', 'deleted_status']
    list_filter = ['marketing_consent', 'preferred_contact', 'deleted_at', RevenueRangeFilter]
    search_fields = ['number', 'first_name', 'last_name', 'email', 'phone']
    ordering = ['last_name', 'first_name']
    readonly_fields = ['number', 'visits_count', 'total_spent_amount', 'deleted_at']
    raw_id_fields = ['user']
    actions = [export_to_csv]
    fieldsets = (
        (_('Dane osobowe'), {
            'fields': ('first_name', 'last_name', 'email', 'phone', 'user'),
        }),
        (_('Marketing'), {
            'fields': ('marketing_consent', 'preferred_contact'),
        }),
        (_('Statystyki'), {
            'fields': ('number', 'visits_count', 'total_spent_amount'),
            'classes': ('collapse',),
        }),
        (_('Notatki'), {
            'fields': ('internal_notes',),
            'classes': ('collapse',),
        }),
        (_('GDPR'), {
            'fields': ('deleted_at',),
            'classes': ('collapse',),
        }),
    )

    def deleted_status(self, obj):
        if obj.deleted_at:
            return format_html(
                '<span style="color: red;">Usunięty {}</span>',
                obj.deleted_at.strftime('%Y-%m-%d')
            )
        return format_html('<span style="color: green;">{}</span>', 'Aktywny')

    deleted_status.short_description = 'Status GDPR'

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('user')


class AppointmentAdmin(admin.ModelAdmin):
    list_display = ['id_short', 'client', 'employee', 'service', 'start',
                    'status', 'booking_channel', 'reminder_status']
    list_filter = ['status', 'booking_channel', 'start', 'reminder_sent', TodayAppointmentsFilter]
    search_fields = ['client__first_name', 'client__last_name', 'employee__first_name',
                     'employee__last_name', 'service__name']
    ordering = ['-start']
    date_hierarchy = 'start'
    readonly_fields = ['timespan', 'cancelled_at']
    inlines = [NoteInline, PaymentInline]
    raw_id_fields = ['client', 'employee', 'service', 'cancelled_by']
    actions = ['confirm_appointments', 'cancel_appointments', 'mark_as_no_show',
               send_reminder_notifications, generate_invoices, export_to_csv]
    fieldsets = (
        (_('Podstawowe informacje'), {
            'fields': ('client', 'employee', 'service', 'status'),
        }),
        (_('Termin'), {
            'fields': ('start', 'end', 'timespan'),
        }),
        (_('Szczegóły rezerwacji'), {
            'fields': ('booking_channel', 'client_notes', 'internal_notes'),
        }),
        (_('Anulowanie'), {
            'fields': ('cancelled_by', 'cancelled_at', 'cancellation_reason'),
            'classes': ('collapse',),
        }),
        (_('Przypomnienia'), {
            'fields': ('reminder_sent', 'reminder_sent_at'),
            'classes': ('collapse',),
        }),
    )

    def id_short(self, obj):
        return format_html("{}", str(obj.id)[:8])

    id_short.short_description = 'ID'

    def reminder_status(self, obj):
        date_str = obj.reminder_sent_at.strftime('%Y-%m-%d') if obj.reminder_sent_at else ''
        if obj.reminder_sent:
            return format_html(
                '<span style="color: green;">Wysłane {}</span>',
                date_str
            )
        return format_html('<span style="color: gray;">{}</span>', 'Niewysłane')

    reminder_status.short_description = 'Przypomnienie'

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('client', 'employee', 'service', 'cancelled_by')

    def confirm_appointments(self, request, queryset: QuerySet):
        updated = queryset.filter(status='pending').update(status='confirmed')
        self.message_user(request, format_html('Potwierdzono {} wizyt.', updated))

    confirm_appointments.short_description = 'Potwierdź wybrane wizyty'

    def cancel_appointments(self, request, queryset: QuerySet):
        for appointment in queryset:
            appointment.status = 'cancelled'
            appointment.cancelled_by = request.user
            appointment.cancelled_at = timezone.now()
            appointment.save()
        self.message_user(request, format_html('Anulowano {} wizyt.', queryset.count()))

    cancel_appointments.short_description = 'Anuluj wybrane wizyty'

    def mark_as_no_show(self, request, queryset: QuerySet):
        updated = queryset.update(status='no_show')
        self.message_user(request, format_html('Oznaczono {} wizyt jako no-show.', updated))

    mark_as_no_show.short_description = 'Oznacz jako no-show'


class PaymentAdmin(admin.ModelAdmin):
    list_display = ['id_short', 'appointment_link', 'type', 'amount', 'status',
                    'method', 'paid_at']
    list_filter = ['status', 'type', 'method', 'paid_at']
    search_fields = ['appointment__client__first_name', 'appointment__client__last_name', 'reference']
    ordering = ['-created_at']
    date_hierarchy = 'paid_at'
    readonly_fields = ['created_at']
    raw_id_fields = ['appointment']
    actions = ['mark_as_paid', export_to_csv]
    fieldsets = (
        (_('Płatność'), {
            'fields': ('appointment', 'amount', 'type', 'status'),
        }),
        (_('Szczegóły'), {
            'fields': ('method', 'paid_at', 'reference'),
        }),
    )

    def id_short(self, obj):
        return format_html("{}", str(obj.id)[:8])

    id_short.short_description = 'ID'

    def appointment_link(self, obj):
        if obj.appointment:
            opts = obj.appointment._meta
            url = reverse(
                f'{admin_site.name}:{opts.app_label}_{opts.model_name}_change',
                args=[obj.appointment.pk]
            )
            return format_html('<a href="{}">Wizyta #{}</a>', url, str(obj.appointment.id)[:8])
        return format_html("{}", '-')

    appointment_link.short_description = 'Wizyta'

    def mark_as_paid(self, request, queryset: QuerySet):
        updated = queryset.update(status='paid', paid_at=timezone.now())
        self.message_user(request, format_html('Oznaczono {} płatności jako zapłacone.', updated))

    mark_as_paid.short_description = 'Oznacz jako zapłacone'


class InvoiceAdmin(admin.ModelAdmin):
    list_display = ['number', 'client', 'issue_date', 'gross_amount',
                    'is_paid', 'due_date', 'payment_status']
    list_filter = ['is_paid', 'issue_date', 'due_date']
    search_fields = ['number', 'client__first_name', 'client__last_name']
    ordering = ['-issue_date']
    date_hierarchy = 'issue_date'
    readonly_fields = ['created_at']
    raw_id_fields = ['client', 'appointment']
    fieldsets = (
        (_('Faktura'), {
            'fields': ('number', 'client', 'appointment', 'client_name', 'client_tax_id'),
        }),
        (_('Daty'), {
            'fields': ('issue_date', 'sale_date', 'due_date', 'paid_date'),
        }),
        (_('Kwoty'), {
            'fields': ('net_amount', 'vat_rate', 'vat_amount', 'gross_amount'),
        }),
        (_('Płatność'), {
            'fields': ('status', 'is_paid'),
        }),
        (_('Plik'), {
            'fields': ('pdf_file',),
            'classes': ('collapse',),
        }),
    )

    def payment_status(self, obj):
        if obj.is_paid:
            return format_html('<span style="color: green; font-weight: bold;">{}</span>', 'Zapłacona')
        elif obj.due_date and obj.due_date < timezone.now().date():
            return format_html('<span style="color: red; font-weight: bold;">{}</span>', 'Przeterminowana')
        else:
            return format_html('<span style="color: orange;">{}</span>', 'Oczekująca')

    payment_status.short_description = 'Status'


class NotificationAdmin(admin.ModelAdmin):
    list_display = ['id_short', 'client', 'type', 'channel', 'status',
                    'scheduled_at', 'attempts_count']
    list_filter = ['type', 'channel', 'status', 'scheduled_at']
    search_fields = ['client__first_name', 'client__last_name', 'content']
    ordering = ['scheduled_at']
    date_hierarchy = 'scheduled_at'
    readonly_fields = ['sent_at', 'attempts_count']
    raw_id_fields = ['client', 'appointment']
    fieldsets = (
        (_('Powiadomienie'), {
            'fields': ('client', 'appointment', 'type', 'channel'),
        }),
        (_('Treść'), {
            'fields': ('subject', 'content'),
        }),
        (_('Wysyłka'), {
            'fields': ('scheduled_at', 'status', 'sent_at', 'attempts_count', 'error_message'),
        }),
    )

    def id_short(self, obj):
        return format_html("{}", str(obj.id)[:8])

    id_short.short_description = 'ID'


class ReportPDFAdmin(admin.ModelAdmin):
    list_display = ['id_short', 'type', 'title', 'date_from', 'date_to',
                    'generated_by', 'created_at', 'size_display']
    list_filter = ['type', 'created_at']
    search_fields = ['title', 'generated_by__email']
    ordering = ['-created_at']
    date_hierarchy = 'created_at'
    readonly_fields = ['created_at', 'generated_by']
    raw_id_fields = ['generated_by']
    fieldsets = (
        (_('Raport'), {
            'fields': ('type', 'title', 'file', 'file_path'),
        }),
        (_('Zakres'), {
            'fields': ('date_from', 'date_to', 'parameters'),
        }),
        (_('Metadata'), {
            'fields': ('generated_by', 'file_size', 'created_at', 'notes'),
        }),
    )

    def id_short(self, obj):
        return format_html("{}", str(obj.id)[:8])

    id_short.short_description = 'ID'

    def size_display(self, obj):
        if not obj.file_size:
            return format_html("{}", '-')
        if obj.file_size < 1024:
            return format_html("{} B", obj.file_size)
        elif obj.file_size < 1024 * 1024:
            return format_html("{:.1f} KB", obj.file_size / 1024)
        else:
            return format_html("{:.1f} MB", obj.file_size / (1024 * 1024))

    size_display.short_description = 'Rozmiar'


class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['created_at', 'type', 'level', 'user', 'message_short',
                    'entity_display', 'adres_ip']
    list_filter = ['type', 'level', 'created_at']
    search_fields = ['message', 'user__email', 'adres_ip']
    ordering = ['-created_at']
    date_hierarchy = 'created_at'
    readonly_fields = ['created_at']
    raw_id_fields = ['user']
    fieldsets = (
        (_('Log'), {
            'fields': ('created_at', 'type', 'level', 'message'),
        }),
        (_('Użytkownik'), {
            'fields': ('user', 'adres_ip', 'user_agent'),
        }),
        (_('Encja'), {
            'fields': ('entity_type', 'entity_id'),
            'classes': ('collapse',),
        }),
        (_('Metadata'), {
            'fields': ('metadata',),
            'classes': ('collapse',),
        }),
    )

    def message_short(self, obj):
        short_message = obj.message[:50] + '...' if len(obj.message) > 50 else obj.message
        return format_html("{}", short_message)

    message_short.short_description = 'Opis'

    def entity_display(self, obj):
        if obj.entity_type and obj.entity_id:
            return format_html("{} ({})", obj.entity_type, str(obj.entity_id)[:8])
        return format_html("{}", '-')

    entity_display.short_description = 'Encja'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


class SystemSettingsAdmin(admin.ModelAdmin):
    list_display = ['salon_name', 'slot_minutes', 'buffer_minutes',
                    'maintenance_mode', 'last_modified_by']
    readonly_fields = ['created_at', 'updated_at', 'last_modified_by']
    raw_id_fields = ['last_modified_by']
    fieldsets = (
        (_('Salon'), {
            'fields': ('salon_name', 'address', 'phone', 'contact_email'),
        }),
        (_('Harmonogram'), {
            'fields': ('slot_minutes', 'buffer_minutes', 'opening_hours'),
        }),
        (_('Polityki'), {
            'fields': ('deposit_policy',),
        }),
        (_('Finansowe'), {
            'fields': ('default_vat_rate',),
        }),
        (_('Konserwacja'), {
            'fields': ('maintenance_mode', 'maintenance_message'),
        }),
        (_('Metadata'), {
            'fields': ('last_modified_by', 'created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    def has_add_permission(self, request):
        return not SystemSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        if change:
            obj.last_modified_by = request.user
        super().save_model(request, obj, form, change)


class StatsSnapshotAdmin(admin.ModelAdmin):
    list_display = ['period', 'date_from', 'date_to', 'total_visits',
                    'completed_visits', 'revenue_total', 'employees_occupancy_avg']
    list_filter = ['period', 'date_from']
    ordering = ['-date_from']
    date_hierarchy = 'date_from'
    readonly_fields = ['created_at']
    fieldsets = (
        (_('Okres'), {
            'fields': ('period', 'date_from', 'date_to'),
        }),
        (_('Wizyty'), {
            'fields': ('total_visits', 'completed_visits',
                       'cancellations', 'no_shows'),
        }),
        (_('Przychody'), {
            'fields': ('revenue_total', 'revenue_deposits'),
        }),
        (_('Klienci'), {
            'fields': ('new_clients', 'returning_clients'),
        }),
        (_('Pracownicy'), {
            'fields': ('employees_occupancy_avg',),
        }),
        (_('Dodatkowe'), {
            'fields': ('extra_metrics',),
            'classes': ('collapse',),
        }),
    )

    def has_add_permission(self, request):
        return False


class MediaAssetAdmin(admin.ModelAdmin):
    list_display = ['id_short', 'type', 'employee', 'file_name',
                    'size_display', 'is_active', 'created_at']
    list_filter = ['type', 'is_active', 'created_at']
    search_fields = ['file_name', 'description', 'employee__first_name', 'employee__last_name']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'file_size', 'size_bytes']
    raw_id_fields = ['employee', 'client', 'appointment']
    actions = ['activate_assets', 'deactivate_assets']
    fieldsets = (
        (_('Materiał'), {
            'fields': ('type', 'name', 'employee', 'client', 'appointment', 'description'),
        }),
        (_('Plik'), {
            'fields': ('file', 'file_url', 'file_name', 'file_size', 'size_bytes', 'mime_type'),
        }),
        (_('Status'), {
            'fields': ('is_active', 'is_private'),
        }),
    )

    def id_short(self, obj):
        return format_html("{}", str(obj.id)[:8])

    id_short.short_description = 'ID'

    def size_display(self, obj):
        if not obj.file_size:
            return format_html("{}", '-')
        if obj.file_size < 1024:
            return format_html("{} B", obj.file_size)
        elif obj.file_size < 1024 * 1024:
            return format_html("{:.1f} KB", obj.file_size / 1024)
        else:
            return format_html("{:.1f} MB", obj.file_size / (1024 * 1024))

    size_display.short_description = 'Rozmiar'

    def activate_assets(self, request, queryset: QuerySet):
        updated = queryset.update(is_active=True)
        self.message_user(request, format_html('Aktywowano {} materiałów.', updated))

    activate_assets.short_description = 'Aktywuj wybrane materiały'

    def deactivate_assets(self, request, queryset: QuerySet):
        updated = queryset.update(is_active=False)
        self.message_user(request, format_html('Deaktywowano {} materiałów.', updated))

    deactivate_assets.short_description = 'Deaktywuj wybrane materiały'


class NoteAdmin(admin.ModelAdmin):
    list_display = ['id_short', 'appointment_link', 'author',
                    'created_at', 'visible_for_client', 'content_short']
    list_filter = ['visible_for_client', 'created_at']
    search_fields = ['content', 'appointment__client__first_name', 'appointment__client__last_name', 'author__email']
    ordering = ['-created_at']
    date_hierarchy = 'created_at'
    readonly_fields = ['created_at', 'author']
    raw_id_fields = ['appointment', 'client', 'author']
    fieldsets = (
        (_('Notatka'), {
            'fields': ('appointment', 'client', 'author', 'content'),
        }),
        (_('Widoczność'), {
            'fields': ('visible_for_client',),
        }),
        (_('Czas'), {
            'fields': ('created_at',),
        }),
    )

    def id_short(self, obj):
        return format_html("{}", str(obj.id)[:8])

    id_short.short_description = 'ID'

    def content_short(self, obj):
        short_content = obj.content[:50] + '...' if len(obj.content) > 50 else obj.content
        return format_html("{}", short_content)

    content_short.short_description = 'Treść'

    def appointment_link(self, obj):
        if obj.appointment:
            opts = obj.appointment._meta
            url = reverse(
                f'{admin_site.name}:{opts.app_label}_{opts.model_name}_change',
                args=[obj.appointment.pk]
            )
            return format_html('<a href="{}">Wizyta #{}</a>', url, str(obj.appointment.id)[:8])
        return format_html("{}", '-')

    appointment_link.short_description = 'Wizyta'

    def save_model(self, request, obj, form, change):
        if not obj.pk:
            obj.author = request.user
        super().save_model(request, obj, form, change)


# ============================================================================
# 8. AKTYWACJA CUSTOM ADMIN SITE
# ============================================================================

admin_site = BeautySalonAdminSite(name='beauty_salon_admin')

# Rejestracja wszystkich modeli w admin_site
admin_site.register(CustomUser, UserAdmin)
admin_site.register(Service, ServiceAdmin)
admin_site.register(Employee, EmployeeAdmin)
admin_site.register(Schedule, ScheduleAdmin)
admin_site.register(TimeOff, TimeOffAdmin)
admin_site.register(Client, ClientAdmin)
admin_site.register(Appointment, AppointmentAdmin)
admin_site.register(Note, NoteAdmin)
admin_site.register(MediaAsset, MediaAssetAdmin)
admin_site.register(Payment, PaymentAdmin)
admin_site.register(Invoice, InvoiceAdmin)
admin_site.register(Notification, NotificationAdmin)
admin_site.register(ReportPDF, ReportPDFAdmin)
admin_site.register(AuditLog, AuditLogAdmin)
admin_site.register(SystemSettings, SystemSettingsAdmin)
admin_site.register(StatsSnapshot, StatsSnapshotAdmin)