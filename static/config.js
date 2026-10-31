// Piston Voice RAG Agent - Runtime Configuration
// When accessed from Vercel, seamlessly route traffic to the live Render backend.
// When accessed from Render or locally, use same-origin.
if (window.location.hostname.includes('vercel.app')) {
  window.PISTON_BACKEND_URL = "https://piston-voice-rag.onrender.com";
} else {
  window.PISTON_BACKEND_URL = "";
}
