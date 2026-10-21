import os
import base64
import time
import asyncio
import threading
import uuid
import re
import html as html_lib
from datetime import datetime, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from db import log_tracked_email, update_gmail_tokens, get_gmail_account_by_id, get_user_email


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



def _backend_url():
    return os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/")


def text_to_html(text):
    """Turn a plain-text template body into simple HTML (keeps line breaks, links clickable)"""
    escaped = html_lib.escape(text)
    escaped = re.sub(r"(https?://[^\s<]+)", r'<a href="\1">\1</a>', escaped)
    escaped = escaped.replace("\r\n", "\n").replace("\n", "<br>\n")
    return f'<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5">{escaped}</div>'


def build_tracked_html(text, tracking_id):
    pixel = (
        f'<img src="{_backend_url()}/t/{tracking_id}.gif" width="1" height="1" '
        f'alt="" style="border:0;width:1px;height:1px" />'
    )
    return text_to_html(text) + pixel


def send_email_via_gmail(access_token, recipient_email, subject, body, sender_email, sender_name, delay=1, html_body=None):
    """Send a single email via Gmail API"""
    try:
        creds = Credentials(token=access_token)
        service = build("gmail", "v1", credentials=creds)

        if html_body:
            # Plain text + HTML alternative (HTML part carries the tracking pixel)
            message = MIMEMultipart("alternative")
            message.attach(MIMEText(body, "plain", "utf-8"))
            message.attach(MIMEText(html_body, "html", "utf-8"))
        else:
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


def send_batch_via_gmail(sender_accounts, rows, subject, body, delay=0.5, user_id=None, track_opens=True):
    """
    Send emails in batches (max 200+ per account with optimized handling)
    sender_accounts: list of tuples (account_id, email, access_token, refresh_token)
    rows: list of recipient dicts
    Uses threading for async batch processing to handle large batches efficiently
    """
    total_sent = [0]  # Use list to track in thread-safe manner
    lock = threading.Lock()
    account_index = 0
    emails_per_account = 200  # Increased from 50 to 200
    max_concurrent_per_account = 8  # Send up to 8 emails concurrently per account
    
    def send_email_worker(row, account_info):
        """Worker function for threading"""
        try:
            account_id, sender_email, sender_name, access_token, refresh_token = account_info
            
            if not row.get("email"):
                return False
            
            personalized_subject = subject.format(**row)
            personalized_body = body.format(**row)

            # Unique id per email; the tracking pixel in the HTML part points to it
            tracking_id = uuid.uuid4().hex
            html_body = build_tracked_html(personalized_body, tracking_id) if track_opens else None

            def _send(token):
                return send_email_via_gmail(
                    token,
                    row["email"],
                    personalized_subject,
                    personalized_body,
                    sender_email,
                    sender_name,
                    delay=0,  # No delay needed with threading
                    html_body=html_body,
                )

            success = _send(access_token)

            if not success:
                # Try refreshing token
                try:
                    new_token = refresh_access_token(refresh_token)
                    try:
                        update_gmail_tokens(account_id, new_token)
                    except Exception:
                        pass
                    success = _send(new_token)
                except Exception as e:
                    print(f"⚠️ Token refresh failed for {sender_email}: {str(e)}")
                    return False

            if success and user_id is not None:
                log_tracked_email(
                    user_id, row["email"], personalized_subject,
                    tracking_id, account_id, sender_email, track_opens,
                )
            return success
        except Exception as e:
            print(f"⚠️ Worker error: {str(e)}")
            return False
    
    # Process emails in batches using account rotation
    active_threads = []
    thread_results = []
    
    for row_index, row in enumerate(rows):
        if not row.get("email"):
            continue
        
        # Rotate through accounts
        account_index = (row_index // max_concurrent_per_account) % len(sender_accounts)
        account_info = sender_accounts[account_index]
        
        # Wait for some threads to complete if we have too many
        if len(active_threads) >= max_concurrent_per_account * len(sender_accounts):
            # Wait for at least one thread to complete
            for i, (thread, result_list) in enumerate(active_threads[:]):
                thread.join(timeout=3)
                if not thread.is_alive():
                    # Count result if available
                    if result_list and result_list[0]:
                        with lock:
                            total_sent[0] += 1
                    active_threads.pop(i)
                    break
        
        # Create and start thread
        result_list = []
        thread = threading.Thread(
            target=lambda r=row, a=account_info, res=result_list: res.append(send_email_worker(r, a)),
            daemon=True
        )
        thread.start()
        active_threads.append((thread, result_list))
    
    # Wait for all threads to complete
    for thread, result_list in active_threads:
        thread.join(timeout=5)
        if result_list and result_list[0]:
            with lock:
                total_sent[0] += 1
    
    return total_sent[0]


def notify_email_opened(info):
    """
    Email the account owner that a recipient opened a message.
    Sent through the same Gmail account that sent the original email.
    `info` comes from db.record_open().
    """
    try:
        account = get_gmail_account_by_id(info["sender_account_id"])
        owner_email = get_user_email(info["user_id"])
        if not account or not owner_email:
            return False

        _, _, sender_email, sender_name, access_token, refresh_token = account

        # Opens usually happen long after sending, so the stored access token
        # is almost always expired -> refresh first when we can.
        token = access_token
        if refresh_token:
            try:
                token = refresh_access_token(refresh_token)
                update_gmail_tokens(info["sender_account_id"], token)
            except Exception:
                pass

        opened_at = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")
        recipient = info["recipient"]
        subject = info["subject"]

        text = (
            f"{recipient} just opened your email.\n\n"
            f"Subject: {subject}\n"
            f"Opened: {opened_at}\n"
            f"Sent from: {sender_email}\n\n"
            "Note: open tracking is approximate (some mail apps pre-load images)."
        )
        html_msg = (
            '<div style="font-family:Arial,sans-serif;font-size:14px">'
            f"<p>👀 <b>{html_lib.escape(recipient)}</b> just opened your email.</p>"
            f"<p><b>Subject:</b> {html_lib.escape(subject)}<br>"
            f"<b>Opened:</b> {opened_at}<br>"
            f"<b>Sent from:</b> {html_lib.escape(sender_email)}</p>"
            '<p style="color:#888;font-size:12px">Open tracking is approximate '
            "(some mail apps pre-load images).</p></div>"
        )

        message = MIMEMultipart("alternative")
        message.attach(MIMEText(text, "plain", "utf-8"))
        message.attach(MIMEText(html_msg, "html", "utf-8"))
        message["to"] = owner_email
        message["from"] = f"{sender_name} <{sender_email}>" if sender_name else sender_email
        message["subject"] = f"👀 {recipient} opened: {subject}"

        raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
        service = build("gmail", "v1", credentials=Credentials(token=token), cache_discovery=False)
        service.users().messages().send(userId="me", body={"raw": raw}).execute()
        return True
    except Exception as e:
        print(f"❌ Open notification failed: {str(e)}")
        return False
        
