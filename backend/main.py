import os
from dotenv import load_dotenv

# ✅ Load environment variables FIRST
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

# ✅ HARD FAIL if secrets missing
assert os.getenv("GOOGLE_CLIENT_ID"), "GOOGLE_CLIENT_ID not set"
assert os.getenv("GOOGLE_CLIENT_SECRET"), "GOOGLE_CLIENT_SECRET not set"
assert os.getenv("SESSION_SECRET"), "SESSION_SECRET not set"

app = FastAPI()

# ---------- SESSION ----------
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET"),
    same_site="lax",
    https_only=False,  # Allow HTTP for localhost
    session_cookie="session",
)

# ---------- CORS ----------
import os
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- AUTH ----------

@app.get("/auth/google/login")
async def google_login(request: Request):
    google = oauth_client()

    # ✅ DEBUG PRINTS (TEMPORARY)
    print("GOOGLE_CLIENT_ID =", os.getenv("GOOGLE_CLIENT_ID"))
    print("REGISTERED CLIENT ID =", google.client_id)

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

    # Create database-backed session
    session_id = create_session(user_id, {
        "id": user_id,
        "email": user["email"],
        "name": user["name"],
    })
    
    print(f"✅ User {user['email']} logged in successfully.")
    print(f"✅ Session ID created: {session_id}")

    # Return HTML that redirects and sets the session cookie
    from starlette.responses import HTMLResponse
    
    response = HTMLResponse(
        content="""
        <html>
            <body>
                <script>
                    // Small delay to ensure cookie is set before redirect
                    setTimeout(() => {
                        window.location.href = 'http://localhost:3000/dashboard';
                    }, 100);
                </script>
            </body>
        </html>
        """,
        status_code=200
    )
    
    # Set session cookie - using domain that works for localhost
    response.set_cookie(
        key="session_id",
        value=session_id,
        max_age=30*24*60*60,  # 30 days
        secure=False,  # Allow HTTP for localhost
        httponly=True,
        samesite="lax",
        path="/"  # Important: cookie available across all paths
    )
    
    print(f"✅ Setting cookie on response: session_id={session_id}")
    
    return response


@app.get("/auth/me")
def auth_me(request: Request):
    session_id = request.cookies.get("session_id")
    print(f"🔍 /auth/me check - Session ID from cookie: {session_id}")
    
    if not session_id:
        return {"authenticated": False}
    
    user = get_session(session_id)
    print(f"   - User data from session: {user}")
    
    if not user:
        return {"authenticated": False}
    
    return {
        "authenticated": True,
        "email": user.get("email"),
        "name": user.get("name")
    }


@app.post("/auth/logout")
def logout(request: Request):
    session_id = request.cookies.get("session_id")
    if session_id:
        delete_session(session_id)
    return {"success": True}

# ---------- CSV UPLOAD ----------

@app.post("/upload-csv")
async def upload_csv(file: UploadFile, request: Request):
    session_id = request.cookies.get("session_id")
    if not session_id:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    
    user = get_session(session_id)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    content = (await file.read()).decode('utf-8')
    csv_id = save_csv(user["id"], file.filename, content)
    return {"filename": file.filename, "csv_id": csv_id, "size": len(content)}


# ---------- DASHBOARD ----------

@app.get("/dashboard/stats")
def get_dashboard_stats(request: Request):
    session_id = request.cookies.get("session_id")
    if not session_id:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    
    user = get_session(session_id)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    
    user_id = user["id"]
    
    total_emails = count_total_emails_sent(user_id)
    total_csvs = count_total_csvs(user_id)
    
    csvs = get_csvs(user_id)
    csv_list = [
        {
            "id": csv[0],
            "filename": csv[1],
            "uploadedAt": csv[2],
            "rowCount": csv[3],
        }
        for csv in csvs
    ]
    
    return {
        "totalEmailsSent": total_emails,
        "totalCsvsUploaded": total_csvs,
        "csvs": csv_list,
    }


@app.get("/dashboard/download-csv/{csv_id}")
async def download_csv(csv_id: int, request: Request):
    session_id = request.cookies.get("session_id")
    if not session_id:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    
    user = get_session(session_id)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    
    user_id = user["id"]
    
    content = get_csv_content(csv_id, user_id)
    if not content:
        return JSONResponse({"error": "CSV not found"}, status_code=404)
    
    from fastapi.responses import StreamingResponse
    from io import BytesIO
    
    return StreamingResponse(
        iter([content.encode('utf-8')]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=export.csv"}
    )

# ---------- EMAIL SENDING ----------

@app.delete("/dashboard/delete-csv/{csv_id}")
async def delete_csv_endpoint(request: Request, csv_id: str):
    session_id = request.cookies.get("session_id")
    if not session_id:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    
    user = get_session(session_id)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    
    user_id = user["id"]
    
    try:
        delete_csv(csv_id, user_id)
        return {"success": True, "message": "CSV deleted successfully"}
    except Exception as e:
        print(f"❌ Error deleting CSV: {str(e)}")
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/send-emails")
async def send_emails(request: Request):
    session_id = request.cookies.get("session_id")
    if not session_id:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    
    user = get_session(session_id)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    
    user_id = user["id"]
    
    try:
        body = await request.json()
        csv_id = body.get("csvId")
        senders = body.get("senders", [])
        template = body.get("template", {})
        total_emails = body.get("totalEmails", 0)
        
        # Get CSV content
        csv_content = get_csv_content(csv_id, user_id)
        if not csv_content:
            return JSONResponse({"error": "CSV not found"}, status_code=404)
        
        # Parse CSV
        lines = csv_content.strip().split('\n')
        headers = [h.strip() for h in lines[0].split(',')]
        rows = [line.split(',') for line in lines[1:]]
        
        email_count = 0
        emails_per_sender = 50
        
        # Send emails through each sender
        for sender_idx, sender in enumerate(senders):
            start_row = sender_idx * emails_per_sender
            end_row = min(start_row + emails_per_sender, len(rows))
            
            # Extract rows for this sender
            sender_rows_data = rows[start_row:end_row]
            
            # Convert row data to dict using headers
            sender_rows_dicts = []
            for row in sender_rows_data:
                row_dict = {}
                for i, header in enumerate(headers):
                    row_dict[header.strip()] = row[i].strip() if i < len(row) else ""
                sender_rows_dicts.append(row_dict)
            
            # Send emails via SMTP
            try:
                subject = template.get("subject", "")
                body = template.get("body", "")
                delay = 1  # 1 second delay between emails
                
                send_batch(sender, sender_rows_dicts, subject, body, delay)
                emails_sent = len(sender_rows_dicts)
                email_count += emails_sent
                print(f"📧 Sender {sender['name']}: Sent {emails_sent} emails")
            except Exception as e:
                print(f"❌ Error sending emails for {sender['name']}: {str(e)}")
        
        # Record sent emails in database
        for i, row in enumerate(rows[:total_emails]):
            email_idx = headers.index("email") if "email" in headers else None
            if email_idx is not None:
                recipient_email = row[email_idx].strip()
                subject = template.get("subject", "")
                log_email_sent(user_id, recipient_email, subject)
        
        print(f"✅ Total emails sent: {email_count}")
        
        return {
            "success": True,
            "emailsSent": email_count,
            "message": f"Successfully sent {email_count} emails"
        }
    
    except Exception as e:
        print(f"❌ Error sending emails: {str(e)}")
        return JSONResponse({"error": str(e)}, status_code=500)
