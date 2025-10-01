from datetime import date, timedelta

from fastapi.testclient import TestClient

from backend.app import passes, schemas
from .conftest import TestingSessionLocal


def create_assistido(client: TestClient) -> int:
    response = client.post(
        "/users",
        json={
            "full_name": "Joana Teste",
            "email": "joana@example.com",
            "password": "senhaSegura1",
            "status": "Ativo",
            "role": "user",
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_register_presence_creates_cycle(client: TestClient):
    user_id = create_assistido(client)
    today = date(2025, 1, 1)

    response = client.post(
        f"/users/{user_id}/passes/presence",
        json={"date": today.isoformat()},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "Presente"
    assert data["sequence_index"] == 1

    cycles_response = client.get(f"/users/{user_id}/pass-cycles")
    assert cycles_response.status_code == 200
    cycles = cycles_response.json()
    assert len(cycles) == 1
    cycle = cycles[0]
    assert cycle["stage_number"] == 1
    assert cycle["status"] == "Ativo"
    assert len(cycle["sessions"]) == 1


def test_sequence_completion_advances_stage(client: TestClient):
    user_id = create_assistido(client)
    base_date = date(2025, 1, 1)

    for week in range(4):
        presence_date = base_date + timedelta(days=7 * week)
        response = client.post(
            f"/users/{user_id}/passes/presence",
            json={"date": presence_date.isoformat()},
        )
        assert response.status_code == 201

    cycles_response = client.get(f"/users/{user_id}/pass-cycles")
    assert cycles_response.status_code == 200
    cycles = cycles_response.json()
    assert len(cycles) == 2

    first_cycle, second_cycle = cycles[1], cycles[0]

    assert first_cycle["stage_number"] == 1
    assert first_cycle["status"] == "Concluído"
    assert first_cycle["requires_interview"] is True
    assert len(first_cycle["sessions"]) == 4

    assert second_cycle["stage_number"] == 2
    assert second_cycle["status"] == "Ativo"
    assert second_cycle["sessions"] == []


def test_consecutive_absences_restart_cycle(client: TestClient):
    user_id = create_assistido(client)
    base_date = date(2025, 1, 1)

    client.post(
        f"/users/{user_id}/passes/absence",
        json={"date": base_date.isoformat()},
    )
    client.post(
        f"/users/{user_id}/passes/absence",
        json={"date": (base_date + timedelta(days=7)).isoformat()},
    )

    response_presence = client.post(
        f"/users/{user_id}/passes/presence",
        json={"date": (base_date + timedelta(days=14)).isoformat()},
    )
    assert response_presence.status_code == 201
    presence_data = response_presence.json()
    assert presence_data["sequence_index"] == 1

    cycles_response = client.get(f"/users/{user_id}/pass-cycles")
    cycles = cycles_response.json()
    assert len(cycles) == 2

    interrupted_cycle, active_cycle = cycles[1], cycles[0]

    assert interrupted_cycle["status"] == "Interrompido"
    assert active_cycle["status"] == "Ativo"
    assert active_cycle["stage_number"] == 1
    assert len(active_cycle["sessions"]) == 1


def test_get_active_cycle_endpoint(client: TestClient):
    user_id = create_assistido(client)

    response = client.get(f"/users/{user_id}/pass-cycles/active")
    assert response.status_code == 404

    client.post(
        f"/users/{user_id}/passes/presence",
        json={},
    )

    response = client.get(f"/users/{user_id}/pass-cycles/active")
    assert response.status_code == 200
    cycle = response.json()
    assert cycle["status"] == "Ativo"
    assert cycle["stage_number"] == 1
    assert len(cycle["sessions"]) == 1


def test_automatic_absence_registered_next_day(client: TestClient):
    response = client.post(
        "/users",
        json={
            "full_name": "Ana Automática",
            "email": "auto@example.com",
            "password": "senhaSegura1",
            "status": "Ativo",
            "assistance_day": "Segunda-feira",
        },
    )
    assert response.status_code == 201
    user_id = response.json()["id"]

    with TestingSessionLocal() as session:
        passes.register_presence(
            session,
            user_id=user_id,
            presence_date=date(2025, 1, 6),
        )

        passes.ensure_pending_absences(
            session,
            user_id=user_id,
            reference_date=date(2025, 1, 14),
        )

        cycle = passes.get_active_cycle(session, user_id)
        assert cycle is not None
        absence = next(
            (s for s in cycle.sessions if s.scheduled_for == date(2025, 1, 13)),
            None,
        )
        assert absence is not None
        assert absence.status == schemas.PassSessionStatus.AUSENTE.value
        assert absence.notes == "Ausência registrada automaticamente."

        passes.ensure_pending_absences(
            session,
            user_id=user_id,
            reference_date=date(2025, 1, 14),
        )
        cycle = passes.get_active_cycle(session, user_id)
        assert cycle is not None
        occurrences = [
            s for s in cycle.sessions if s.scheduled_for == date(2025, 1, 13)
        ]
        assert len(occurrences) == 1
