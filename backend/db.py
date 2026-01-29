import sqlite3
import json
import uuid
from datetime import datetime, timedelta

# Import crypto utilities with fallback
try:
    from crypto_utils import encrypt_token, decrypt_token
except ImportError:
    # Fallback if crypto_utils not available
    def encrypt_token(token):
        return token
    def decrypt_token(token):
        return token

conn = sqlite3.connect("database.db", check_same_thread=False)
cur = conn.cursor()

cur.execute("""
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id TEXT UNIQUE,
    email TEXT,
    name TEXT,
    gmail_token TEXT,
    gmail_refresh_token TEXT
)
""")

# Add missing columns to users table if they don't exist
try:
    cur.execute("ALTER TABLE users ADD COLUMN gmail_token TEXT")
except Exception:
    pass  # Column already exists

try:
    cur.execute("ALTER TABLE users ADD COLUMN gmail_refresh_token TEXT")
except Exception:
    pass  # Column already exists

cur.execute("""
CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    user_id INTEGER,
    data TEXT,
    expires_at TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
)
""")

cur.execute("""
CREATE TABLE IF NOT EXISTS gmail_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    gmail_id TEXT UNIQUE,
    email TEXT,
    name TEXT,
    access_token TEXT,
    refresh_token TEXT,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
)
""")

cur.execute("""
CREATE TABLE IF NOT EXISTS csvs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    filename TEXT,
    content TEXT,
    row_count INTEGER,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
""")

cur.execute("""
CREATE TABLE IF NOT EXISTS emails_sent (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    recipient_email TEXT,
    subject TEXT,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
""")

conn.commit()

def get_or_create_user(google_id, email, name):
    cur.execute("SELECT id FROM users WHERE google_id=?", (google_id,))
    row = cur.fetchone()
    if row:
        return row[0]

    cur.execute(
        "INSERT INTO users (google_id, email, name) VALUES (?,?,?)",
        (google_id, email, name)
    )
    conn.commit()
    return cur.lastrowid

def save_csv(user_id, filename, content):
    """Save CSV file and return the CSV ID"""
    rows = len(content.strip().split('\n')) - 1  # Subtract header row
    cur.execute("""
        INSERT INTO csvs (user_id, filename, content, row_count)
        VALUES (?, ?, ?, ?)
    """, (user_id, filename, content, rows))
    conn.commit()
    return cur.lastrowid

def get_csvs(user_id):
    """Get all CSVs for a user"""
    cur.execute("""
        SELECT id, filename, uploaded_at, row_count 
        FROM csvs WHERE user_id=? ORDER BY uploaded_at DESC
    """, (user_id,))
    return cur.fetchall()

def get_csv_content(csv_id, user_id):
    """Get CSV content for download"""
    cur.execute("SELECT content FROM csvs WHERE id=? AND user_id=?", (csv_id, user_id))
    row = cur.fetchone()
    return row[0] if row else None

def count_total_emails_sent(user_id):
    """Count total emails sent by user"""
    cur.execute("SELECT COUNT(*) FROM emails_sent WHERE user_id=?", (user_id,))
    return cur.fetchone()[0]

def count_total_csvs(user_id):
    """Count total CSVs uploaded by user"""
    cur.execute("SELECT COUNT(*) FROM csvs WHERE user_id=?", (user_id,))
    return cur.fetchone()[0]

# ===== SESSION MANAGEMENT =====

def create_session(user_id, user_data):
    """Create a new session and return session ID"""
    session_id = str(uuid.uuid4())
    expires_at = datetime.now() + timedelta(days=30)
    
    cur.execute("""
        INSERT INTO sessions (session_id, user_id, data, expires_at)
        VALUES (?, ?, ?, ?)
    """, (session_id, user_id, json.dumps(user_data), expires_at.isoformat()))
    conn.commit()
    return session_id

def get_session(session_id):
    """Retrieve session data by session ID"""
    cur.execute("""
        SELECT user_id, data FROM sessions 
        WHERE session_id=? AND expires_at > datetime('now')
    """, (session_id,))
    row = cur.fetchone()
    if row:
        return {
            "user_id": row[0],
            **json.loads(row[1])
        }
    return None

def delete_session(session_id):
    """Delete a session"""
    cur.execute("DELETE FROM sessions WHERE session_id=?", (session_id,))
    conn.commit()

def delete_csv(csv_id, user_id):
    """Delete a CSV file"""
    cur.execute("DELETE FROM csvs WHERE id=? AND user_id=?", (csv_id, user_id))
    conn.commit()

