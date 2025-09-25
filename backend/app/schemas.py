from datetime import date, datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserStatus(str, Enum):
    ATIVO = "Ativo"
    DESATIVADO = "Desativado"


class UserRole(str, Enum):
    USER = "user"
    ADMIN = "admin"


class UserBase(BaseModel):
    full_name: str = Field(..., max_length=255)
    social_name: Optional[str] = Field(None, max_length=255)
    birth_date: Optional[date] = None
    cep: Optional[str] = Field(default=None, pattern=r"^\d{5}-?\d{3}$")
    street: Optional[str] = Field(None, max_length=255)
    number: Optional[str] = Field(None, max_length=20)
    complement: Optional[str] = Field(None, max_length=255)
    neighborhood: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=255)
    state: Optional[str] = Field(None, min_length=2, max_length=2)
    phone: Optional[str] = Field(
        default=None,
        pattern=r"^(\d{10,11}|(\(\d{2}\)\s?)?\d{4,5}-?\d{4})$",
    )
    email: Optional[EmailStr] = None
    social_network: Optional[str] = Field(None, max_length=255)
    status: UserStatus = Field(default=UserStatus.ATIVO)
    role: UserRole = Field(default=UserRole.USER)


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128)


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, max_length=255)
    social_name: Optional[str] = Field(None, max_length=255)
    birth_date: Optional[date] = None
    cep: Optional[str] = Field(default=None, pattern=r"^\d{5}-?\d{3}$")
    street: Optional[str] = Field(None, max_length=255)
    number: Optional[str] = Field(None, max_length=20)
    complement: Optional[str] = Field(None, max_length=255)
    neighborhood: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=255)
    state: Optional[str] = Field(None, min_length=2, max_length=2)
    phone: Optional[str] = Field(
        default=None,
        pattern=r"^(\d{10,11}|(\(\d{2}\)\s?)?\d{4,5}-?\d{4})$",
    )
    email: Optional[EmailStr] = None
    social_network: Optional[str] = Field(None, max_length=255)
    status: Optional[UserStatus] = None
    role: Optional[UserRole] = None
    password: Optional[str] = Field(None, min_length=8, max_length=128)


class UserInDBBase(UserBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class User(UserInDBBase):
    pass
