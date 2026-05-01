"""Create an admin account for self-hosted deployments."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from sqlmodel import Session, select

sys.path.append(str(Path(__file__).resolve().parents[2]))

from Backend.auth.passwords import hash_password
from Backend.auth.sessions import normalize_email
from Backend.db import engine
from Backend.models import User
from Backend.services.onboarding import seed_user_starter_data


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create an admin user account.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--display-name", required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    email = normalize_email(args.email)

    with Session(engine) as session:
        existing = session.exec(select(User).where(User.email == email)).one_or_none()
        if existing is not None:
            summary = seed_user_starter_data(session, existing)
            session.commit()
            print(f"Admin user already exists for {email}.")
            print(
                "Seeded starter data: "
                f"{summary['ingredients']} ingredients, "
                f"{summary['foods']} foods, {summary['plans']} plans."
            )
            return 0

        user = User(
            email=email,
            password_hash=hash_password(args.password),
            display_name=args.display_name.strip(),
            is_admin=True,
        )
        session.add(user)
        session.flush()
        summary = seed_user_starter_data(session, user)
        session.commit()
        session.refresh(user)

    print(f"Created admin user {user.email} ({user.id}).")
    print(
        "Seeded starter data: "
        f"{summary['ingredients']} ingredients, "
        f"{summary['foods']} foods, {summary['plans']} plans."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
