from __future__ import annotations

import os
from datetime import date

from backend.app.database import SessionLocal  # uses DATABASE_URL env
from backend.app.policies import enforce_auto_deactivation


def main() -> None:
    # Default to 3 months (~90 days)
    months_env = os.environ.get("MONTHS")
    try:
        months = int(months_env) if months_env else 3
    except Exception:
        months = 3
    db = SessionLocal()
    try:
        result = enforce_auto_deactivation(db, months=months)
        print(f"[auto_deactivation] months={result.get('months')} deactivated={result.get('deactivated')} threshold={result.get('threshold')}")
    finally:
        db.close()


if __name__ == "__main__":
    main()

