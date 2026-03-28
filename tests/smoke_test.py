import requests
import time
import os

API_BASE = "http://localhost:8000"

def wait_for_server():
    print("Waiting for server to be ready...")
    for _ in range(30):
        try:
            resp = requests.get(f"{API_BASE}/health")
            if resp.status_code == 200:
                print("Server is UP!")
                return True
        except:
            pass
        time.sleep(2)
    return False

def test_pizza_flow():
    print("\n--- Testing Mario's Pizza Flow ---")
    
    # 1. Ingest
    file_path = "./data/samples/marios_pizza.pdf"
    with open(file_path, 'rb') as f:
        resp = requests.post(f"{API_BASE}/ingest-pdf", files={'file': f})
        print(f"Ingest status: {resp.status_code}")
        print(f"Business: {resp.json()['identity']['name']}")

    # 2. Chat (Simulated Scenario 1)
    session_id = f"test-pizza-{int(time.time())}"
    
    queries = [
        "Hi",
        "I want to order a pizza",
        "Large pepperoni",
        "Regular crust",
        "What sides or drinks do you suggest?", # Testing proactive info retrieval
        "Coke and garlic bread",
        "Actually add extra cheese to that pizza too",
        "Delivery",
        "34 Front Street, N4K 4L7",
        "No",
        "Yes"
    ]
    
    for q in queries:
        print(f"User: {q}")
        resp = requests.post(f"{API_BASE}/chat", params={"session_id": session_id, "message": q})
        print(f"AI: {resp.json()['response']}\n")

def test_dentist_flow():
    print("\n--- Testing Dentist Flow ---")
    
    # 1. Ingest
    file_path = "./data/samples/bright_smile_dental.pdf"
    with open(file_path, 'rb') as f:
        resp = requests.post(f"{API_BASE}/ingest-pdf", files={'file': f})
        print(f"Ingest status: {resp.status_code}")
    
    # 2. Chat (Simulated Scenario 3)
    session_id = f"test-dentist-{int(time.time())}"
    
    queries = [
        "Hello I need to see a skin doctor",
        "Mole check",
        "First available",
        "Tuesday", # Assuming AI proposes times and user picks one
        "John Carter",
        "226-555-0199",
        "Yes",
        "Actually I can't Tuesday",
        "Reschedule",
        "Wednesday"
    ]
    
    for q in queries:
        print(f"User: {q}")
        resp = requests.post(f"{API_BASE}/chat", params={"session_id": session_id, "message": q})
        print(f"AI: {resp.json()['response']}\n")

def test_dry_cleaner_flow():
    print("\n--- Testing Dry Cleaner Flow (Scenario 2) ---")
    file_path = "./data/samples/sunrise_laundry.pdf"
    with open(file_path, 'rb') as f:
        requests.post(f"{API_BASE}/ingest-pdf", files={'file': f})
    
    session_id = f"test-laundry-{int(time.time())}"
    queries = [
        "Hi I need clothes cleaned",
        "1 suit and a jacket",
        "Dry clean both",
        "What kind of extra care or treatments do you offer?",
        "Add extra foaming to the jacket and starch to the suit coat",
        "Regular 3 days turnaround",
        "Pickup",
        "12 King St West, N5A 2L2",
        "Tomorrow morning",
        "9-11 AM",
        "Yes confirm"
    ]
    for q in queries:
        print(f"User: {q}")
        resp = requests.post(f"{API_BASE}/chat", params={"session_id": session_id, "message": q})
        print(f"AI: {resp.json()['response']}\n")

def test_mixed_intent_flow():
    print("\n--- Testing Mixed Intent Flow (Scenario 5) ---")
    # Use Tea House for mixed intent
    file_path = "./data/samples/golden_leaf_teahouse.pdf"
    with open(file_path, 'rb') as f:
        requests.post(f"{API_BASE}/ingest-pdf", files={'file': f})
        
    session_id = f"test-mixed-{int(time.time())}"
    queries = [
        "Hi are you open today?",
        "Ok book a room at 8",
        "Tasting room. Also how much is a Matcha Latte?",
        "John Doe",
        "555-0199",
        "Yes"
    ]
    for q in queries:
        print(f"User: {q}")
        resp = requests.post(f"{API_BASE}/chat", params={"session_id": session_id, "message": q})
        print(f"AI: {resp.json()['response']}\n")

if __name__ == "__main__":
    if wait_for_server():
        test_pizza_flow()
        test_dentist_flow()
        test_dry_cleaner_flow()
        test_mixed_intent_flow()
    else:
        print("Server failed to start. Please run uvicorn first.")
