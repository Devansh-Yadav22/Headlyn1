import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";

dotenv.config();

const app = express();

// Secure backend headers using Helmet
app.use(helmet());

// Secure CORS configuration
const allowedOrigins = [
  "http://localhost:5173", // local Vite development
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow local development or server-to-server calls
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Blocked by CORS policy (Unauthorized Domain)"));
    }
  }
}));

app.get("/", (req, res) => {
  res.json({ message: "Headlyn News API is online!" });
});

app.get("/news", async (req, res) => {
  try {
    const country = req.query.country || "us";
    const category = req.query.category || "general";
    const q = req.query.q;

    const categoryMap = {
      politics: "general",
      business: "business",
      technology: "technology",
      science: "science",
      health: "health",
      sports: "sports",
      entertainment: "entertainment",
      general: "world",
    };

    const newsApiCategory = categoryMap[category] || category;

    console.log("Fetching NewsAPI:", country, newsApiCategory);

    const response = await axios.get("https://newsapi.org/v2/top-headlines", {
      params: {
        country,
        category: newsApiCategory === "world" ? "general" : newsApiCategory,
        q,
        pageSize: 30,
        apiKey: process.env.API_KEY,
      },
    });

    console.log("SUCCESS");

    res.json({
      totalResults: response.data.totalResults,
      articles: response.data.articles,
    });

  } catch (err) {
  console.log("====== ERROR START ======");
  console.log("Status:", err.response?.status);
  console.log("Data:", err.response?.data);
  console.log("Message:", err.message);
  console.log("====== ERROR END ======");

  res.status(500).json({ error: "Failed to fetch news" });
}
});

app.listen(5000, () => console.log("Server running on port 5000"));

export default app;
