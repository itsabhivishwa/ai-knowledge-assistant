import os
import sys
import json
import httpx
import shutil
import hashlib
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any

current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from core.index import VectorStoreManager
from core.ingest import run_ingestion_pipeline
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="FloCard RAG - Final Flash Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

v_store = None
UPLOADED_HASHES_REGISTRY = set()

def calculate_file_hash(file_stream) -> str:
    md5_hash = hashlib.md5()
    for chunk in iter(lambda: file_stream.read(4096), b""):
        md5_hash.update(chunk)
    file_stream.seek(0)
    return md5_hash.hexdigest()

def init_vector_store():
    global v_store
    try:
        print("💾 Connecting to Local Persistent ChromaDB Engine...")
        v_store = VectorStoreManager()
        print("🚀 Vector Engine Connected Successfully!")
    except Exception as e:
        print(f"⚠️ Vector Store initialization issue: {e}")

init_vector_store()

OLLAMA_API_URL = "http://localhost:11434/api/generate"

class QuestionRequest(BaseModel):
    question: str

# 🔥 UPGRADED AUTOMATED AUTO-FLUSH INGESTION ROUTE
@app.post("/upload")
async def upload_corporate_asset(file: UploadFile = File(...)):
    global v_store
    try:
        file_hash = calculate_file_hash(file.file)
        print(f"🔍 Calculated Fingerprint ID: {file_hash}")
        
        if file_hash in UPLOADED_HASHES_REGISTRY:
            print(f"🛡️ Guardrail Blocked: Duplicate content for '{file.filename}'")
            return {
                "status": "warning",
                "filename": file.filename,
                "message": "Bhai, ye file aap pehle hi upload kar chuke ho! Content bilkul same hai."
            }
            
        target_dir = os.path.join(parent_dir, "data", "raw")
        os.makedirs(target_dir, exist_ok=True)
        file_path = os.path.join(target_dir, file.filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        UPLOADED_HASHES_REGISTRY.add(file_hash)
        print(f"📁 New Asset written securely at: {file_path}")
        
        # 1. Run pipeline to read text and create data/vault_cache.json
        run_ingestion_pipeline()
        
        # 2. 🔥 FORCE CLEAN INDEX RESET: Purane empty metadata pointers ko kill karo
        v_store = None 
        
        # 3. Reload everything from scratch
        v_store = VectorStoreManager()
        v_store.index_documents()  # Hard-sync embeddings inside ChromaDB
        
        print("🚀 [CRITICAL] ChromaDB completely flushed and re-indexed with new file data!")
        
        return {
            "status": "success", 
            "filename": file.filename, 
            "message": "Asset ingested and unique coordinates mapped inside ChromaDB!"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File processing failed: {str(e)}")

@app.post("/ask")
async def ask_assistant(payload: QuestionRequest):
    global v_store
    if not v_store:
        v_store = VectorStoreManager()
        
    raw_query = payload.question.strip()
    
    # 🔥 HOOK 1: Human Error Query Normalization
    # Case sensitivity aur common spelling mistakes (kidscare -> kidcare) ko automatic standard vector inputs par map karega
    processed_query = raw_query.lower().replace("kidscare", "kidcare")
    
    search_term = raw_query
    if "kidcare" in processed_query:
        # Explicit intent expansion for target keyword matching to override strict capitalization bounds
        search_term = "KidCare pediatric digital health companion product exploration value proposition"
        
    try:
        # Increased k value to 3 for deep traversal over multi-page docx hierarchies
        search_results = v_store.similarity_search(search_term, k=3)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Vector look-up failure: {str(e)}")
        
    if not search_results or not search_results['documents'] or len(search_results['documents'][0]) == 0:
        async def empty_streamer():
            yield f"data: {json.dumps({'token': 'I cannot find verifiable metrics for this request in current repositories.'})}\n\n"
        return StreamingResponse(empty_streamer(), media_type="text/event-stream")
        
    retrieved_texts = search_results['documents'][0]
    retrieved_metadatas = search_results['metadatas'][0]
    retrieved_ids = search_results['ids'][0]
    
    context_accumulator = ""
    citations_list = []
    
    for idx in range(len(retrieved_texts)):
        context_accumulator += f"\n[Context Document #{idx+1}]\nSource: {retrieved_metadatas[idx]['source']}\nTitle: {retrieved_metadatas[idx]['title']}\nContent: {retrieved_texts[idx]}\n"
        citations_list.append({
            "id": retrieved_ids[idx], 
            "title": retrieved_metadatas[idx]['title'], 
            "type": retrieved_metadatas[idx]['type'], 
            "source": retrieved_metadatas[idx]['source'], 
            "text": retrieved_texts[idx]
        })
        
    # 🔥 HOOK 2: Flexible Guardrail Prompt
    # Informing the LLM that acronyms/brands are case-insensitive to ensure standard rendering
    system_prompt = (
        "You are an elite AI Knowledge Assistant for FloCard. Your primary mandate is to answer "
        "user questions using ONLY the verified contexts provided below. Adhere strictly to these parameters:\n"
        "1. Treat case variations or naming abbreviations (like 'kidcare' or 'KidCare') as completely identical entities.\n"
        "2. If the context does not contain enough information to ground the answer, state explicitly: "
        "'I cannot find verifiable metrics for this request in current repositories.' Do not invent facts.\n"
        "3. For every factual claim you make, explicitly mention which context document source it came from.\n"
        "4. Maintain a professional, clear engineering tone."
    )
    engineered_prompt = f"{system_prompt}\n\n--- EXTRACTED CONTEXTS ---\n{context_accumulator}\n\n--- USER QUESTION ---\n{raw_query}\n\nAnswer:"

    async def response_streamer():
        ollama_payload = {
            "model": "qwen2.5:1.5b",
            "prompt": engineered_prompt,
            "stream": True,
            "options": { "temperature": 0.1 }  # Balanced predictability with structural inference
        }
        
        yield f"data: {json.dumps({'citations': citations_list})}\n\n"
        
        async with httpx.AsyncClient() as client:
            try:
                async with client.stream("POST", OLLAMA_API_URL, json=ollama_payload, timeout=60.0) as response:
                    async for line in response.aiter_lines():
                        if line:
                            parsed = json.loads(line)
                            token = parsed.get("response", "")
                            yield f"data: {json.dumps({'token': token})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(response_streamer(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)