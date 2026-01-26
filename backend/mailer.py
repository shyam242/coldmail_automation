import smtplib, ssl, time
from email.message import EmailMessage

def send_batch(sender, rows, subject, body, delay):
    try:
        # Convert port to integer
        port = int(sender["port"])
        
        server = smtplib.SMTP(sender["smtp"], port)
        server.starttls(context=ssl.create_default_context())
        server.login(sender["email"], sender["password"])

        email_count = 0
        for row in rows:
            if not row.get("email"):
                continue

            try:
                msg = EmailMessage()
                msg["From"] = f'{sender["name"]} <{sender["email"]}>'
                msg["To"] = row["email"]
                msg["Subject"] = subject.format(**row)
                msg.set_content(body.format(**row))

                server.send_message(msg)
                email_count += 1
                time.sleep(delay)
            except Exception as e:
                print(f"⚠️ Failed to send email to {row.get('email')}: {str(e)}")
                continue

        server.quit()
        return email_count
    except Exception as e:
        print(f"❌ SMTP Connection Error: {str(e)}")
        raise
