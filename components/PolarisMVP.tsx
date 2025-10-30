'use client';

/*
Polaris - MVP React Component (single-file)

What this file is:
- A single-file React component (default export) implementing a polished MVP front-end for the Polaris verification flow.
- Uses Tailwind utility classes for styling (assumes Tailwind is configured in the project).
- Provides drag-and-drop and file-picker upload, computes SHA-256 hash in-browser, shows a preview, and POSTs the file to a backend endpoint at /api/verify.
- If the backend is not available it uses a local mock verification runner so you can demo without a server.

Backend contract (what the backend should implement):
POST /api/verify
- Accepts multipart/form-data with field "file" and optional "hash".
- Returns JSON:
  {
    "status": "ok",
    "polarisId": "PLS-000123",
    "authenticityScore": 0.93,
    "aiProbability": 0.07,
    "exif": { ... },
    "hash": "4f6a9d...",
    "message": "Likely Authentic"
  }
- For errors, return HTTP 4xx/5xx with { "status": "error", "message": "..." }

How to use this component:
1. Place this file into a React app (Vite / Next / CRA). Ensure Tailwind is configured.
2. Render <PolarisMVP /> somewhere (e.g., in App.jsx).
3. Implement a minimal backend matching the contract above, or rely on the mock included.

Note: this is a front-end MVP to demonstrate UX, hashing, previews and API wiring. Real-world deployment should add auth, rate-limiting, virus scanning, legal/disclaimer UI, and secure file handling on the server.
*/

import React, { useCallback, useState, useRef } from "react";

function bytesToHex(buffer) {
  return Array.prototype.map
    .call(new Uint8Array(buffer), (x) => ("00" + x.toString(16)).slice(-2))
    .join("");
}

async function computeSHA256(file) {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  return bytesToHex(hashBuffer);
}

// Mock verifier - used if backend isn't reachable
async function mockVerify(file, hash) {
  // crude heuristics just for demo
  const ext = file.name.split(".").pop().toLowerCase();
  const isImage = ["jpg", "jpeg", "png", "webp"].includes(ext);
  const randomScore = 0.6 + Math.random() * 0.35; // 0.6 - 0.95
  const aiProb = 1 - randomScore;
  const message = randomScore > 0.8 ? "Likely Authentic" : randomScore > 0.65 ? "Uncertain" : "Likely AI-generated";
  return new Promise((res) =>
    setTimeout(() =>
      res({
        status: "ok",
        polarisId: "PLS-MOCK-" + Math.floor(Math.random() * 1000000),
        authenticityScore: Number(randomScore.toFixed(2)),
        aiProbability: Number(aiProb.toFixed(2)),
        exif: isImage ? { camera: "MockCam 1.0", hasExif: Math.random() > 0.4 } : { hasExif: false },
        hash,
        message,
      }),
      900
    )
  );
}

