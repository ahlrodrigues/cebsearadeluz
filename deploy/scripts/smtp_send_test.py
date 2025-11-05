#!/usr/bin/env python3
"""
Send a test e-mail using environment variables (SMTP_* and FRONTEND_BASE_URL).

Usage:
  python3 deploy/scripts/smtp_send_test.py --to you@example.com [--subject "Test"] [--body "..."]

Reads the following env vars:
  SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_STARTTLS (1/0), SMTP_SSL (1/0)

Notes:
  - If SMTP_SSL=1, connects with SMTP over SSL (port 465 typical).
  - Else connects plain and upgrades with STARTTLS when SMTP_STARTTLS=1 (port 587 typical).
"""
import argparse
import os
import smtplib
import ssl
from email.message import EmailMessage


def getenv_bool(key: str, default: bool) -> bool:
    v = os.getenv(key)
    if v is None:
        return default
    return v.strip() in {"1", "true", "TRUE", "yes", "on"}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--to", required=True, help="Destination e-mail address")
    parser.add_argument("--subject", default="SMTP test: CEB Seara de Luz")
    parser.add_argument("--body", default="This is a test message sent by smtp_send_test.py")
    args = parser.parse_args()

    host = os.getenv("SMTP_HOST")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASS")
    from_addr = os.getenv("SMTP_FROM") or user
    use_starttls = getenv_bool("SMTP_STARTTLS", True)
    use_ssl = getenv_bool("SMTP_SSL", False)

    print("[smtp-test] SMTP_HOST=", host)
    print("[smtp-test] SMTP_PORT=", port)
    print("[smtp-test] SMTP_USER set=", bool(user))
    print("[smtp-test] SMTP_FROM=", from_addr)
    print("[smtp-test] SMTP_STARTTLS=", use_starttls)
    print("[smtp-test] SMTP_SSL=", use_ssl)

    if not host:
        print("[smtp-test][error] SMTP_HOST is not set. Check your .env on the server.")
        return 2
    if not from_addr:
        print("[smtp-test][warn] SMTP_FROM and SMTP_USER are empty; mail will likely be rejected.")

    msg = EmailMessage()
    msg["Subject"] = args.subject
    msg["From"] = from_addr
    msg["To"] = args.to
    msg.set_content(args.body)

    try:
        if use_ssl:
            print(f"[smtp-test] Connecting with SMTP_SSL to {host}:{port} ...")
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(host, port, context=context, timeout=15) as s:
                if user and password:
                    s.login(user, password)
                s.send_message(msg)
        else:
            print(f"[smtp-test] Connecting with SMTP (plain) to {host}:{port} ...")
            with smtplib.SMTP(host, port, timeout=15) as s:
                if use_starttls:
                    print("[smtp-test] Starting TLS (STARTTLS)...")
                    s.starttls()
                if user and password:
                    print("[smtp-test] Logging in...")
                    s.login(user, password)
                print("[smtp-test] Sending message...")
                s.send_message(msg)
        print("[smtp-test] OK: message accepted by server.")
        return 0
    except Exception as e:
        print(f"[smtp-test][error] {e}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

