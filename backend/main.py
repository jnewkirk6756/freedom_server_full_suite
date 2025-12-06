
from fastapi import FastAPI
from fastapi.responses import HTMLResponse

app = FastAPI()

@app.get("/")
def root():
    return HTMLResponse(open("frontend/index.html").read())

@app.get("/api/chat")
def chat(q: str = ""):
    return {"reply": f"Echo: {q}"}