def log_email_sent(user_id, recipient_email, subject):
    """Log a sent email"""
    cur.execute("""
        INSERT INTO emails_sent (user_id, recipient_email, subject)
        VALUES (?, ?, ?)
    """, (user_id, recipient_email, subject))
    conn.commit()
# ===== GMAIL ACCOUNT MANAGEMENT =====

def add_gmail_account(user_id, gmail_id, email, name, access_token, refresh_token):
    """Add a new Gmail account for the user (encrypted)"""
    # Encrypt tokens before storing
    encrypted_access = encrypt_token(access_token)
    encrypted_refresh = encrypt_token(refresh_token) if refresh_token else None
    
    cur.execute("""
        INSERT INTO gmail_accounts (user_id, gmail_id, email, name, access_token, refresh_token)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (user_id, gmail_id, email, name, encrypted_access, encrypted_refresh))
    conn.commit()
    return cur.lastrowid

def get_gmail_accounts(user_id):
    """Get all Gmail accounts for a user (decrypted)"""
    cur.execute("""
        SELECT id, gmail_id, email, name, access_token, refresh_token
        FROM gmail_accounts WHERE user_id=? ORDER BY added_at DESC
    """, (user_id,))
    rows = cur.fetchall()
    
    # Decrypt tokens
    decrypted_rows = []
    for row in rows:
        id, gmail_id, email, name, access_token, refresh_token = row
        decrypted_rows.append((
            id, gmail_id, email, name,
            decrypt_token(access_token),
            decrypt_token(refresh_token) if refresh_token else None
        ))
    return decrypted_rows

def get_gmail_account(account_id, user_id):
    """Get a specific Gmail account (decrypted)"""
    cur.execute("""
        SELECT id, gmail_id, email, name, access_token, refresh_token
        FROM gmail_accounts WHERE id=? AND user_id=?
    """, (account_id, user_id))
    row = cur.fetchone()
    if not row:
        return None
    
    # Decrypt tokens
    id, gmail_id, email, name, access_token, refresh_token = row
    return (
        id, gmail_id, email, name,
        decrypt_token(access_token),
        decrypt_token(refresh_token) if refresh_token else None
    )

def count_gmail_accounts(user_id):
    """Count total Gmail accounts for a user"""
    cur.execute("SELECT COUNT(*) FROM gmail_accounts WHERE user_id=?", (user_id,))
    return cur.fetchone()[0]

def update_gmail_tokens(account_id, access_token, refresh_token=None):
    """Update tokens for a Gmail account (encrypted)"""
    # Encrypt tokens before storing
    encrypted_access = encrypt_token(access_token)
    encrypted_refresh = encrypt_token(refresh_token) if refresh_token else None
    
    if refresh_token:
        cur.execute("""
            UPDATE gmail_accounts SET access_token=?, refresh_token=?
            WHERE id=?
        """, (encrypted_access, encrypted_refresh, account_id))
    else:
        cur.execute("""
            UPDATE gmail_accounts SET access_token=?
            WHERE id=?
        """, (encrypted_access, account_id))
    conn.commit()

def delete_gmail_account(account_id, user_id):
    """Delete a Gmail account"""
    cur.execute("DELETE FROM gmail_accounts WHERE id=? AND user_id=?", (account_id, user_id))
    conn.commit()

def update_gmail_account_name(account_id, user_id, name):
    """Update the name/display name for a Gmail account"""
    cur.execute("""
        UPDATE gmail_accounts SET name=?
        WHERE id=? AND user_id=?
    """, (name, account_id, user_id))
    conn.commit()

def update_user_gmail_tokens(user_id, access_token, refresh_token):
    """Update tokens for the main user account (encrypted)"""
    # Encrypt tokens before storing
    encrypted_access = encrypt_token(access_token)
    encrypted_refresh = encrypt_token(refresh_token) if refresh_token else None
    
    cur.execute("""
        UPDATE users SET gmail_token=?, gmail_refresh_token=?
        WHERE id=?
    """, (encrypted_access, encrypted_refresh, user_id))
    conn.commit()

def get_user_gmail_tokens(user_id):
    """Get Gmail tokens for the main user account (decrypted)"""
    cur.execute("""
        SELECT gmail_token, gmail_refresh_token FROM users WHERE id=?
    """, (user_id,))
    row = cur.fetchone()
    if row:
        return {
            "access_token": decrypt_token(row[0]),
            "refresh_token": decrypt_token(row[1]) if row[1] else None
        }
    return None
