import json, os, sys

#Re-launch with the venv's Python (Transformers 5.x) if started with another interpreter
VENV_PYTHON = "/workspace/venv-mimir/bin/python"
if os.path.abspath(sys.prefix) != "/workspace/venv-mimir":
    os.execv(VENV_PYTHON, [VENV_PYTHON] + sys.argv)

import threading, time, uuid
from typing import List, Optional

import torch, uvicorn
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from transformers import AutoTokenizer, Mistral3ForConditionalGeneration
from transformers import TextIteratorStreamer

MODEL = "mistralai/Ministral-3-3B-Reasoning-2512"
MODEL_SNAPSHOT = (
    "/models/huggingface/models--mistralai--Ministral-3-3B-Reasoning-2512/"
    "snapshots/4a36357c811bf511a7b625d132e12f22408aac91"
)

print("Starting Ministral server")
tok = AutoTokenizer.from_pretrained(
    MODEL_SNAPSHOT,
    local_files_only=True,
    fix_mistral_regex=True,
)
model = Mistral3ForConditionalGeneration.from_pretrained(
    MODEL_SNAPSHOT,
    dtype=torch.bfloat16,
    device_map="auto",
    local_files_only=True,
)
model.eval()
lock = threading.Lock()

app = FastAPI()

class Msg(BaseModel):
    role: str
    content: str

class ChatReq(BaseModel):
    model: Optional[str] = MODEL
    messages: List[Msg]
    max_tokens: Optional[int] = 128
    temperature: Optional[float] = 0.0
    top_p: Optional[float] = 1.0
    stream: bool = False

@app.get("/v1/models")
def list_models():
    return {"object": "list", "data": [{"id": MODEL, "object": "model", "owned_by": "local"}]}

@app.post("/v1/chat/completions")
def chat(req: ChatReq):
    inputs = tok.apply_chat_template(
        [m.model_dump() for m in req.messages],
        add_generation_prompt=True, tokenize=True,
        return_dict=True, return_tensors="pt",
    ).to(model.device)
    n_prompt = inputs["input_ids"].shape[-1]

    kwargs = {"max_new_tokens": req.max_tokens}
    if req.temperature and req.temperature > 0:
        kwargs.update(do_sample=True, temperature=req.temperature, top_p=req.top_p)
    else:
        kwargs.update(do_sample=False)

    if req.stream:
        streamer = TextIteratorStreamer(tok, skip_prompt=True, skip_special_tokens=True)
        generation_errors = []

        def generate():
            try:
                with lock, torch.inference_mode():
                    model.generate(**inputs, streamer=streamer, **kwargs)
            except Exception as error:
                generation_errors.append(error)
                streamer.end()

        def stream_tokens():
            worker = threading.Thread(target=generate)
            worker.start()
            try:
                for text in streamer:
                    if text:
                        chunk = {
                            "choices": [{"index": 0, "delta": {"content": text}}],
                        }
                        yield f"data: {json.dumps(chunk)}\n\n"
                worker.join()
                if generation_errors:
                    error = {"error": {"message": str(generation_errors[0])}}
                    yield f"data: {json.dumps(error)}\n\n"
                else:
                    yield "data: [DONE]\n\n"
            finally:
                worker.join()

        return StreamingResponse(
            stream_tokens(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    with lock, torch.inference_mode():
        out = model.generate(**inputs, **kwargs)

    new_tokens = out[0][n_prompt:]
    text = tok.decode(new_tokens, skip_special_tokens=True)
    return {
        "id": f"chatcmpl-{uuid.uuid4().hex}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": MODEL,
        "choices": [{"index": 0, "finish_reason": "stop",
                     "message": {"role": "assistant", "content": text}}],
        "usage": {"prompt_tokens": n_prompt, "completion_tokens": len(new_tokens),
                  "total_tokens": n_prompt + len(new_tokens)},
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)