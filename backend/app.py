import streamlit as st
import urllib.parse
from dotenv import load_dotenv

load_dotenv()

from auth import oauth_client, AUTHORIZE_URL, TOKEN_URL, USERINFO_URL
from db import get_or_create_user

# ---------------- PAGE CONFIG ----------------
st.set_page_config(
    page_title="Coldmail Automation",
    layout="wide"
)

REDIRECT_URI = "http://localhost:8501"

# ---------------- LOAD CSS ----------------
def load_css():
    with open("assets/style.css") as f:
        st.markdown(f"<style>{f.read()}</style>", unsafe_allow_html=True)

load_css()

# ---------------- SESSION STATE INIT ----------------
if "user" not in st.session_state:
    st.session_state.user = None

if "user_id" not in st.session_state:
    st.session_state.user_id = None

# ---------------- UI (HOME) ----------------
st.markdown("""
<div class="card fade-in">
    <h1>🚀 Coldmail Automation</h1>
    <p>
        A secure, OAuth-based cold email automation platform designed for
        students and early professionals.
    </p>
    <ul>
        <li>Google OAuth Login</li>
        <li>Sender-wise email limits</li>
        <li>CSV-based outreach</li>
        <li>Modern, safe workflow</li>
    </ul>
</div>
""", unsafe_allow_html=True)

# ---------------- AUTH FLOW ----------------
if st.session_state.user is None:
    client = oauth_client()

    # Step 1: Show login button
    auth_url, _ = client.create_authorization_url(AUTHORIZE_URL)
    st.markdown(
        f"<a href='{auth_url}'><button class='glow-btn'>Login with Google</button></a>",
        unsafe_allow_html=True
    )

    # Step 2: Wait for redirect with ?code=
    params = st.query_params
    if "code" not in params:
        st.stop()

    # Step 3: Rebuild full callback URL
    query_string = urllib.parse.urlencode(params, doseq=True)
    authorization_response = f"{REDIRECT_URI}?{query_string}"

    # Step 4: Exchange code for token
    client.fetch_token(
        TOKEN_URL,
        authorization_response=authorization_response,
    )

    # Step 5: Fetch user profile
    user = client.get(USERINFO_URL).json()

    # Step 6: Store user in session
    st.session_state.user = user

    # Step 7: Create / get user in DB and store user_id
    user_id = get_or_create_user(
        user["sub"],
        user["email"],
        user["name"]
    )
    st.session_state.user_id = user_id

    # Step 8: Rerun to enter logged-in state
    st.rerun()

# ---------------- LOGGED-IN STATE ----------------
st.success(f"✅ Logged in as {st.session_state.user['email']}")

st.info(
    "Use the sidebar to continue:\n\n"
    "• Upload CSV\n"
    "• Setup Senders\n"
    "• Preview & Send Emails"
)
