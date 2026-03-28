import requests
import time

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

def test_info_questions():
    if not wait_for_server():
        print("Server failed to start.")
        return
    print("\n--- Testing 10 Info Questions (RAG Grounding) ---")
    
    # Ensure a business is loaded (Mario's Pizza)
    session_id = f"info-test-{int(time.time())}"
    
    questions = [
        "What is on the menu?",
        "Do you have pepperoni pizza?",
        "What is the price of garlic bread?",
        "What are your business hours?",
        "Do you offer delivery?",
        "Is there a delivery fee?",
        "What is the price of a small Margherita?",
        "Do you have Coke?",
        "What is the maximum delivery distance?",
        "Can I update my order before it leaves the kitchen?"
    ]
    
    for i, q in enumerate(questions, 1):
        print(f"[{i}] User: {q}")
        resp = requests.post(f"{API_BASE}/chat", params={"session_id": session_id, "message": q})
        answer = resp.json().get('response', 'Error')
        print(f"AI: {answer}\n")
        # In a real audit, we would check if 'According to' or 'Based on' is in the answer
        time.sleep(1)

if __name__ == "__main__":
    test_info_questions()
