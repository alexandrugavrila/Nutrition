"""Seed starter dataset rows for an existing user account."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from sqlmodel import Session, select

sys.path.append(str(Path(__file__).resolve().parents[2]))

from Backend.auth.sessions import normalize_email
from Backend.db import engine
from Backend.models import User
from Backend.services.onboarding import seed_user_starter_data


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed starter data for a user.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--email", help="User email to seed.")
    group.add_argument("--user-id", help="User id to seed.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    with Session(engine) as session:
        if args.email:
            user = session.exec(
                select(User).where(User.email == normalize_email(args.email))
            ).one_or_none()
        else:
            user = session.get(User, args.user_id)
        if user is None:
            print("User not found.")
            return 1
        summary = seed_user_starter_data(session, user)
        session.commit()
        print(
            "Seeded starter data for "
            f"{user.email}: {summary['ingredients']} ingredients, "
            f"{summary['foods']} foods, {summary['plans']} plans."
        )
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
