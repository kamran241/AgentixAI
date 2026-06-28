"""
Smoke tests for the AgentixAI API.

Usage (server must be running):
    python tests/smoke_test.py

Requires a test user in the DB. Set env vars or edit the constants below:
    TEST_EMAIL, TEST_PASSWORD, TEST_BUSINESS_ID
"""
import os
import time
import requests

API_BASE = os.getenv("API_BASE", "http://localhost:8000")
TEST_EMAIL = os.getenv("TEST_EMAIL", "test@example.com")
TEST_PASSWORD = os.getenv("TEST_PASSWORD", "testpassword123")
TEST_BUSINESS_ID = int(os.getenv("TEST_BUSINESS_ID", "1"))

SAMPLE_PDF = os.path.join(os.path.dirname(__file__), "sample_data", "marios_pizza.pdf")


def wait_for_server(timeout=60):
    print("Waiting for server...")
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            r = requests.get(f"{API_BASE}/health", timeout=3)
            if r.status_code == 200:
                print("Server is UP.")
                return True
        except Exception:
            pass
        time.sleep(2)
    print("Server did not start in time.")
    return False


def get_token():
    r = requests.post(
        f"{API_BASE}/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
        timeout=10,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def test_health():
    print("\n--- Health check ---")
    r = requests.get(f"{API_BASE}/health", timeout=5)
    assert r.status_code == 200, f"Health failed: {r.status_code}"
    print("OK:", r.json())


def test_auth(token):
    print("\n--- Auth check ---")
    r = requests.get(f"{API_BASE}/auth/me", headers=auth_headers(token), timeout=5)
    assert r.status_code == 200, f"Me failed: {r.status_code} {r.text}"
    print("Logged in as:", r.json().get("email"))


def test_ingest_pdf(token):
    if not os.path.exists(SAMPLE_PDF):
        print(f"\n--- PDF ingest SKIPPED (no sample at {SAMPLE_PDF}) ---")
        return
    print("\n--- PDF ingest ---")
    with open(SAMPLE_PDF, "rb") as f:
        r = requests.post(
            f"{API_BASE}/businesses/ingest",
            files={"file": f},
            headers=auth_headers(token),
            timeout=60,
        )
    print(f"Status: {r.status_code}")
    if r.status_code in (200, 201):
        print("Response:", r.json())
    else:
        print("Body:", r.text[:300])


def test_chat(token):
    print("\n--- Chat flow ---")
    session_id = f"smoke-{int(time.time())}"
    queries = [
        "Hi",
        "What pizzas do you have?",
        "I want to order a large pepperoni",
    ]
    for q in queries:
        r = requests.post(
            f"{API_BASE}/chat",
            params={"session_id": session_id, "message": q, "business_id": TEST_BUSINESS_ID},
            headers=auth_headers(token),
            timeout=30,
        )
        if r.status_code == 200:
            print(f"User: {q}")
            print(f"  AI: {r.json().get('response', '')[:120]}")
        else:
            print(f"Chat failed ({r.status_code}): {r.text[:200]}")


if __name__ == "__main__":
    if not wait_for_server():
        raise SystemExit(1)

    try:
        token = get_token()
    except Exception as e:
        print(f"Login failed — set TEST_EMAIL / TEST_PASSWORD env vars: {e}")
        raise SystemExit(1)

    test_health()
    test_auth(token)
    test_ingest_pdf(token)
    test_chat(token)
    print("\nSmoke tests complete.")
