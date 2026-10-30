import urllib.request
import json

boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
body = (
    f"--{boundary}\r\n"
    "Content-Disposition: form-data; name=\"file\"; filename=\"sample_doc.txt\"\r\n"
    "Content-Type: text/plain\r\n\r\n"
    "Piston is an advanced real-time voice RAG agent powered by Gemini Live and LangGraph.\r\n"
    f"--{boundary}--\r\n"
).encode("utf-8")

# 1. Upload test document
print("1. Testing POST /upload...")
req = urllib.request.Request(
    "http://localhost:8000/upload",
    data=body,
    headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    method="POST"
)
with urllib.request.urlopen(req) as resp:
    res_text = resp.read().decode()
    print("   Upload response:", res_text)

# 2. Check GET /documents
print("2. Testing GET /documents...")
with urllib.request.urlopen("http://localhost:8000/documents") as resp:
    docs = json.loads(resp.read().decode())
    print("   Docs returned:", docs)
    assert len(docs) == 1, f"Expected 1 doc, got {len(docs)}"
    assert docs[0]["name"] == "sample_doc.txt"

# 3. Test DELETE /documents/{name}
print("3. Testing DELETE /documents/{name}...")
del_req = urllib.request.Request(
    "http://localhost:8000/documents/sample_doc.txt",
    method="DELETE"
)
with urllib.request.urlopen(del_req) as resp:
    print("   Delete response:", resp.read().decode())

# 4. Check GET /documents after deletion
print("4. Testing GET /documents after deletion...")
with urllib.request.urlopen("http://localhost:8000/documents") as resp:
    docs2 = json.loads(resp.read().decode())
    print("   Docs returned:", docs2)
    assert len(docs2) == 0, f"Expected 0 docs, got {len(docs2)}"

print("\n>>> ALL LIVE CRUD & PERSISTENCE TESTS PASSED! <<<")
