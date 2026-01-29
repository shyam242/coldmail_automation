import os
from dotenv import load_dotenv

# Load env first
load_dotenv()

from fastapi import FastAPI, Request, UploadFile
from fastapi.responses import RedirectResponse, JSONResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from auth import oauth_client
from gmail_mailer import send_batch_via_gmail
from db import (
    get_or_create_user,
    save_csv,
    get_csvs,
    get_csv_content,
    count_total_emails_sent,
    count_total_csvs,
    create_session,
    get_session,
    delete_session,
    log_email_sent,
    delete_csv,
    add_gmail_account,
    get_gmail_accounts,
    get_gmail_account,
    count_gmail_accounts,
    delete_gmail_account,
    update_gmail_account_name,
    update_user_gmail_tokens,
    get_user_gmail_tokens,
)

# ================== ENV CHECK ==================
assert os.getenv("GOOGLE_CLIENT_ID")
assert os.getenv("GOOGLE_CLIENT_SECRET")
assert os.getenv("SESSION_SECRET")

# Set FRONTEND_URL based on environment
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

app = FastAPI()

# ================== SESSION ==================
# Detect if we're on production (HTTPS) or local (HTTP)
is_production = os.getenv("BACKEND_URL", "").startswith("https")

app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET"),
    session_cookie="oauth_session",
    same_site="none" if is_production else "lax",
    https_only=is_production,
)

# ================== CORS ==================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================== AUTH ==================

@app.get("/auth/google/login")
async def google_login(request: Request):
    google = oauth_client()
    backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
    redirect_uri = f"{backend_url}/auth/google/callback"
    return await google.authorize_redirect(request, redirect_uri)


@app.get("/auth/google/callback")
async def google_callback(request: Request):
    google = oauth_client()
    token = await google.authorize_access_token(request)
    user = token["userinfo"]

    user_id = get_or_create_user(
        user["sub"],
        user["email"],
        user["name"],
    )

    # Store Gmail tokens for the primary account
    access_token = token.get("access_token")
    refresh_token = token.get("refresh_token")
    if access_token:
        update_user_gmail_tokens(user_id, access_token, refresh_token)

    session_id = create_session(user_id, {
        "id": user_id,
        "email": user["email"],
        "name": user["name"],
    })

    response = HTMLResponse(
        f"""
        <html>
          <body>
            <script>
              window.location.href = "{FRONTEND_URL}/dashboard";
            </script>
          </body>
        </html>
        """
    )

    # 🔥 CRITICAL COOKIE FIX FOR VERCEL + RENDER
    response.set_cookie(
        key="session_id",
        value=session_id,
        max_age=30 * 24 * 60 * 60,
        httponly=True,
        secure=True,          # MUST
        samesite="none",      # MUST
        path="/",
    )

    return response


@app.get("/auth/me")
def auth_me(request: Request):
    session_id = request.cookies.get("session_id")
    if not session_id:
        return {"authenticated": False}

    user = get_session(session_id)
    if not user:
        return {"authenticated": False}

    return {
        "authenticated": True,
        "email": user["email"],
        "name": user.get("name"),
    }


@app.post("/auth/logout")
def logout(request: Request):
    session_id = request.cookies.get("session_id")
    if session_id:
        delete_session(session_id)
    return {"success": True}


# ================== CSV ==================

@app.post("/upload-csv")
async def upload_csv(file: UploadFile, request: Request):
    session_id = request.cookies.get("session_id")
    user = get_session(session_id) if session_id else None
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    content = (await file.read()).decode("utf-8")
    csv_id = save_csv(user["id"], file.filename, content)
    return {"csv_id": csv_id, "filename": file.filename}


# ================== DASHBOARD ==================

@app.get("/dashboard/stats")
def dashboard_stats(request: Request):
    session_id = request.cookies.get("session_id")
    user = get_session(session_id) if session_id else None
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    user_id = user["id"]

    return {
        "totalEmailsSent": count_total_emails_sent(user_id),
        "totalCsvsUploaded": count_total_csvs(user_id),
        "csvs": [
            {
                "id": c[0],
                "filename": c[1],
                "uploadedAt": c[2],
                "rowCount": c[3],
            }
            for c in get_csvs(user_id)
        ],
    }


