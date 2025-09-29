from datetime import date

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from . import crud, models, passes, schemas
from .database import Base, engine, get_db

Base.metadata.create_all(bind=engine)

app = FastAPI(title="User Management API", version="0.1.0")

ALLOWED_ORIGINS = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/users", response_model=schemas.User, status_code=status.HTTP_201_CREATED)
def create_user(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    if user_in.email:
        existing_user = crud.get_user_by_email(db, user_in.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Já existe um usuário cadastrado com esse e-mail.",
            )
    user = crud.create_user(db, user_in)
    return user


@app.get("/users", response_model=list[schemas.User])
def read_users(
    skip: int = 0,
    limit: int = 100,
    search: str | None = None,
    status: schemas.UserStatus | None = None,
    role: schemas.UserRole | None = None,
    db: Session = Depends(get_db),
):
    users = crud.get_users(
        db,
        skip=skip,
        limit=limit,
        search=search,
        status=status.value if status else None,
        role=role.value if role else None,
    )
    return users


@app.get("/users/{user_id}", response_model=schemas.User)
def read_user(user_id: int, db: Session = Depends(get_db)):
    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    return user


@app.put("/users/{user_id}", response_model=schemas.User)
def update_user(user_id: int, user_in: schemas.UserUpdate, db: Session = Depends(get_db)):
    db_user = crud.get_user(db, user_id)
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")

    if user_in.email and user_in.email != db_user.email:
        existing_user = crud.get_user_by_email(db, user_in.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Já existe um usuário cadastrado com esse e-mail.",
            )

    updated_user = crud.update_user(db, db_user, user_in)
    return updated_user


@app.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db)):
    db_user = crud.get_user(db, user_id)
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    crud.delete_user(db, db_user)
    return None


@app.get("/users/{user_id}/qr", response_model=schemas.UserQRCode)
def get_user_qr(user_id: int, db: Session = Depends(get_db)):
    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    display_name = user.social_name or user.full_name
    return schemas.UserQRCode(id=user.id, name=display_name)


@app.get("/users/{user_id}/pass-cycles", response_model=list[schemas.PassCycle])
def list_pass_cycles(user_id: int, db: Session = Depends(get_db)):
    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    cycles = passes.list_cycles(db, user_id)
    return cycles


@app.get("/users/{user_id}/pass-cycles/active", response_model=schemas.PassCycle)
def get_active_pass_cycle(user_id: int, db: Session = Depends(get_db)):
    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    cycle = passes.get_active_cycle(db, user_id)
    if not cycle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não possui ciclo de passes ativo.",
        )
    return cycle


@app.post(
    "/users/{user_id}/passes/presence",
    response_model=schemas.PassSession,
    status_code=status.HTTP_201_CREATED,
)
def register_pass_presence(
    user_id: int,
    payload: schemas.PassPresenceRequest,
    db: Session = Depends(get_db),
):
    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    presence_date = payload.date or date.today()
    session = passes.register_presence(
        db,
        user_id=user_id,
        presence_date=presence_date,
        notes=payload.notes,
    )
    return session


@app.post(
    "/users/{user_id}/passes/absence",
    response_model=schemas.PassSession,
    status_code=status.HTTP_201_CREATED,
)
def register_pass_absence(
    user_id: int,
    payload: schemas.PassAbsenceRequest,
    db: Session = Depends(get_db),
):
    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    absence_date = payload.date or date.today()
    session = passes.register_absence(
        db,
        user_id=user_id,
        scheduled_date=absence_date,
        notes=payload.notes,
    )
    return session
