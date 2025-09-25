import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from ..database import Base, get_db
from ..main import app
from ..models import User
from ..security import verify_password

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

test_engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(autouse=True)
def clean_tables():
    with test_engine.begin() as connection:
        for table in reversed(Base.metadata.sorted_tables):
            connection.execute(table.delete())


@pytest.fixture()
def db_session():
    session: Session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


def test_create_user():
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


def test_prevent_duplicate_emails():
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
        },
    )
    assert response.status_code == 400


def test_list_users():
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


def test_filter_users_by_status():
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
        },
    )
    user_inactive_id = response_inactive.json()["id"]

    response = client.get("/users", params={"status": "Desativado"})
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == user_inactive_id
    assert data[0]["status"] == "Desativado"


def test_search_users_by_name():
    client.post(
        "/users",
        json={
            "full_name": "Ana Beatriz",
            "email": "ana@example.com",
            "password": "senhaSegura1",
            "status": "Ativo",
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

    response = client.get("/users", params={"search": "bruno"})
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["full_name"] == "Bruno Souza"


def test_update_user():
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
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == "Maria de Souza"
    assert data["status"] == "Desativado"
    assert data["role"] == "admin"
    assert data["phone"] == "(11)90000-1234"

    with TestingSessionLocal() as db:
        user: User | None = db.get(User, user_id)
        assert user is not None
        assert verify_password("NovaSenhaSegura2", user.hashed_password)
        assert user.status == "Desativado"
        assert user.role == "admin"
        assert user.is_active is False


def test_delete_user():
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
