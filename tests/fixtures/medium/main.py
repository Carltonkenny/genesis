from fastapi import FastAPI

app = FastAPI()

API_KEY = "sk-live-abc123def456"

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/users/{user_id}")
def get_user(user_id: str):
    data = {"id": user_id, "name": "Test User"}
    return data.items()  # BUG: returns dict_items not dict
