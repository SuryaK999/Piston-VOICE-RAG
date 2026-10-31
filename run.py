"""Convenience entry point:  python run.py  (or: uvicorn app.main:app --reload)"""
import os
import sys
import uvicorn

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

if __name__ == "__main__":
    try:
        port = int(os.environ.get("PORT", 8000))
        uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise
