import os
from pypdf import PdfReader  # <-- PDF Parsing ke liye
import docx  # <-- Word Document Parsing ke liye

def extract_text_from_file(file_path: str) -> str:
    """Dynamically routes file based on extension and returns clean plain text."""
    ext = os.path.splitext(file_path)[1].lower()
    text_accumulator = ""
    
    # 1. Handle Standard Text/Markdown Files
    if ext in ['.txt', '.md']:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()
            
    # 2. 🔥 Handle Adobe PDF Files
    elif ext == '.pdf':
        try:
            reader = PdfReader(file_path)
            pages_text = []
            for page in reader.pages:
                page_extracted = page.extract_text()
                if page_extracted:
                    pages_text.append(page_extracted)
            return "\n".join(pages_text)
        except Exception as e:
            print(f"⚠️ PDF parse error on {file_path}: {e}")
            return ""
            
    # 3. 🔥 Handle Microsoft Word Documents
    elif ext == '.docx':
        try:
            doc = docx.Document(file_path)
            paragraphs_text = [p.text for p in doc.paragraphs]
            return "\n".join(paragraphs_text)
        except Exception as e:
            print(f"⚠️ Word document parse error on {file_path}: {e}")
            return ""
            
    return ""

def run_ingestion_pipeline():
    """Scans the entire data/raw directory and converts multi-format files to a single memory cache."""
    print("⏳ Scanning Data Vault repositories for new asset structures...")
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(current_dir)
    raw_dir = os.path.join(project_root, "data", "raw")
    output_cache_path = os.path.join(project_root, "data", "vault_cache.json")
    
    if not os.path.exists(raw_dir):
        os.makedirs(raw_dir)
        print(f"📁 Created empty raw drop zone at: {raw_dir}")
        return
        
    supported_extensions = ['.txt', '.md', '.pdf', '.docx']
    all_extracted_payloads = []
    
    for filename in os.listdir(raw_dir):
        file_path = os.path.join(raw_dir, filename)
        ext = os.path.splitext(filename)[1].lower()
        
        if os.path.isfile(file_path) and ext in supported_extensions:
            print(f"📦 Processing Corporate Asset: {filename} ({ext.upper()})")
            file_raw_content = extract_text_from_file(file_path)
            
            if file_raw_content.strip():
                # Append formatted document object package
                all_extracted_payloads.append({
                    "title": os.path.splitext(filename)[0].replace("_", " ").title(),
                    "source": filename,
                    "type": ext.replace(".", "").upper(),
                    "content": file_raw_content
                })
                
    # Save the structured unified JSON data cache frame
    import json
    os.makedirs(os.path.dirname(output_cache_path), exist_ok=True)
    with open(output_cache_path, "w", encoding="utf-8") as out_f:
        json.dump(all_extracted_payloads, out_f, indent=4, ensure_ascii=False)
        
    print(f"✓ Ingestion Pipeline Finished! Total files structured: {len(all_extracted_payloads)}")

if __name__ == "__main__":
    run_ingestion_pipeline()