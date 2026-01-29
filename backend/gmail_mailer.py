import os
import base64
import time
from email.mime.text import MIMEText
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


def refresh_access_token(refresh_token):
    """Refresh access token using refresh token"""
    try:
        creds = Credentials(
            token=None,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=os.getenv("GOOGLE_CLIENT_ID"),
            client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        )
        creds.refresh(Request())
        return creds.token
    except Exception as e:
        print(f"❌ Token refresh failed: {str(e)}")
        raise


def send_email_via_gmail(access_token, recipient_email, subject, body, sender_email, sender_name, delay=1):
    """Send a single email via Gmail API"""
    try:
        creds = Credentials(token=access_token)
        service = build("gmail", "v1", credentials=creds)

        message = MIMEText(body)
        message["to"] = recipient_email
        # Format sender with name if available
        if sender_name:
            message["from"] = f"{sender_name} <{sender_email}>"
        else:
            message["from"] = sender_email
        message["subject"] = subject

        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
        send_message = {"raw": raw_message}

        service.users().messages().send(userId="me", body=send_message).execute()
        
        time.sleep(delay)
        return True
    except HttpError as e:
        if e.resp.status == 401:
            print(f"⚠️ Token expired for {sender_email}")
            return False
        else:
            print(f"❌ Failed to send email to {recipient_email}: {str(e)}")
            return False
    except Exception as e:
        print(f"❌ Gmail API Error: {str(e)}")
        return False


def send_batch_via_gmail(sender_accounts, rows, subject, body, delay=1):
    """
    Send emails in batches (max 50 per account)
    sender_accounts: list of tuples (account_id, email, access_token, refresh_token)
    rows: list of recipient dicts
    """
    total_sent = 0
    account_index = 0
    emails_per_account = 50

    for row_index, row in enumerate(rows):
        if not row.get("email"):
            continue

        # Rotate through accounts (50 per account)
        if row_index > 0 and row_index % emails_per_account == 0:
            account_index = (account_index + 1) % len(sender_accounts)

        account_id, sender_email, sender_name, access_token, refresh_token = sender_accounts[account_index]

        # Try to send email
        try:
            personalized_subject = subject.format(**row)
            personalized_body = body.format(**row)
            
            success = send_email_via_gmail(
                access_token,
                row["email"],
                personalized_subject,
                personalized_body,
                sender_email,
                sender_name,
                delay
            )
            
            if success:
                total_sent += 1
            else:
                # Try to refresh token and retry
                try:
                    new_token = refresh_access_token(refresh_token)
                    success = send_email_via_gmail(
                        new_token,
                        row["email"],
                        personalized_subject,
                        personalized_body,
                        sender_email,
                        sender_name,
                        delay
                    )
                    if success:
                        total_sent += 1
                except Exception as e:
                    print(f"⚠️ Failed to send to {row.get('email')}: {str(e)}")
                    continue

        except Exception as e:
            print(f"⚠️ Error processing row for {row.get('email')}: {str(e)}")
            continue

    return total_sent
