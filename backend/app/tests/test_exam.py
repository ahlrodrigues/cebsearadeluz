from fastapi.testclient import TestClient


def create_user(client: TestClient, **overrides) -> int:
    payload = {
        "full_name": "Teste Exame",
        "email": "exame@example.com",
        "password": "senhaSegura1",
        "status": "Ativo",
        "role": "user",
    }
    payload.update(overrides)
    response = client.post("/users", json=payload)
    assert response.status_code == 201
    return response.json()["id"]


def test_exam_record_crud_flow(client: TestClient):
    user_id = create_user(client)

    response = client.get(f"/users/{user_id}/exam")
    assert response.status_code == 404

    create_payload = {
        "answers": "Respostas iniciais",
        "observations": "Observações iniciais",
        "recommendations": [
            "evangelho_no_lar",
            "preces",
        ],
        "next_pass_type": "P2",
    }
    response = client.post(f"/users/{user_id}/exam", json=create_payload)
    assert response.status_code == 201
    created = response.json()
    assert created["answers"] == "Respostas iniciais"
    assert created["recommendations"] == ["evangelho_no_lar", "preces"]
    assert created["next_pass_type"] == "P2"

    duplicate = client.post(f"/users/{user_id}/exam", json=create_payload)
    assert duplicate.status_code == 400

    fetch = client.get(f"/users/{user_id}/exam")
    assert fetch.status_code == 200
    assert fetch.json()["id"] == created["id"]

    update_payload = {
        "answers": "Respostas atualizadas",
        "recommendations": ["otimismo", "confiar_em_jesus"],
        "next_pass_type": "P3A",
    }
    update_response = client.put(
        f"/users/{user_id}/exam",
        json=update_payload,
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["answers"] == "Respostas atualizadas"
    assert updated["observations"] == "Observações iniciais"
    assert updated["recommendations"] == [
        "otimismo",
        "confiar_em_jesus",
    ]
    assert updated["next_pass_type"] == "P3A"


def test_put_creates_exam_when_missing(client: TestClient):
    user_id = create_user(client, email="novo.exame@example.com")

    response = client.put(
        f"/users/{user_id}/exam",
        json={"observations": "Anotações"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["observations"] == "Anotações"
    assert data["recommendations"] == []

