from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.models.user import UserRole


class UserPublic(BaseModel):
    id: int
    email: EmailStr
    role: UserRole
    created_at: datetime
