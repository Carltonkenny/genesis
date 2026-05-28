from fastapi import FastAPI

app = FastAPI()


@app.get("/")
def root():
    return {"status": "ok"}


@app.get("/items")
def list_items():
    # TODO: add pagination
    # TODO: add filtering
    # TODO: add sorting
    return []
