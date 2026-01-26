import sqlite3
import json
import uuid
from datetime import datetime, timedelta

conn = sqlite3.connect("database.db", check_same_thread=False)
cur = conn.cursor()

cur.execute("""
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id TEXT UNIQUE,
    email TEXT,
    name TEXT
)
""")

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
CREATE TABLE IF NOT EXISTS senders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT,
    email TEXT,
    smtp TEXT,
    port TEXT,
    password TEXT
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

def save_sender(user_id, sender):
    cur.execute("""
        INSERT INTO senders (user_id, name, email, smtp, port, password)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        user_id,
        sender["name"],
        sender["email"],
        sender["smtp"],
        sender["port"],
        sender["password"],
    ))
    conn.commit()

def get_senders(user_id):
    cur.execute("SELECT * FROM senders WHERE user_id=?", (user_id,))
    return cur.fetchall()

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
