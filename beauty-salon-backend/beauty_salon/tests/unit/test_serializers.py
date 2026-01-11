import pytest


@pytest.mark.unit
@pytest.mark.django_db
class TestServiceSerializer:

    def test_serialize_service(self, service):
        from beauty_salon.serializers import ServiceSerializer

        serializer = ServiceSerializer(service)
        data = serializer.data

        assert data["name"] == "Manicure"
        assert data["price"] == "80.00"
        assert data["duration_minutes"] == 60
        assert data["is_active"] is True

    def test_deserialize_valid_service(self):
        from beauty_salon.serializers import ServiceSerializer

        data = {
            "name": "Pedicure",
            "category": "Paznokcie",
            "price": "100.00",
            "duration_minutes": 45,
            "is_active": True,
        }

        serializer = ServiceSerializer(data=data)
        assert serializer.is_valid()
        service = serializer.save()
        assert service.name == "Pedicure"


@pytest.mark.unit
@pytest.mark.django_db
class TestAppointmentSerializer:

    def test_serialize_appointment(self, appointment):
        from beauty_salon.serializers import AppointmentSerializer

        serializer = AppointmentSerializer(appointment)
        data = serializer.data

        assert data["status"] == "PENDING"
        assert "client" in data
        assert "employee" in data
        assert "service" in data


@pytest.mark.unit
@pytest.mark.django_db
class TestEmployeeSerializer:

    def test_serialize_employee(self, employee_profile):
        from beauty_salon.serializers import EmployeeSerializer

        serializer = EmployeeSerializer(employee_profile)
        data = serializer.data

        assert "employee_number" in data
        assert "user" in data
        assert "user_username" in data
        assert "user_email" in data


@pytest.mark.unit
@pytest.mark.django_db
class TestClientSerializer:

    def test_serialize_client(self, client_profile):
        from beauty_salon.serializers import ClientSerializer

        serializer = ClientSerializer(client_profile)
        data = serializer.data

        assert "client_number" in data
        assert "user_id" in data
        assert "user_username" in data
        assert "user_email" in data


@pytest.mark.unit
@pytest.mark.django_db
class TestTimeOffSerializer:

    def test_serialize_timeoff(self, pending_timeoff):
        from beauty_salon.serializers import TimeOffSerializer

        serializer = TimeOffSerializer(pending_timeoff)
        data = serializer.data

        assert data["status"] == "PENDING"
        assert "employee" in data
        assert "reason" in data
