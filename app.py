import smtplib, ssl
from email.message import EmailMessage
import os

smtp_server = "smtp.gmail.com"
port = 465

sender = os.getenv("GMAIL_USER") or "eae.cpct@gmail.com"
password = os.getenv("GMAIL_PASS") or "wlgsvllugnrxjbez"
receiver = sender

msg = EmailMessage()
msg["Subject"] = "Teste Gmail App Password"
msg["From"] = sender
msg["To"] = receiver
msg.set_content("Olá! Este é um teste de envio usando senha de app.\nCom acentos: áéíóú ç ã õ.")

context = ssl.create_default_context()
with smtplib.SMTP_SSL(smtp_server, port, context=context) as server:
    server.login(sender, password)
    server.send_message(msg)

print(">> E-mail enviado com sucesso.")