export default function PolarisMVP() {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [hash, setHash] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFiles = useCallback(async (files) => {
    setError(null);
    setResult(null);
    const f = files[0];
    if (!f) return;
    setFile(f);

    // show preview if image or short video
    if (f.type.startsWith("image/") || f.type.startsWith("video/")) {
      try {
        const url = URL.createObjectURL(f);
        setPreviewUrl(url);
      } catch (e) {
        setPreviewUrl(null);
      }
    } else {
      setPreviewUrl(null);
    }

    // compute hash (SHA-256) in browser
    try {
      setLoading(true);
      const h = await computeSHA256(f);
      setHash(h);
    } catch (e) {
      setError("Failed to compute file hash");
      setHash(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (e) => {
      e.preventDefault();
      setDragOver(false);
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length) {
        await handleFiles(dt.files);
      }
    },
    [handleFiles]
  );

  const handleSelectClick = () => fileInputRef.current && fileInputRef.current.click();

  const handleFileInput = async (e) => {
    if (e.target.files && e.target.files.length) {
      await handleFiles(e.target.files);
    }
  };

  const uploadAndVerify = async () => {
    setError(null);
    setResult(null);
    if (!file) {
      setError("No file selected");
      return;
    }

    setLoading(true);
    try {
      // try calling real backend
      const form = new FormData();
      form.append("file", file);
      if (hash) form.append("hash", hash);

      const resp = await fetch("/api/verify", { method: "POST", body: form });
      if (!resp.ok) {
        // fallback to mock if 404 or CORS
        throw new Error("Backend error: " + resp.status);
      }
      const json = await resp.json();
      setResult(json);
    } catch (e) {
      console.warn("Backend not reachable or returned error, using mock verifier: ", e.message);
      const mock = await mockVerify(file, hash);
      setResult(mock);
    } finally {
      setLoading(false);
    }
  };

  const clearAll = () => {
    setDragOver(false);
    setFile(null);
    setPreviewUrl(null);
    setHash(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
      <div className="max-w-4xl w-full">
        <header className="mb-6">
          <h1 className="text-3xl font-extrabold">Polaris — Verification Demo</h1>
          <p className="text-slate-600 mt-1">Upload an image or video and Polaris will analyze it for authenticity.</p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              className={`rounded-2xl border-2 p-6 transition-shadow ${
                dragOver ? "border-indigo-500 shadow-lg" : "border-slate-200"
              } bg-white`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Upload</h2>
                  <p className="text-sm text-slate-500">Drag & drop an image or select a file to begin.</p>
                </div>
                <div>
                  <button
                    onClick={handleSelectClick}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                  >
                    Select File
                  </button>
                </div>
              </div>

              <input ref={fileInputRef} onChange={handleFileInput} type="file" className="hidden" />

              <div className="mt-6">
                {file ? (
                  <div className="flex gap-4 items-start">
                    <div className="w-28 h-28 bg-slate-100 rounded-md overflow-hidden flex items-center justify-center">
                      {previewUrl ? (
                        file.type.startsWith("image/") ? (
                          <img src={previewUrl} alt="preview" className="object-cover w-full h-full" />
                        ) : (
                          <video src={previewUrl} className="w-full h-full object-cover" controls />
                        )
                      ) : (
                        <div className="text-slate-400 text-sm">No preview</div>
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{file.name}</div>
                          <div className="text-slate-500 text-sm">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                        </div>
                        <div className="text-right text-sm">
                          <div>Hash:</div>
                          <div className="font-mono text-xs break-all w-48">{hash ?? "—"}</div>
                        </div>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={uploadAndVerify}
                          disabled={loading}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {loading ? "Analyzing..." : "Analyze with Polaris"}
                        </button>
                        <button onClick={clearAll} className="px-3 py-2 border rounded-md text-sm">
                          Clear
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 text-slate-500">No file selected yet.</div>
                )}
              </div>

              <div className="mt-6 text-xs text-slate-400">Tip: For best results use original photos or videos with intact EXIF metadata.</div>
            </div>

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => {
                  // quick demo: load a small demo image from data URI (1x1 transparent) to show flow
                  const blob = new Blob([new Uint8Array([137,80,78,71,13,10,26,10])], { type: "image/png" });
                  const demoFile = new File([blob], "demo.png", { type: "image/png" });
                  handleFiles([demoFile]);
                }}
                className="px-3 py-2 rounded-md border"
              >
                Load Demo Image
              </button>

              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  window.open("https://example.com/what-is-polairs", "_blank");
                }}
                className="px-3 py-2 rounded-md border text-sm"
              >
                What is Polaris?
              </a>
            </div>
          </section>

          <aside>
            <div className="rounded-2xl p-6 bg-white border border-slate-200">
              <h3 className="font-semibold">Verification Report</h3>

              {error && (
                <div className="mt-4 text-sm text-red-600">{error}</div>
              )}

              {!result && (
                <div className="mt-4 text-slate-500 text-sm">No verification run yet. Upload a file and click "Analyze with Polaris."</div>
              )}

              {result && (
                <div className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-slate-500">Polaris ID</div>
                      <div className="font-semibold">{result.polarisId}</div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm text-slate-500">Authenticity</div>
                      <div className="font-semibold">
                        {Math.round((result.authenticityScore ?? 0) * 100)}% — {result.message}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border p-3 bg-slate-50">
                    <div className="text-xs text-slate-500">AI probability</div>
                    <div className="font-mono text-sm">{Number(result.aiProbability ?? 0).toFixed(2)}</div>
                  </div>

                  <div className="text-sm text-slate-500">
                    <div>Hash</div>
                    <div className="font-mono text-xs break-all">{result.hash}</div>
                  </div>

                  <div className="text-sm text-slate-500">
                    <div>EXIF</div>
                    <div className="font-mono text-xs">{JSON.stringify(result.exif)}</div>
                  </div>

                  <div className="flex gap-2">
                    <a
                      className="px-3 py-2 rounded-md border text-sm"
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        // open share link — backend might serve it at /verify/:id
                        if (result.polarisId) {
                          const url = `/verify/${result.polarisId}`;
                          window.open(url, "_blank");
                        }
                      }}
                    >
                      View Share Link
                    </a>

                    <button
                      className="px-3 py-2 rounded-md border text-sm"
                      onClick={() => {
                        navigator.clipboard && navigator.clipboard.writeText(JSON.stringify(result));
                        alert("Report copied to clipboard (demo)");
                      }}
                    >
                      Copy Report
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-6 text-xs text-slate-400">Note: This demo may use a mock verifier if your backend isn't connected. See the top of the component for the backend contract.</div>
            </div>

            <div className="mt-4 rounded-2xl p-4 bg-white border border-slate-200">
              <h4 className="font-semibold text-sm">Developer notes</h4>
              <ul className="text-xs text-slate-500 mt-2 space-y-1">
                <li>- This component computes SHA-256 in-browser using SubtleCrypto.</li>
                <li>- It uploads multipart/form-data to /api/verify. Implement server-side accordingly.</li>
                <li>- Add rate-limiting and file-scanning for production.</li>
              </ul>
            </div>
          </aside>
        </main>

        <footer className="mt-8 text-sm text-slate-500 text-center">Polaris MVP — demo UI • built for founders</footer>
      </div>
    </div>
  );
}
