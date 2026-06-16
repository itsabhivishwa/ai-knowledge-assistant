import os
import json
import chromadb
from sentence_transformers import SentenceTransformer

CHUNKS_FILE = os.path.join("data", "vault_cache.json")
DB_DIR = os.path.join("storage", "vector_db")

os.makedirs(os.path.dirname(CHUNKS_FILE), exist_ok=True)
os.makedirs(DB_DIR, exist_ok=True)

class VectorStoreManager:
    def __init__(self):
        print("⏳ Initializing Local Semantic Encoder Model (bge-small-en-v1.5)...")
        self.encoder = SentenceTransformer("BAAI/bge-small-en-v1.5")
        
        print("💾 Connecting to Local Persistent ChromaDB Engine...")
        self.chroma_client = chromadb.PersistentClient(path=DB_DIR)
        
        self.collection = self.chroma_client.get_or_create_collection(
            name="flocard_knowledge_base",
            metadata={"hnsw:space": "cosine"}
        )

    def index_documents(self):
        """Reads vault_cache.json, chunks the content properly, and indexes them in ChromaDB."""
        if not os.path.exists(CHUNKS_FILE):
            print(f"⚠️ Error: Missing source dictionary at {CHUNKS_FILE}.")
            return

        with open(CHUNKS_FILE, "r", encoding="utf-8") as f:
            chunks_data = json.load(f)

        if not chunks_data:
            print("⚠️ vault_cache.json is empty. Nothing to parse.")
            return

        documents = []
        metadatas = []
        ids = []

        # 🔥 CHUNKING OVERLAP ENGINE INJECTION
        # Big texts ko small readable overlapping chunks me break karega taaki embeddings micro-level par strong ho sakein
        for idx, item in enumerate(chunks_data):
            text_content = item.get("content", item.get("text", "")).strip()
            if not text_content:
                continue
                
            source_name = item.get("source", "unknown")
            doc_title = item.get("title", "Document")
            doc_type = item.get("type", "TXT")
            
            # 500 characters ka chunk window with 100 characters overlap
            chunk_size = 500
            overlap = 100
            
            start = 0
            chunk_idx = 0
            while start < len(text_content):
                end = start + chunk_size
                chunk_text = text_content[start:end]
                
                documents.append(chunk_text)
                metadatas.append({
                    "title": f"{doc_title} - Part {chunk_idx+1}",
                    "type": doc_type,
                    "source": source_name
                })
                ids.append(f"id-{idx}-c{chunk_idx}-{hashlib.md5(chunk_text.encode()).hexdigest()[:8]}" if 'hashlib' in globals() else f"id-{idx}-c{chunk_idx}-{len(chunk_text)}")
                
                start += (chunk_size - overlap)
                chunk_idx += 1

        if not documents:
            print("⚠️ No structural fragments extracted for embedding coordinates.")
            return

        print(f"📦 Splitting complete! Generated {len(documents)} micro-nodes. Encoding vectors...")
        encoded_vectors = self.encoder.encode(documents, show_progress_bar=True)
        
        # Fresh upsert delivery
        self.collection.upsert(
            ids=ids,
            embeddings=encoded_vectors.tolist(),
            metadatas=metadatas,
            documents=documents
        )
        print(f"✅ Database Indexing Completed! {len(ids)} micro-nodes committed to vector store layer.")

    def similarity_search(self, query_text, k=3):
        """Encodes user question and performs localized mathematical distance matching."""
        print(f"\n🔍 Processing Semantic Search Vector Query: '{query_text}'")
        query_vector = self.encoder.encode(query_text).tolist()
        
        results = self.collection.query(
            query_embeddings=[query_vector],
            n_results=k
        )
        return results