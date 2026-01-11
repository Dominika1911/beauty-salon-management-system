import threading
from datetime import timedelta
from concurrent.futures import ThreadPoolExecutor

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from beauty_salon.models import Appointment

pytestmark = pytest.mark.integration


@pytest.mark.django_db(transaction=True)
def test_race_condition_double_booking_same_slot_results_in_single_appointment(
    admin_user, employee_profile, client_profile, service
):

    start = timezone.now() + timedelta(days=3, hours=10)
    payload = {
        "service_id": service.id,
        "employee_id": employee_profile.id,
        "start": start.isoformat(),
        "client_id": client_profile.id,
    }

    barrier = threading.Barrier(2)

    def do_post():
        c = APIClient()
        c.force_authenticate(user=admin_user)
        barrier.wait()
        return c.post("/api/appointments/book/", payload, format="json")

    with ThreadPoolExecutor(max_workers=2) as ex:
        r1, r2 = ex.submit(do_post), ex.submit(do_post)
        resp1, resp2 = r1.result(), r2.result()

    codes = {resp1.status_code, resp2.status_code}
    assert codes == {201, 400}

    assert (
        Appointment.objects.filter(
            employee_id=employee_profile.id,
            start=start,
            status__in=[Appointment.Status.PENDING, Appointment.Status.CONFIRMED],
        ).count()
        == 1
    )
