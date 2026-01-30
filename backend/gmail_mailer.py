import os
import base64
import time
import asyncio
import threading
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


def send_batch_via_gmail(sender_accounts, rows, subject, body, delay=0.5):
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
            
            # Try sending with current token
            success = send_email_via_gmail(
                access_token,
                row["email"],
                personalized_subject,
                personalized_body,
                sender_email,
                sender_name,
                delay=0  # No delay needed with threading
            )
            
            if success:
                return True
            else:
                # Try refreshing token
                try:
                    new_token = refresh_access_token(refresh_token)
                    success = send_email_via_gmail(
                        new_token,
                        row["email"],
                        personalized_subject,
                        personalized_body,
                        sender_email,
                        sender_name,
                        delay=0
                    )
                    return success
                except Exception as e:
                    print(f"⚠️ Token refresh failed for {sender_email}: {str(e)}")
                    return False
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
