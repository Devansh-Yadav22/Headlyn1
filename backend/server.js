import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());

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
