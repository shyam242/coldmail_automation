import os
from dotenv import load_dotenv

# Load env first
load_dotenv()

from fastapi import FastAPI, Request, UploadFile
from fastapi.responses import RedirectResponse, JSONResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware

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

# HARD FAIL if env missing
assert os.getenv("GOOGLE_CLIENT_ID")
assert os.getenv("GOOGLE_CLIENT_SECRET")
assert os.getenv("SESSION_SECRET")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

app = FastAPI()

# ---------- CORS ----------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- AUTH ----------

@app.get("/auth/google/login")
async def google_login(request: Request):
    google = oauth_client()
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI")
    return await google.authorize_redirect(request, redirect_uri)


@app.get("/auth/google/callback")
async def google_callback(request: Request):
    google = oauth_client()

    token = await google.authorize_access_token(request)
    user = token["userinfo"]

    user_id = get_or_create_user(
        user["sub"],
        user["email"],
        user["name"]
    )

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
              window.location.href = '{FRONTEND_URL}/dashboard';
            </script>
          </body>
        </html>
        """
    )

    response.set_cookie(
        key="session_id",
        value=session_id,
        httponly=True,
        secure=False,   # set true after HTTPS
        samesite="lax",
        max_age=60 * 60 * 24 * 30,
        path="/"
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
        "name": user["name"]
    }


@app.post("/auth/logout")
def logout(request: Request):
    session_id = request.cookies.get("session_id")
    if session_id:
        delete_session(session_id)

    res = JSONResponse({"success": True})
    res.delete_cookie("session_id")
    return res


# ---------- CSV ----------

@app.post("/upload-csv")
async def upload_csv(file: UploadFile, request: Request):
    session_id = request.cookies.get("session_id")
    user = get_session(session_id)

    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    content = (await file.read()).decode("utf-8")
    csv_id = save_csv(user["id"], file.filename, content)

    return {
        "filename": file.filename,
        "csv_id": csv_id
    }


# ---------- DASHBOARD ----------

@app.get("/dashboard/stats")
def dashboard_stats(request: Request):
    session_id = request.cookies.get("session_id")
    user = get_session(session_id)

    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    return {
        "totalEmailsSent": count_total_emails_sent(user["id"]),
        "totalCsvsUploaded": count_total_csvs(user["id"]),
        "csvs": [
            {
                "id": c[0],
                "filename": c[1],
                "uploadedAt": c[2],
                "rowCount": c[3],
            }
            for c in get_csvs(user["id"])
        ],
    }


@app.get("/dashboard/download-csv/{csv_id}")
def download_csv(csv_id: int, request: Request):
    session_id = request.cookies.get("session_id")
    user = get_session(session_id)

    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    content = get_csv_content(csv_id, user["id"])
    if not content:
        return JSONResponse({"error": "Not found"}, status_code=404)

    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        iter([content.encode("utf-8")]),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=export.csv"
        }
    )


# ---------- SEND EMAILS ----------

@app.post("/send-emails")
async def send_emails(request: Request):
    session_id = request.cookies.get("session_id")
    user = get_session(session_id)

    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    body = await request.json()
    csv_id = body["csvId"]
    senders = body["senders"]
    template = body["template"]

    csv_content = get_csv_content(csv_id, user["id"])
    lines = csv_content.splitlines()
    headers = lines[0].split(",")
    rows = lines[1:]

    for idx, sender in enumerate(senders):
        chunk = rows[idx*50:(idx+1)*50]
        parsed = [dict(zip(headers, row.split(","))) for row in chunk]

        send_batch(
            sender,
            parsed,
            template["subject"],
            template["body"],
            delay=1
        )

    return {"success": True}
