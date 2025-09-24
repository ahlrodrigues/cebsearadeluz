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
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["id"] > 0
    assert data["email"] == "maria@example.com"
    assert data["full_name"] == "Maria da Silva"
    assert data["is_active"] is True


def test_prevent_duplicate_emails():
    client.post(
        "/users",
        json={
            "full_name": "Maria da Silva",
            "email": "maria@example.com",
            "password": "senhaSegura1",
        },
    )
    response = client.post(
        "/users",
        json={
            "full_name": "Maria Souza",
            "email": "maria@example.com",
            "password": "senhaSegura1",
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
        },
    )
    response = client.get("/users")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["email"] == "maria@example.com"


def test_update_user():
    response = client.post(
        "/users",
        json={
            "full_name": "Maria da Silva",
            "email": "maria@example.com",
            "password": "senhaSegura1",
        },
    )
    user_id = response.json()["id"]
    response = client.put(
        f"/users/{user_id}",
        json={"full_name": "Maria de Souza", "password": "NovaSenhaSegura2"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == "Maria de Souza"

    with TestingSessionLocal() as db:
        user: User | None = db.get(User, user_id)
        assert user is not None
        assert verify_password("NovaSenhaSegura2", user.hashed_password)


def test_delete_user():
    response = client.post(
        "/users",
        json={
            "full_name": "Maria da Silva",
            "email": "maria@example.com",
            "password": "senhaSegura1",
        },
    )
    user_id = response.json()["id"]
    response = client.delete(f"/users/{user_id}")
    assert response.status_code == 204

    response = client.get(f"/users/{user_id}")
    assert response.status_code == 404
