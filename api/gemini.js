// Vercel Serverless Function
// Place this at api/gemini.js

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
    }

    // This key is securely stored in Vercel's Environment Variables panel
    // It is completely invisible to anyone inspecting the frontend website
    const API_KEY = process.env.GEMINI_API_KEY;

    if (!API_KEY) {
        return res.status(500).json({
            error: "Server Configuration Error: The backend cannot find the GEMINI_API_KEY environment variable. If testing locally, you didn't configure your Vercel keys."
        });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        res.status(200).json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}
