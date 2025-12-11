# gru/server.py
from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn
from dotenv import load_dotenv
load_dotenv()
import os
from model import load_trained, generate_template

MODEL_PATH = "gru_model.pt"
GRU_PORT = int(os.getenv("GRU_PORT", "5006"))
GRU_HOST = os.getenv("GRU_HOST", "127.0.0.1")

model, label_to_idx, char_to_idx, idx_to_char = load_trained(MODEL_PATH)
app = FastAPI()

class GenerateRequest(BaseModel):
    label: str
    # style and slots are here for future use, but not wired yet
    style: dict | None = None
    slots: dict | None = None

class GenerateResponse(BaseModel):
    skeleton: str

@app.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest):
    skeleton = generate_template(model, label_to_idx, char_to_idx, idx_to_char, req.label)
    return GenerateResponse(skeleton=skeleton)

if __name__ == "__main__":
    uvicorn.run(app, host=GRU_HOST, port=GRU_PORT)