@app.get("/dashboard/download-csv/{csv_id}")
def download_csv(csv_id: int, request: Request):
    session_id = request.cookies.get("session_id")
    user = get_session(session_id) if session_id else None
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    content = get_csv_content(csv_id, user["id"])
    if not content:
        return JSONResponse({"error": "Not found"}, status_code=404)

    from fastapi.responses import StreamingResponse
    from io import BytesIO

    return StreamingResponse(
        BytesIO(content.encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=export.csv"},
    )


@app.delete("/dashboard/delete-csv/{csv_id}")
def delete_csv_api(csv_id: int, request: Request):
    session_id = request.cookies.get("session_id")
    user = get_session(session_id) if session_id else None
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    delete_csv(csv_id, user["id"])
    return {"success": True}


# ================== SEND EMAILS ==================

@app.post("/send-emails")
async def send_emails(request: Request):
    session_id = request.cookies.get("session_id")
    user = get_session(session_id) if session_id else None
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    try:
        body = await request.json()
        csv_id = body["csvId"]
        sender_account_ids = body["senderAccountIds"]  # List of Gmail account IDs to use
        template = body["template"]

        if not sender_account_ids:
            return JSONResponse({"error": "No sender accounts selected"}, status_code=400)

        # Get CSV content
        csv_content = get_csv_content(csv_id, user["id"])
        if not csv_content:
            return JSONResponse({"error": "CSV not found"}, status_code=404)

        lines = csv_content.strip().splitlines()
        headers = lines[0].split(",")
        rows = [dict(zip(headers, r.split(","))) for r in lines[1:] if r.strip()]

        # Get sender account details
        sender_accounts = []
        for account_id in sender_account_ids:
            account = get_gmail_account(account_id, user["id"])
            if account:
                # Extract only the needed fields: (id, email, access_token, refresh_token)
                account_id, gmail_id, email, name, access_token, refresh_token = account
                sender_accounts.append((account_id, email, access_token, refresh_token))

        if not sender_accounts:
            return JSONResponse({"error": "Invalid sender accounts"}, status_code=400)

        # Send emails via Gmail API
        sent = send_batch_via_gmail(sender_accounts, rows, template["subject"], template["body"], delay=1)

        # Log emails sent
        for r in rows[:sent]:
            log_email_sent(user["id"], r.get("email", ""), template["subject"])

        return {"success": True, "emailsSent": sent}

    except Exception as e:
        print(f"❌ Send emails error: {str(e)}")
        return JSONResponse({"error": str(e)}, status_code=500)


# ================== GMAIL ACCOUNTS ==================

@app.get("/gmail/accounts")
def get_accounts(request: Request):
    """Get all Gmail accounts for the user"""
    session_id = request.cookies.get("session_id")
    user = get_session(session_id) if session_id else None
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    accounts = get_gmail_accounts(user["id"])
    return {
        "accounts": [
            {
                "id": acc[0],
                "email": acc[2],
                "name": acc[3],
            }
            for acc in accounts
        ]
    }


@app.get("/gmail/connect")
async def connect_gmail_account(request: Request):
    """Initiate OAuth flow for adding a new Gmail account"""
    session_id = request.cookies.get("session_id")
    user = get_session(session_id) if session_id else None
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    # Check if user has reached the 3 account limit
    account_count = count_gmail_accounts(user["id"])
    if account_count >= 3:
        return JSONResponse({"error": "Maximum 3 Gmail accounts allowed"}, status_code=400)

    # Redirect to OAuth consent screen
    google = oauth_client()
    backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
    redirect_uri = f"{backend_url}/gmail/connect/callback"
    return await google.authorize_redirect(request, redirect_uri)


@app.get("/gmail/connect/callback")
async def gmail_connect_callback(request: Request):
    """Handle OAuth callback for additional Gmail account"""
    session_id = request.cookies.get("session_id")
    user = get_session(session_id) if session_id else None
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    try:
        google = oauth_client()
        token = await google.authorize_access_token(request)
        userinfo = token["userinfo"]

        # Add Gmail account to database
        add_gmail_account(
            user["id"],
            userinfo["sub"],
            userinfo["email"],
            userinfo.get("name", ""),
            token.get("access_token"),
            token.get("refresh_token"),
        )

        # Redirect back to senders page
        response = HTMLResponse(
            f"""
            <html>
              <body>
                <script>
                  window.location.href = "{FRONTEND_URL}/senders";
                </script>
              </body>
            </html>
            """
        )
        return response

    except Exception as e:
        print(f"❌ Gmail connect callback error: {str(e)}")
        return JSONResponse({"error": str(e)}, status_code=500)



@app.delete("/gmail/accounts/{account_id}")
def delete_account(account_id: int, request: Request):
    """Delete a Gmail account"""
    session_id = request.cookies.get("session_id")
    user = get_session(session_id) if session_id else None
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    delete_gmail_account(account_id, user["id"])
    return {"success": True}


@app.put("/gmail/accounts/{account_id}")
async def update_account(account_id: int, request: Request):
    """Update Gmail account details (like sender name)"""
    session_id = request.cookies.get("session_id")
    user = get_session(session_id) if session_id else None
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    try:
        body = await request.json()
        name = body.get("name", "").strip()
        
        if not name:
            return JSONResponse({"error": "Name cannot be empty"}, status_code=400)
        
        update_gmail_account_name(account_id, user["id"], name)
        return {"success": True, "message": "Account updated successfully"}
    except Exception as e:
        print(f"❌ Error updating Gmail account: {str(e)}")
        return JSONResponse({"error": str(e)}, status_code=500)
