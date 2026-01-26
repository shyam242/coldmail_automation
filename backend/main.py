import os
from dotenv import load_dotenv

# --------------------------------------------------
# LOAD ENV FIRST
# --------------------------------------------------
load_dotenv()

from fastapi import FastAPI, Request, UploadFile
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from auth import oauth_client
from mailer import send_batch
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
)

# --------------------------------------------------
# HARD FAIL IF ENV MISSING
# --------------------------------------------------
assert os.getenv("GOOGLE_CLIENT_ID"), "GOOGLE_CLIENT_ID not set"
assert os.getenv("GOOGLE_CLIENT_SECRET"), "GOOGLE_CLIENT_SECRET not set"
assert os.getenv("SESSION_SECRET"), "SESSION_SECRET not set"

FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    "https://coldmail-automation.vercel.app",
)

GOOGLE_REDIRECT_URI = os.getenv(
    "GOOGLE_REDIRECT_URI",
    "https://coldmail-automation-backend.onrender.com/auth/google/callback",
)

# --------------------------------------------------
# APP INIT
# --------------------------------------------------
app = FastAPI()

# --------------------------------------------------
# SESSION MIDDLEWARE (MUST BE FIRST)
# --------------------------------------------------
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET"),
    same_site="lax",
    https_only=True,   # REQUIRED for Render HTTPS
)

# --------------------------------------------------
# CORS
# --------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================================================
# AUTH
# ==================================================

@app.get("/auth/google/login")
async def google_login(request: Request):
    google = oauth_client()
    return await google.authorize_redirect(
        request,
        GOOGLE_REDIRECT_URI
    )


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

    session_id = create_session(user_id, {
        "id": user_id,
        "email": user["email"],
        "name": user["name"],
    })

    response = RedirectResponse(
        url=f"{FRONTEND_URL}/dashboard",
        status_code=302,
    )

    response.set_cookie(
        key="session_id",
        value=session_id,
        max_age=30 * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="lax",
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
        "name": user["name"],
    }


@app.post("/auth/logout")
def logout(request: Request):
    session_id = request.cookies.get("session_id")
    if session_id:
        delete_session(session_id)
    return {"success": True}

# ==================================================
# CSV UPLOAD
# ==================================================

@app.post("/upload-csv")
async def upload_csv(file: UploadFile, request: Request):
    session_id = request.cookies.get("session_id")
    if not session_id:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    user = get_session(session_id)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    content = (await file.read()).decode("utf-8")
    csv_id = save_csv(user["id"], file.filename, content)

    return {
        "csv_id": csv_id,
        "filename": file.filename,
        "size": len(content),
    }

# ==================================================
# DASHBOARD
# ==================================================

@app.get("/dashboard/stats")
def dashboard_stats(request: Request):
    session_id = request.cookies.get("session_id")
    if not session_id:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    user = get_session(session_id)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    user_id = user["id"]

    csvs = get_csvs(user_id)

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
            for c in csvs
        ],
    }


@app.get("/dashboard/download-csv/{csv_id}")
def download_csv(csv_id: int, request: Request):
    session_id = request.cookies.get("session_id")
    if not session_id:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    user = get_session(session_id)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    content = get_csv_content(csv_id, user["id"])
    if not content:
        return JSONResponse({"error": "CSV not found"}, status_code=404)

    from fastapi.responses import StreamingResponse
    from io import BytesIO

    return StreamingResponse(
        BytesIO(content.encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=export.csv"},
    )

# ==================================================
# SEND EMAILS
# ==================================================

@app.post("/send-emails")
async def send_emails(request: Request):
    session_id = request.cookies.get("session_id")
    if not session_id:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    user = get_session(session_id)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    body = await request.json()
    csv_id = body["csvId"]
    senders = body["senders"]
    template = body["template"]

    csv_content = get_csv_content(csv_id, user["id"])
    if not csv_content:
        return JSONResponse({"error": "CSV not found"}, status_code=404)

    lines = csv_content.strip().split("\n")
    headers = lines[0].split(",")
    rows = [r.split(",") for r in lines[1:]]

    email_idx = headers.index("email")

    total_sent = 0
    for i, sender in enumerate(senders):
        batch_rows = rows[i * 50:(i + 1) * 50]
        row_dicts = [
            {headers[j]: r[j] if j < len(r) else "" for j in range(len(headers))}
            for r in batch_rows
        ]

        send_batch(
            sender,
            row_dicts,
            template["subject"],
            template["body"],
            delay=1,
        )

        for r in batch_rows:
            log_email_sent(user["id"], r[email_idx], template["subject"])

        total_sent += len(batch_rows)

    return {
        "success": True,
        "emailsSent": total_sent,
    }
