import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const clientHash = formData.get("hash") as string | null;

  if (!file) {
    return NextResponse.json(
      { status: "error", message: "No file uploaded" },
      { status: 400 }
    );
  }

  // Read file as buffer
  const buffer = Buffer.from(await file.arrayBuffer());

  // Compute server-side hash (for validation)
  const crypto = require("crypto");
  const serverHash = crypto.createHash("sha256").update(buffer).digest("hex");

  if (clientHash && clientHash !== serverHash) {
    return NextResponse.json(
      { status: "error", message: "Hash mismatch - file may be tampered" },
      { status: 400 }
    );
  }

  // Mock AI verification (replace with real logic later)
  const randomScore = 0.6 + Math.random() * 0.35; // 0.6 to 0.95
  const aiProb = 1 - randomScore;
  const message = randomScore > 0.8 ? "Likely Authentic" : randomScore > 0.65 ? "Uncertain" : "Likely AI-generated";

  const result = {
    status: "ok",
    polarisId: `PLS-${Date.now()}`,
    authenticityScore: Number(randomScore.toFixed(2)),
    aiProbability: Number(aiProb.toFixed(2)),
    exif: { hasExif: Math.random() > 0.5 },
    hash: clientHash || serverHash,
    message,
  };

  return NextResponse.json(result);
}
