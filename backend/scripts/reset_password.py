"""
Reset a user's password by email.

Usage:
  EMAIL=admin@example.com PASS=NewPass123 python -m backend.scripts.reset_password

Optionally:
  python -m backend.scripts.reset_password admin@example.com NewPass123
"""
from __future__ import annotations

import os
import sys

from backend.app.database import SessionLocal
from backend.app import models
from backend.app.security import get_password_hash


def main() -> None:
    email = os.getenv("EMAIL") or (sys.argv[1] if len(sys.argv) > 1 else None)
    password = os.getenv("PASS") or (sys.argv[2] if len(sys.argv) > 2 else None)
    if not email or not password:
        print("Provide EMAIL and PASS (env or args)", file=sys.stderr)
        sys.exit(2)
    with SessionLocal() as db:
        u = db.query(models.User).filter(models.User.email == email).first()
        if not u:
            print(f"User not found: {email}", file=sys.stderr)
            sys.exit(1)
        u.hashed_password = get_password_hash(password)
        u.is_active = True
        if getattr(u, "status", "Ativo") != "Ativo":
            u.status = "Ativo"
        db.add(u)
        db.commit()
        print(f"Password updated for {email}")


if __name__ == "__main__":
    main()

