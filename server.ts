import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Guard helper
function checkApiKey() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not defined in the environment secrets.");
  }
}

// Initialize Firebase Admin SDK for deep server-side Firestore connection
let dbAdmin: any = null;

try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    admin.initializeApp({
      projectId: config.projectId,
    });
    
    // Support custom databaseId if specified, otherwise default
    dbAdmin = config.firestoreDatabaseId 
      ? getFirestore(config.firestoreDatabaseId)
      : getFirestore();
      
    console.log(`🔥 Firebase Admin SDK connected successfully on backend! Database: ${config.firestoreDatabaseId || "(default)"}`);
  } else {
    console.warn("⚠️ firebase-applet-config.json not found. Backend Firestore admin status: disabled.");
  }
} catch (error) {
  console.error("❌ Failed to initialize Firebase Admin-level SDK on server backend:", error);
}

// Global active server status logs check
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Endpoint 1: Guardian AI chatbot (Safety Companion Assistant) with integrated database access
app.post("/api/gemini/chat", async (req, res) => {
  try {
    checkApiKey();
    const { messages, currentSituation, userId } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid messages array" });
    }

    let userContext = "";
    if (dbAdmin && userId) {
      try {
        const profileRef = dbAdmin.doc(`users/${userId}/settings/profile`);
        const profileDoc = await profileRef.get();
        if (profileDoc.exists) {
          const profileData = profileDoc.data();
          userContext += `\nUser Safety Profile: name is "${profileData.name || 'Sentinel Guest'}", medical notes: "${profileData.medicalNotes || 'None stored'}".`;
          if (profileData.contacts && Array.isArray(profileData.contacts)) {
            const contactsList = profileData.contacts.map((c: any) => `${c.relationship}: ${c.name} (${c.phone})`).join(", ");
            userContext += ` Registered emergency contacts: ${contactsList}.`;
          }
        }

        // Fetch active emergency alerts for user
        const alertsColl = dbAdmin.collection("alerts");
        const activeAlertsSnap = await alertsColl
          .where("userId", "==", userId)
          .where("status", "==", "active")
          .limit(1)
          .get();
        
        if (!activeAlertsSnap.empty) {
          const alertDoc = activeAlertsSnap.docs[0];
          const alertData = alertDoc.data();
          userContext += `\n🚨 ALERT WARNING: The user is currently in active Red SOS emergency alert (Alert ID: ${alertDoc.id}). Coordinates GPS: lat ${alertData.latitude}, lng ${alertData.longitude}. Focus entirely on protective instructions, de-escalating terror, and guiding immediate emergency support.`;
        }
      } catch (err) {
        console.warn("Backend failed to dynamically look up user profile or active alerts:", err);
      }
    }

    const contextInstruction = `You are "Guardian AI", an elite, empathetic, and rapid-response virtual safety coordinator for women. 
Your tone should be highly supportive, reassuring, but extremely direct, actionable, and clear. 
Keep your messages reasonably short and readable on a mobile screen under distress. Avoid long introductions or fluffy pleasantries.
Current user emergency state or situation context: ${currentSituation || "Normal monitoring"}.${userContext}

If the user is in acute, immediate danger:
1. Advise them to trigger the primary Red SOS and seek high-density crowded public areas or local help spots immediately.
2. Provide simple, easy-to-read, high-impact tactical advice (e.g. "Walk into the nearest hotel/restaurant", "Maintain eye contact with strangers around you", "Do not go down dark streets").

If the user feels uncomfortable but not in immediate threat:
- Suggest micro-tactics like dynamic decoy play, pretend phone calling, looking busy, or setting up a 5-minute safety check-in countdown.
- Offer to roleplay or provide a simulated conversation they can read out loud to make it look like they are talking to someone (e.g., a protective partner, parent, or emergency desk).`;

    // Map incoming message format to Gemini content structure
    // Each element in contents must be of form: { role: 'user' | 'model', parts: [{ text: '...' }] }
    const formattedContents = messages.map((m: any) => ({
      role: m.sender === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: formattedContents,
      config: {
        systemInstruction: contextInstruction,
        temperature: 0.7,
      }
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Error in /api/gemini/chat:", error);
    res.status(500).json({ error: error.message || "Failed to process chat response from Guardian AI" });
  }
});

// Endpoint 2: surrounds risk and live safety route assessment
app.post("/api/gemini/assess-threat", async (req, res) => {
  try {
    checkApiKey();
    const { description, location, userId } = req.body;

    if (!description) {
      return res.status(400).json({ error: "Surrounding threat description is required." });
    }

    const prompt = `Assess the safety situation described below:
Description: "${description}"
Approximate coordinates/location: ${JSON.stringify(location || "Unknown")}

Perform a strict threat evaluation and return a JSON structured object matching this exact schema rules.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riskLevel: {
              type: Type.INTEGER,
              description: "A scored threat severity level from 1 (entirely safe) to 10 (life-threatening danger)."
            },
            severityText: {
              type: Type.STRING,
              description: "Short label for risk: Low, Elevated, High, Critical."
            },
            colorCode: {
              type: Type.STRING,
              description: "Hex color or Tailwind color class corresponding to risk (e.g. emerald, amber, orange, red)."
            },
            tactics: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of 3 immediate high-impact active tactics the user must carry out right now."
            },
            decoyResponse: {
              type: Type.STRING,
              description: "A quick predefined verbal response or decoy action specifically formulated to diffuse or ward off this threat."
            },
            emergencyRecommended: {
              type: Type.BOOLEAN,
              description: "Whether the situation warrants launching a direct emergency high-pitch SOS alarm or calling local dispatch immediately."
            }
          },
          required: ["riskLevel", "severityText", "colorCode", "tactics", "decoyResponse", "emergencyRecommended"]
        },
        systemInstruction: "You are a professional security and counter-threat assessment expert. Provide rapid, strict, non-sugarcoated situational analysis."
      }
    });

    const assessmentResult = JSON.parse(response.text || "{}");

    // Write assessment report securely to Firestore from the backend if userId present
    if (dbAdmin && userId) {
      try {
        const assessmentId = "assess_" + Math.random().toString(36).substring(2, 11);
        const assessmentPath = `users/${userId}/assessments/${assessmentId}`;
        const record = {
          assessmentId,
          userId,
          description,
          location: location || null,
          riskLevel: assessmentResult.riskLevel || 1,
          severityText: assessmentResult.severityText || "Low",
          tactics: assessmentResult.tactics || [],
          decoyResponse: assessmentResult.decoyResponse || "",
          emergencyRecommended: !!assessmentResult.emergencyRecommended,
          createdAt: new Date().toISOString()
        };
        await dbAdmin.doc(assessmentPath).set(record);
        console.log(`✅ Threat assessment logged in Firestore: ${assessmentPath}`);
        assessmentResult.assessmentId = assessmentId;
      } catch (dbErr) {
        console.error("Backend failed to write threat assessment to Firestore:", dbErr);
      }
    }

    res.json(assessmentResult);
  } catch (error: any) {
    console.error("Error in /api/gemini/assess-threat:", error);
    res.status(500).json({ error: error.message || "Failed to analyze risk" });
  }
});

// Endpoint 3: Call Decoy Audio Generator (TTS voice synthesis)
app.post("/api/gemini/decoy-audio", async (req, res) => {
  try {
    checkApiKey();
    const { promptText, voiceCharacter } = req.body;

    const speakText = promptText || "Hey, I am just around the corner. I see you now! I am walking up to you, stay right there.";
    const voiceName = voiceCharacter || "Kore"; // Kore, Puck, Fenrir, Zephyr, Charon

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: speakText }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName }
          }
        }
      }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      return res.status(500).json({ error: "Failed to synthesize audio payload from TTS model" });
    }

    res.json({ audioData: base64Audio });
  } catch (error: any) {
    console.error("Error in /api/gemini/decoy-audio:", error);
    res.status(500).json({ error: error.message || "Failed to generate decoy calling audio" });
  }
});

// Endpoint 4: Active Emergency Alerts dashboard (Backend Firestore Sync)
app.get("/api/alerts/active", async (req, res) => {
  try {
    if (!dbAdmin) {
      return res.status(530).json({ activeAlerts: [], count: 0, warning: "Firebase is offline on the backend" });
    }
    const alertsSnap = await dbAdmin.collection("alerts")
      .where("status", "==", "active")
      .get();

    const activeAlerts = alertsSnap.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Sort in-memory if needed, or by timestamp. Since we don't have composite indexes created yet,
    // getting all and returning them or sorting in-memory is super safe and avoids "Missing index" errors!
    activeAlerts.sort((a: any, b: any) => {
      const tA = new Date(a.createdAt || 0).getTime();
      const tB = new Date(b.createdAt || 0).getTime();
      return tB - tA;
    });

    res.json({ activeAlerts, count: activeAlerts.length });
  } catch (error: any) {
    console.error("Error fetching active alerts:", error);
    res.status(500).json({ error: error.message || "Failed to query active alerts from backend database." });
  }
});

// Serve Frontend Vite bundle in Prod or integrate Vite Middleware in Dev
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server middleware mounted.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static files from compiled dist folder.");
  }
}

setupVite().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening at http://0.0.0.0:${PORT}`);
  });
}).catch((err) => {
  console.error("Failed to start server with Vite middleware:", err);
});
