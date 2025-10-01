import pytest
from datetime import date

from fastapi.testclient import TestClient

from .test_passes import create_assistido

from ..models import User
from ..security import verify_password
from .conftest import TestingSessionLocal


def test_create_user(client: TestClient):
    response = client.post(
        "/users",
        json={
            "full_name": "Maria da Silva",
            "email": "maria@example.com",
            "password": "senhaSegura1",
            "social_name": "Maria Silva",
            "birth_date": "1990-01-20",
            "cep": "12345-678",
            "street": "Rua das Flores",
            "number": "100",
            "complement": "Apto 101",
            "neighborhood": "Centro",
            "city": "Sao Paulo",
            "state": "SP",
            "phone": "(11)98765-4321",
            "social_network": "@maria",
            "status": "Ativo",
            "role": "user",
            "assistance_day": "Segunda-feira",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["id"] > 0
    assert data["email"] == "maria@example.com"
    assert data["full_name"] == "Maria da Silva"
    assert data["social_name"] == "Maria Silva"
    assert data["birth_date"] == "1990-01-20"
    assert data["cep"] == "12345-678"
    assert data["street"] == "Rua das Flores"
    assert data["number"] == "100"
    assert data["complement"] == "Apto 101"
    assert data["neighborhood"] == "Centro"
    assert data["city"] == "Sao Paulo"
    assert data["state"] == "SP"
    assert data["phone"] == "(11)98765-4321"
    assert data["social_network"] == "@maria"
    assert data["status"] == "Ativo"
    assert data["role"] == "user"
    assert data["assistance_day"] == "Segunda-feira"


def test_prevent_duplicate_emails(client: TestClient):
    client.post(
        "/users",
        json={
            "full_name": "Maria da Silva",
            "email": "maria@example.com",
            "password": "senhaSegura1",
            "status": "Ativo",
        },
    )
    response = client.post(
        "/users",
        json={
            "full_name": "Maria Souza",
            "email": "maria@example.com",
            "password": "senhaSegura1",
            "status": "Ativo",
            "assistance_day": "Terça-feira",
        },
    )
    assert response.status_code == 400


def test_list_users(client: TestClient):
    client.post(
        "/users",
        json={
            "full_name": "Maria da Silva",
            "email": "maria@example.com",
            "password": "senhaSegura1",
            "status": "Ativo",
        },
    )
    response = client.get("/users")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["email"] == "maria@example.com"
    assert data[0]["status"] == "Ativo"
    assert data[0]["role"] == "user"


def test_filter_users_by_status(client: TestClient):
    client.post(
        "/users",
        json={
            "full_name": "Maria da Silva",
            "email": "maria@example.com",
            "password": "senhaSegura1",
            "status": "Ativo",
        },
    )
    response_inactive = client.post(
        "/users",
        json={
            "full_name": "João Pereira",
            "email": "joao@example.com",
            "password": "senhaSegura1",
            "status": "Desativado",
            "assistance_day": "Quinta-feira",
        },
    )
    user_inactive_id = response_inactive.json()["id"]

    response = client.get("/users", params={"status": "Desativado"})
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == user_inactive_id
    assert data[0]["status"] == "Desativado"


def test_search_users_by_name(client: TestClient):
    client.post(
        "/users",
        json={
            "full_name": "Ana Beatriz",
            "email": "ana@example.com",
            "password": "senhaSegura1",
            "status": "Ativo",
            "assistance_day": "Sexta-feira",
        },
    )
    client.post(
        "/users",
        json={
            "full_name": "Bruno Souza",
            "email": "bruno@example.com",
            "password": "senhaSegura1",
            "status": "Ativo",
        },
    )
    client.post(
        "/users",
        json={
            "full_name": "Carlos Ferreira",
            "social_name": "Carlito",
            "email": "carlos@example.com",
            "password": "senhaSegura1",
            "status": "Ativo",
        },
    )

    response = client.get("/users", params={"search": "bruno"})
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["full_name"] == "Bruno Souza"

    response_social = client.get("/users", params={"search": "carlito"})
    assert response_social.status_code == 200
    data_social = response_social.json()
    assert len(data_social) == 1
    assert data_social[0]["full_name"] == "Carlos Ferreira"


def test_user_response_contains_active_cycle_summary(client: TestClient):
    inactive_user_response = client.post(
        "/users",
        json={
            "full_name": "Sem Ciclo",
            "email": "semciclo@example.com",
            "password": "senhaSegura1",
            "status": "Ativo",
        },
    )
    assert inactive_user_response.status_code == 201
    inactive_user_id = inactive_user_response.json()["id"]

    user_with_cycle_id = create_assistido(client)
    presence_response = client.post(
        f"/users/{user_with_cycle_id}/passes/presence",
        json={"date": date(2025, 1, 1).isoformat()},
    )
    assert presence_response.status_code == 201

    list_response = client.get("/users")
    assert list_response.status_code == 200
    users = list_response.json()

    target = next(user for user in users if user["id"] == user_with_cycle_id)
    assert target["has_active_cycle"] is True
    assert target["active_cycle_stage_number"] == 1
    assert target["active_cycle_presence_count"] == 1
    assert target["active_cycle_absence_count"] == 0
    assert target["active_cycle_pass_type"]

    other = next(user for user in users if user["id"] == inactive_user_id)
    assert other["has_active_cycle"] is False
    assert other["active_cycle_pass_type"] is None

    detail_response = client.get(f"/users/{user_with_cycle_id}")
    assert detail_response.status_code == 200
    detail = detail_response.json()
    assert detail["has_active_cycle"] is True
    assert detail["active_cycle_stage_number"] == 1
    assert detail["active_cycle_presence_count"] == 1


def test_update_user(client: TestClient):
    response = client.post(
        "/users",
        json={
            "full_name": "Maria da Silva",
            "email": "maria@example.com",
            "password": "senhaSegura1",
            "status": "Ativo",
        },
    )
    user_id = response.json()["id"]
    response = client.put(
        f"/users/{user_id}",
        json={
            "full_name": "Maria de Souza",
            "password": "NovaSenhaSegura2",
            "status": "Desativado",
            "role": "admin",
            "phone": "(11)90000-1234",
            "assistance_day": None,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == "Maria de Souza"
    assert data["status"] == "Desativado"
    assert data["role"] == "admin"
    assert data["phone"] == "(11)90000-1234"
    assert data["assistance_day"] is None

    with TestingSessionLocal() as db:
        user: User | None = db.get(User, user_id)
        assert user is not None
        assert verify_password("NovaSenhaSegura2", user.hashed_password)
        assert user.status == "Desativado"
        assert user.role == "admin"
        assert user.is_active is False
        assert user.assistance_day is None


def test_user_qr_prefers_social_name(client: TestClient):
    response = client.post(
        "/users",
        json={
            "full_name": "Joana Fernandes",
            "social_name": "Jo",
            "email": "joana@example.com",
            "password": "senhaSegura1",
            "status": "Ativo",
        },
    )
    user_id = response.json()["id"]

    qr_response = client.get(f"/users/{user_id}/qr")
    assert qr_response.status_code == 200
    qr_data = qr_response.json()
    assert qr_data == {"id": user_id, "name": "Jo"}

    client.put(
        f"/users/{user_id}",
        json={"social_name": None},
    )

    qr_response_no_social = client.get(f"/users/{user_id}/qr")
    assert qr_response_no_social.status_code == 200
    qr_data_no_social = qr_response_no_social.json()
    assert qr_data_no_social == {"id": user_id, "name": "Joana Fernandes"}



def test_delete_user(client: TestClient):
    response = client.post(
        "/users",
        json={
            "full_name": "Maria da Silva",
            "email": "maria@example.com",
            "password": "senhaSegura1",
            "status": "Ativo",
        },
    )
    user_id = response.json()["id"]
    response = client.delete(f"/users/{user_id}")
    assert response.status_code == 204

    response = client.get(f"/users/{user_id}")
    assert response.status_code == 404
