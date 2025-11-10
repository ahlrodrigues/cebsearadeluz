import datetime as dt
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserStatus(str, Enum):
    ATIVO = "Ativo"
    DESATIVADO = "Desativado"


class UserRole(str, Enum):
    USER = "user"           # assistido
    ENTREVISTA = "entrevista"
    RECEPCAO = "recepcao"
    EXAME = "exame"
    ADMIN = "admin"


class AssistanceDay(str, Enum):
    SEGUNDA = "Segunda-feira"
    TERCA = "Terça-feira"
    QUARTA = "Quarta-feira"
    QUINTA = "Quinta-feira"
    SEXTA = "Sexta-feira"
    SABADO = "Sábado"
    DOMINGO = "Domingo"


class UserBase(BaseModel):
    full_name: str = Field(..., max_length=255)
    social_name: Optional[str] = Field(None, max_length=255)
    birth_date: Optional[dt.date] = None
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
    assistance_day: Optional[AssistanceDay] = Field(default=None)
    # Controle por usuário do login digital (WebAuthn)
    digital_login_enabled: bool = Field(default=True)


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128)


class PublicRegisterRequest(UserCreate):
    pass


class PublicRegisterResponse(BaseModel):
    id: int
    status: UserStatus
    role: UserRole


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, max_length=255)
    social_name: Optional[str] = Field(None, max_length=255)
    birth_date: Optional[dt.date] = None
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
    assistance_day: Optional[AssistanceDay] = None
    digital_login_enabled: Optional[bool] = None


class UserInDBBase(UserBase):
    id: int
    created_at: dt.datetime
    updated_at: Optional[dt.datetime] = None
    has_active_cycle: bool = False
    active_cycle_pass_type: Optional[str] = None
    active_cycle_stage_number: Optional[int] = None
    active_cycle_sequence_length: Optional[int] = None
    active_cycle_presence_count: Optional[int] = None
    active_cycle_absence_count: Optional[int] = None
    active_cycle_next_session: Optional[dt.date] = None
    active_cycle_requires_interview: Optional[bool] = None
    active_cycle_interview_scheduled_for: Optional[dt.date] = None
    active_cycle_last_presence_recorded_at: Optional[dt.datetime] = None

    model_config = ConfigDict(from_attributes=True)


class User(UserInDBBase):
    pass


class UserQRCode(BaseModel):
    id: int
    name: str


class QRScanRequest(BaseModel):
    token: Optional[str] = None
    user_id: Optional[int] = None
    date: Optional[dt.date] = None
    notes: Optional[str] = Field(default=None, max_length=255)

    def resolve_user_id(self) -> Optional[int]:
        return self.user_id


class ScanLog(BaseModel):
    id: int
    created_at: dt.datetime
    raw: Optional[str] = None
    token_type: Optional[str] = None
    scanned_for: Optional[dt.date] = None
    ticket_number: Optional[int] = None
    ok: bool
    error: Optional[str] = None
    user_id: Optional[int] = None
    session_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class ScanKioskResponse(BaseModel):
    ticket_number: int
    user_id: int
    user_name: str
    session: 'PassSession'

class ScanLogView(ScanLog):
    user_name: Optional[str] = None

class ScanLogsSummary(BaseModel):
    date_ref: dt.date
    total: int
    success: int
    failure: int

class PassCycleStatus(str, Enum):
    ATIVO = "Ativo"
    CONCLUIDO = "Concluído"
    INTERROMPIDO = "Interrompido"


class PassType(str, Enum):
    P1 = "P1"
    P2 = "P2"
    P3A = "P3A"
    P3B = "P3B"
    CH = "CH"
    P4A = "P4A"
    P4B = "P4B"


class PassSessionStatus(str, Enum):
    PRESENTE = "Presente"
    AUSENTE = "Ausente"


class PassSessionBase(BaseModel):
    sequence_index: int = Field(ge=1)
    scheduled_for: dt.date
    status: PassSessionStatus = PassSessionStatus.PRESENTE
    notes: Optional[str] = Field(default=None, max_length=255)


class PassSessionCreate(PassSessionBase):
    pass


class PassSessionUpdate(BaseModel):
    scheduled_for: Optional[dt.date] = None
    status: Optional[PassSessionStatus] = None
    notes: Optional[str] = Field(default=None, max_length=255)


class PassSession(PassSessionBase):
    id: int
    cycle_id: int
    presence_recorded_at: Optional[dt.datetime] = None
    created_at: dt.datetime
    updated_at: Optional[dt.datetime] = None

    model_config = ConfigDict(from_attributes=True)

# Resolve forward refs
ScanKioskResponse.model_rebuild()


class PassPresenceRequest(BaseModel):
    date: Optional[dt.date] = Field(default=None)
    notes: Optional[str] = Field(default=None, max_length=255)


class PassAbsenceRequest(BaseModel):
    date: Optional[dt.date] = Field(default=None)
    notes: Optional[str] = Field(default=None, max_length=255)


class PassCycleBase(BaseModel):
    stage_number: int = Field(default=1, ge=1)
    pass_type: PassType = Field(default=PassType.P1)
    status: PassCycleStatus = PassCycleStatus.ATIVO
    sequence_length: int = Field(default=4, ge=1, le=12)
    started_at: dt.date
    completed_at: Optional[dt.date] = None
    interrupted_at: Optional[dt.date] = None
    requires_interview: bool = False
    interview_scheduled_for: Optional[dt.date] = None
    interview_completed_at: Optional[dt.datetime] = None


class PassCycleCreate(PassCycleBase):
    user_id: int


class PassCycleUpdate(BaseModel):
    stage_number: Optional[int] = Field(default=None, ge=1)
    pass_type: Optional[str] = Field(default=None, max_length=50)
    status: Optional[PassCycleStatus] = None
    sequence_length: Optional[int] = Field(default=None, ge=1, le=12)
    started_at: Optional[dt.date] = None
    completed_at: Optional[dt.date] = None
    interrupted_at: Optional[dt.date] = None
    requires_interview: Optional[bool] = None
    interview_scheduled_for: Optional[dt.date] = None
    interview_completed_at: Optional[dt.datetime] = None


class PassCycle(PassCycleBase):
    id: int
    user_id: int
    created_at: dt.datetime
    updated_at: Optional[dt.datetime] = None
    sessions: List[PassSession] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ExamRecommendation(str, Enum):
    EVANGELHO_NO_LAR = "evangelho_no_lar"
    PRECES = "preces"
    LEITURAS = "leituras"
    VIGILANCIA = "vigilancia"
    EAE = "eae"
    TRABALHO = "trabalho"
    OTIMISMO = "otimismo"
    CONFIAR_EM_JESUS = "confiar_em_jesus"


class ExamRecordBase(BaseModel):
    answers: Optional[str] = None
    observations: Optional[str] = None
    recommendations: list[ExamRecommendation] = Field(default_factory=list)
    next_pass_type: Optional[PassType] = None


class ExamRecordCreate(ExamRecordBase):
    pass


class ExamRecordUpdate(BaseModel):
    answers: Optional[str] = None
    observations: Optional[str] = None
    recommendations: Optional[list[ExamRecommendation]] = None
    next_pass_type: Optional[PassType] = None


class ExamRecord(ExamRecordBase):
    id: int
    user_id: int
    created_at: dt.datetime
    updated_at: Optional[dt.datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ExamScheduleRequest(BaseModel):
    date: dt.date


class ExamQueueItem(BaseModel):
    user_id: int
    name: str
    cycle_id: int
    pass_type: Optional[str] = None
    scheduled_for: Optional[dt.date] = None
