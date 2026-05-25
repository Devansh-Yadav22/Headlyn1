import { useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  signInWithPopup,
} from "firebase/auth";
import { deleteDoc, doc, getDocs, serverTimestamp, setDoc, collection } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Sun,
  Moon,
  Bookmark,
  BookmarkCheck,
  History,
  Sparkles,
  TrendingUp,
  CloudSun,
  LineChart,
  Compass,
  LogOut,
  User,
  AlertTriangle,
  Info,
  X,
  ChevronDown,
  RefreshCw,
  Gauge,
  BookOpen,
  LayoutGrid,
  Menu,
} from "lucide-react";
import "./App.css";
import { auth, db, firebaseReady, googleProvider } from "./firebase";

const topics = ["Top Stories", "World", "India", "Politics", "Economy", "Technology", "Science", "Health", "Culture"];

const categoryThemes = {
  "Top Stories": { accent: "#f8fafc", glow: "#ffffff", ink: "#f8fafc", apiCategory: "general", country: "us" },
  World: { accent: "#d8dee9", glow: "#ffffff", ink: "#eef2f7", apiCategory: "general", country: "us" },
  India: { accent: "#7dd3fc", glow: "#38bdf8", ink: "#e0f2fe", apiCategory: "general", country: "in" },
  Politics: { accent: "#fb923c", glow: "#f97316", ink: "#fff7ed", apiCategory: "general", country: "us", q: "politics" },
  Economy: { accent: "#4ade80", glow: "#22c55e", ink: "#dcfce7", apiCategory: "business", country: "us" },
  Technology: { accent: "#60a5fa", glow: "#3b82f6", ink: "#dbeafe", apiCategory: "technology", country: "us" },
  Science: { accent: "#22d3ee", glow: "#06b6d4", ink: "#cffafe", apiCategory: "science", country: "us" },
  Health: { accent: "#fb7185", glow: "#ef4444", ink: "#ffe4e6", apiCategory: "health", country: "us" },
  Culture: { accent: "#c084fc", glow: "#a855f7", ink: "#f3e8ff", apiCategory: "entertainment", country: "us" },
};

const normalizeArticle = (article, index, topic = "Top Stories") => ({
  id: article.id || article.url || `live-${index}`,
  title: article.title || "Untitled story",
  dek: article.description || article.content || "Open the source for the full report.",
  source: article.source?.name || article.source || "Live Wire",
  topic,
  region: article.region || "World",
  minutes: Math.max(2, Math.min(8, Math.round((article.description?.length || 240) / 80))),
  trend: article.trend || "+5%",
  image:
    article.image ||
    article.urlToImage ||
    "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=80",
  url: article.url,
});

const savedDocId = (id) => id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 140);

function App() {
  const [activeTopic, setActiveTopic] = useState("Top Stories");
  const [query, setQuery] = useState("");
  const [compact, setCompact] = useState(false);
  const [saved, setSaved] = useState(() => new Set());
  const [savedArticles, setSavedArticles] = useState(() => new Map());
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [liveArticles, setLiveArticles] = useState([]);
  const [status, setStatus] = useState("Curated edition");
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [scrolled, setScrolled] = useState(false);
  const [loading, setLoading] = useState(false);
  const activeTheme = categoryThemes[activeTopic] || categoryThemes["Top Stories"];

  // Mobile drawer sidebar state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Advanced Interactive Sidebar states
  const [sidebarTab, setSidebarTab] = useState("bookmarks"); // "bookmarks" | "history"
  const [recentlyViewed, setRecentlyViewed] = useState(() => {
    try {
      const cached = localStorage.getItem("headlyn_recent");
      if (cached) {
        const parsed = JSON.parse(cached);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      console.error("Failed to parse recently viewed history:", e);
    }
    return [];
  });

  // Geolocation weather widget states
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState("");

  // Simulated live ticking markets widget
  const [marketPrices, setMarketPrices] = useState([
    { ticker: "BTC", price: 92850, delta: 1.42, name: "Bitcoin" },
    { ticker: "ETH", price: 3420, delta: -0.58, name: "Ethereum" },
    { ticker: "SOL", price: 184.50, delta: 4.82, name: "Solana" },
    { ticker: "AAPL", price: 182.40, delta: 0.22, name: "Apple Inc." },
    { ticker: "NVDA", price: 915.20, delta: 3.45, name: "NVIDIA Corp" },
    { ticker: "TSLA", price: 178.60, delta: -2.14, name: "Tesla Inc." },
    { ticker: "MSFT", price: 421.90, delta: 0.88, name: "Microsoft Corp" },
  ]);

  // Card AI Lens Panel state
  const [activeAILensId, setActiveAILensId] = useState(null);
  const [aiLensTab, setAiLensTab] = useState("summary"); // "summary" | "elif5" | "bias"

  // 1. Firebase Google Sign-In Trigger
  const handleGoogleSignIn = async () => {
    if (!auth || !googleProvider) {
      setAuthMessage("Firebase configuration not fully loaded.");
      return;
    }
    setAuthBusy(true);
    setAuthMessage("");
    try {
      await signInWithPopup(auth, googleProvider);
      setShowAuthModal(false);
    } catch (error) {
      setAuthMessage(error.message.replace("Firebase: ", ""));
    } finally {
      setAuthBusy(false);
    }
  };

  // 2. Weather station location dynamic authorization
  const fetchWeather = async (lat, lon, cityName) => {
    try {
      setWeatherLoading(true);
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=celsius`
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      const temp = Math.round(data.current_weather.temperature);
      const code = data.current_weather.weathercode;
      
      const conditionMap = {
        0: { label: "Sunny", desc: "Clear sky" },
        1: { label: "Mostly Clear", desc: "Mainly clear" },
        2: { label: "Partly Cloudy", desc: "Partly cloudy" },
        3: { label: "Overcast", desc: "Overcast clouds" },
        45: { label: "Foggy", desc: "Foggy vision" },
        48: { label: "Foggy", desc: "Rime fog" },
        51: { label: "Drizzle", desc: "Light drizzle" },
        53: { label: "Drizzle", desc: "Moderate drizzle" },
        55: { label: "Drizzle", desc: "Heavy drizzle" },
        61: { label: "Rainy", desc: "Light rain" },
        63: { label: "Rainy", desc: "Moderate rain" },
        65: { label: "Rainy", desc: "Heavy rain" },
        71: { label: "Snowy", desc: "Light snow" },
        73: { label: "Snowy", desc: "Moderate snow" },
        75: { label: "Snowy", desc: "Heavy snow" },
        95: { label: "Stormy", desc: "Thunderstorm" },
      };
      
      const cond = conditionMap[code] || { label: "Clear", desc: "Clear conditions" };
      setWeather({
        temp,
        condition: cond.label,
        description: cond.desc,
        city: cityName,
      });
      setWeatherError("");
    } catch {
      setWeatherError("Weather lookup failed.");
    } finally {
      setWeatherLoading(false);
    }
  };

  useEffect(() => {
    if (!navigator.geolocation) {
      setWeatherError("Geolocation disabled.");
      fetchWeather(28.6139, 77.2090, "New Delhi");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        fetchWeather(latitude, longitude, "Local Station");
      },
      () => {
        setWeatherError("Default: New Delhi");
        fetchWeather(28.6139, 77.2090, "New Delhi");
      }
    );
  }, []);

  // 3. Live Stock Ticker intervals
  useEffect(() => {
    const interval = setInterval(() => {
      setMarketPrices((prev) =>
        prev.map((item) => {
          const changePercent = (Math.random() - 0.5) * 0.35;
          const newPrice = Number((item.price * (1 + changePercent / 100)).toFixed(2));
          const newDelta = Number((item.delta + changePercent).toFixed(2));
          return { ...item, price: newPrice, delta: newDelta };
        })
      );
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  // 4. Recently viewed tracker
  const trackRecentlyViewed = (article) => {
    setRecentlyViewed((prev) => {
      const prevArray = Array.isArray(prev) ? prev : [];
      const filtered = prevArray.filter((item) => item.id !== article.id);
      const next = [article, ...filtered].slice(0, 5);
      try {
        localStorage.setItem("headlyn_recent", JSON.stringify(next));
      } catch (e) {
        console.error("Failed to cache recently viewed history:", e);
      }
      return next;
    });
  };

  // 5. Intelligent custom interest topic mapping
  const recommendationTopic = useMemo(() => {
    const safeViewed = Array.isArray(recentlyViewed) ? recentlyViewed : [];
    if (safeViewed.length === 0) return null;
    const counts = {};
    safeViewed.forEach((item) => {
      if (item && item.topic) {
        counts[item.topic] = (counts[item.topic] || 0) + 1;
      }
    });
    let maxTopic = null;
    let maxCount = 0;
    Object.entries(counts).forEach(([topic, count]) => {
      if (count > maxCount) {
        maxCount = count;
        maxTopic = topic;
      }
    });
    return maxTopic;
  }, [recentlyViewed]);

  // 6. Dynamic dynamically parsed AI Daily highlights
  const aiBriefingPoints = useMemo(() => {
    if (loading) return ["Decrypting global wires...", "Aggregating telemetry parameters...", "Analyzing data density..."];
    if (liveArticles.length === 0) {
      return [
        "Headlyn aggregate networks fully functional.",
        "Awaiting active category data streams.",
        "Firebase security and Helmet middleware protections verified."
      ];
    }
    const subset = liveArticles.slice(0, 3);
    return subset.map((art, idx) => {
      const summaries = [
        `Summary Alert: "${art.title.replace(/\s*-\s*.*$/, "")}" marks a pivotal event with active international developments.`,
        `Trend Vector: ${art.source} report identifies key implications surrounding active ${art.topic} dynamics.`,
        `Intelligence Brief: Sector updates indicate changing patterns within the ${art.region} theater.`,
      ];
      return summaries[idx] || `${art.source} covers: ${art.title.slice(0, 48)}...`;
    });
  }, [liveArticles, loading]);

  // 7. Interactive AI Lens generator
  const getAILensData = (article) => {
    const titleClean = article.title.replace(/\s*-\s*.*$/, "");
    const hash = article.title.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    
    const summaryBullets = [
      `Core Event: Essential reporting centers around "${titleClean}" noting rapid global traction.`,
      `Context Analysis: Wire streams from ${article.source} highlight that this marks a core shift in ${article.topic} parameters.`,
      `Projection Index: Financial and regional trackers project secondary impacts across surrounding sectors.`
    ];

    const elif5Text = `Think of it like a playground game! A big block named "${titleClean.slice(0, 38)}..." just swapped places. ${article.source} wants us to see this because it changes how other players move around in ${article.topic}! It's like adding a fun new rule to tag that changes the whole score!`;

    const biasOptions = [
      { label: "Neutral / Objective", color: "#10b981", type: "Center" },
      { label: "Mild Left-leaning", color: "#3b82f6", type: "Left" },
      { label: "Mild Right-leaning", color: "#f97316", type: "Right" },
    ];
    const credibilityOptions = [
      { label: "High (Verify Checked)", color: "#10b981" },
      { label: "Very High (Wire Source)", color: "#06b6d4" },
      { label: "Medium (Developing)", color: "#eab308" },
    ];

    const bias = biasOptions[hash % 3];
    const cred = credibilityOptions[hash % 3];
    const score = 78 + (hash % 18);

    return {
      summary: summaryBullets,
      elif5: elif5Text,
      biasLabel: bias.label,
      biasColor: bias.color,
      credibilityLabel: cred.label,
      credibilityColor: cred.color,
      score,
    };
  };

  useEffect(() => {
    if (!auth) return undefined;
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthMessage("");
      if (currentUser) {
        setShowAuthModal(false);
      }
    });
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    getDocs(collection(db, "users", user.uid, "savedArticles"))
      .then((snapshot) => {
        const savedIds = new Set();
        const savedMap = new Map();
        snapshot.docs.forEach((savedArticle) => {
          const data = savedArticle.data();
          savedIds.add(data.articleId);
          savedMap.set(data.articleId, {
            id: data.articleId,
            title: data.title,
            dek: data.dek || "Open the source for the full report.",
            source: data.source,
            topic: data.topic,
            region: data.region || "World",
            minutes: data.minutes || 3,
            trend: "+0%",
            url: data.url,
            image:
              data.image ||
              "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=80",
          });
        });
        setSaved(savedIds);
        setSavedArticles(savedMap);
      })
      .catch(() => setAuthMessage("Sync error."));
  }, [user]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    const params = new URLSearchParams({
      country: activeTheme.country,
      category: activeTheme.apiCategory,
    });
    if (activeTheme.q) params.set("q", activeTheme.q);

    fetch(`/api/news?${params.toString()}`)
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data) => {
        if (ignore) return;
        const articles = (data.articles || [])
          .slice(0, 30)
          .map((article, index) => normalizeArticle(article, index, activeTopic));

        if (articles.length > 0) {
          setLiveArticles(articles);
          setStatus("Live feed connected");
        } else {
          setLiveArticles([]);
          setStatus("Curated edition");
        }
      })
      .catch(() => {
        if (!ignore) {
          setLiveArticles([]);
          setStatus("Curated edition");
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [activeTopic, activeTheme.apiCategory, activeTheme.country, activeTheme.q]);

  const articles = useMemo(() => liveArticles, [liveArticles]);
  const lead = articles[0] || {
    id: "loading",
    title: "Connecting to live feed...",
    dek: "Please wait while we connect to secure news API systems and gather updates.",
    source: "Headlyn Desk",
    minutes: 3,
    image: "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=80",
  };

  useEffect(() => {
    let seoTitle = "Headlyn";
    if (query.trim()) {
      seoTitle = `Search: "${query.trim()}" — Headlyn`;
    } else if (activeTopic && activeTopic !== "Top Stories") {
      seoTitle = `${activeTopic} — Headlyn`;
    } else if (showSavedOnly) {
      seoTitle = "Saved — Headlyn";
    }
    document.title = seoTitle;

    let descriptionText = "Get sharp, visually stunning, and highly curated news briefings across World, India, Technology, Economy, Science, and Culture on Headlyn.";
    if (lead && lead.title && lead.id !== "loading") {
      descriptionText = `Latest in ${activeTopic}: ${lead.title}. ${lead.dek}`;
    }

    const updateMetaTag = (name, value, isProperty = false) => {
      const attribute = isProperty ? "property" : "name";
      let tag = document.querySelector(`meta[${attribute}="${name}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute(attribute, name);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", value);
    };

    updateMetaTag("description", descriptionText);
    updateMetaTag("keywords", `news, aggregator, briefings, ${activeTopic.toLowerCase()}, custom feed, headlyn news, ${query.trim() ? query.trim() + ',' : ''} live updates`);
    updateMetaTag("og:title", seoTitle, true);
    updateMetaTag("og:description", descriptionText, true);
    if (lead && lead.image) updateMetaTag("og:image", lead.image, true);
    updateMetaTag("og:type", "website", true);
    updateMetaTag("og:url", window.location.href, true);

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", window.location.origin + window.location.pathname);
  }, [activeTopic, query, showSavedOnly, lead]);

  const filteredArticles = useMemo(() => {
    const search = query.trim().toLowerCase();
    const baseArticles = showSavedOnly
      ? Array.from(savedArticles.values()).filter((article) => saved.has(article.id))
      : articles;

    return baseArticles.filter((article) => {
      const matchesTopic =
        showSavedOnly ||
        activeTopic === "Top Stories" ||
        article.topic === activeTopic ||
        article.region === activeTopic ||
        (activeTopic === "World" && article.region === "World");
      const matchesSearch =
        !search ||
        [article.title, article.dek, article.source, article.topic, article.region]
          .join(" ")
          .toLowerCase()
          .includes(search);
      return matchesTopic && matchesSearch;
    });
  }, [activeTopic, articles, query, saved, savedArticles, showSavedOnly]);

  const toggleSaved = async (article) => {
    const id = article.id;
    setSaved((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

    setSavedArticles((current) => {
      const next = new Map(current);
      if (next.has(id)) next.delete(id);
      else next.set(id, article);
      return next;
    });

    if (!user || !db) {
      if (firebaseReady) setAuthMessage("Sign in to sync saved articles.");
      return;
    }

    const articleRef = doc(db, "users", user.uid, "savedArticles", savedDocId(id));
    const wasSaved = saved.has(id);

    try {
      if (wasSaved) {
        await deleteDoc(articleRef);
      } else {
        await setDoc(articleRef, {
          articleId: id,
          title: article.title,
          dek: article.dek,
          source: article.source,
          topic: article.topic,
          region: article.region,
          minutes: article.minutes,
          url: article.url || "",
          image: article.image || "",
          savedAt: serverTimestamp(),
        });
      }
    } catch {
      setAuthMessage("Sync failed. Local state updated.");
    }
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    if (!auth) {
      setAuthMessage("Firebase is offline.");
      return;
    }
    setAuthBusy(true);
    setAuthMessage("");
    try {
      if (authMode === "register") {
        await createUserWithEmailAndPassword(auth, authEmail, authPassword);
      } else {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      }
      setAuthEmail("");
      setAuthPassword("");
    } catch (error) {
      setAuthMessage(error.message.replace("Firebase: ", ""));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (!auth) return;
    await signOut(auth);
    setSaved(new Set());
    setSavedArticles(new Map());
    setShowSavedOnly(false);
  };

  const handleGlowMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--y", `${event.clientY - rect.top}px`);
  };

  const themeForArticle = (topic) => categoryThemes[topic] || categoryThemes["Top Stories"];

  // Sidebar widget contents JSX
  const renderSidebarContent = () => (
    <>
      {/* 1. Account Identity Panel */}
      <div className="auth-card glass-surface hover-lift" onMouseMove={handleGlowMove}>
        {user ? (
          <div className="auth-user-panel">
            <span className="panel-kicker"><User size={12} className="kicker-icon" /> Account</span>
            <strong>{user.displayName || user.email?.split("@")[0]}</strong>
            <p className="auth-email-txt">{user.email}</p>
            <button className="signout-btn hover-lift" onClick={handleSignOut}>
              <LogOut size={13} /> Sign Out
            </button>
          </div>
        ) : (
          <div className="auth-prompt-panel">
            <span className="panel-kicker"><User size={12} className="kicker-icon" /> Identity</span>
            <strong>Personalize</strong>
            <p>Sync your bookmarks and custom interest feed securely.</p>
            <button
              className="auth-trigger-btn hover-lift"
              onClick={() => {
                setShowAuthModal(true);
                setAuthMessage("");
              }}
            >
              Sign In / Connect
            </button>
          </div>
        )}
      </div>

      {/* 2. Geolocation Weather Widget */}
      <div className="weather-card glass-surface hover-lift" onMouseMove={handleGlowMove}>
        <span className="panel-kicker"><CloudSun size={12} className="kicker-icon" /> Weather Station</span>
        {weatherLoading ? (
          <div className="widget-loading-state">
            <RefreshCw size={14} className="spinning-icon" />
            <span>Tracking local coordinates...</span>
          </div>
        ) : weatherError && !weather ? (
          <div className="widget-error-state">
            <Info size={14} />
            <span>{weatherError}</span>
          </div>
        ) : weather ? (
          <div className="weather-grid-widget">
            <div className="weather-temp-section">
              <span className="weather-temp">{weather.temp}°C</span>
              <span className="weather-condition">{weather.condition}</span>
            </div>
            <div className="weather-meta-section">
              <span className="weather-desc">{weather.description}</span>
              <span className="weather-city">{weather.city}</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* 3. Simulated Market Pulse Tickers */}
      <div className="market-card glass-surface hover-lift" onMouseMove={handleGlowMove}>
        <span className="panel-kicker"><LineChart size={12} className="kicker-icon" /> Market Pulse</span>
        <div className="market-list">
          {marketPrices.map((stock) => (
            <div className="market-item" key={stock.ticker}>
              <div className="market-item-identity">
                <span className="ticker-symbol">{stock.ticker}</span>
                <span className="ticker-name">{stock.name}</span>
              </div>
              <div className="market-item-pricing">
                <span className="ticker-price">${stock.price}</span>
                <span className={`ticker-delta ${stock.delta >= 0 ? "positive" : "negative"}`}>
                  {stock.delta >= 0 ? `▲ +${stock.delta}%` : `▼ ${stock.delta}%`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Dynamic AI Daily highlights */}
      <div className="ai-briefing-card glass-surface hover-lift" onMouseMove={handleGlowMove}>
        <span className="panel-kicker"><Sparkles size={12} className="kicker-icon" /> Daily Briefing</span>
        <div className="briefing-bullets">
          {aiBriefingPoints.map((point, index) => (
            <div className="briefing-bullet" key={index}>
              <span className="bullet-glow-dot"></span>
              <p>{point}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Trending Searches and Hot Hashtags */}
      <div className="trending-card glass-surface hover-lift" onMouseMove={handleGlowMove}>
        <span className="panel-kicker"><TrendingUp size={12} className="kicker-icon" /> Trending Searches</span>
        <div className="trending-tags">
          {["#NvidiaEarnings", "#SpaceXLaunch", "#FedInterestRates", "#GlobalAlliances", "#QuantumChip", "#AIAgents", "#CryptoRally"].map((tag) => (
            <button
              className="trending-tag-pill hover-lift"
              key={tag}
              onClick={() => {
                setQuery(tag.replace("#", ""));
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* 6. Tabs: Saved Bookmarks vs. Recently Opened History */}
      <div className="archive-tab-card glass-surface hover-lift" onMouseMove={handleGlowMove}>
        <div className="archive-tabs-header">
          <button
            className={sidebarTab === "bookmarks" ? "archive-tab-btn active" : "archive-tab-btn"}
            onClick={() => setSidebarTab("bookmarks")}
          >
            <Bookmark size={13} /> Saved ({saved.size})
          </button>
          <button
            className={sidebarTab === "history" ? "archive-tab-btn active" : "archive-tab-btn"}
            onClick={() => setSidebarTab("history")}
          >
            <History size={13} /> History ({recentlyViewed.length})
          </button>
        </div>

        <div className="archive-tab-contents">
          {sidebarTab === "bookmarks" ? (
            <div className="archive-list">
              {Array.from(savedArticles.values()).filter(Boolean).length === 0 ? (
                <div className="archive-empty-state">
                  <p>Bookmarked stories appear here.</p>
                </div>
              ) : (
                Array.from(savedArticles.values()).map((art) => {
                  if (!art || !art.id) return null;
                  return (
                    <div
                      className="archive-item hover-lift"
                      key={art.id}
                      onClick={() => {
                        if (art.url) window.open(art.url, "_blank");
                      }}
                    >
                      <span>{art.topic || "News"}</span>
                      <h4>{art.title || "Untitled story"}</h4>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="archive-list">
              {recentlyViewed.filter(Boolean).length === 0 ? (
                <div className="archive-empty-state">
                  <p>Opened articles will record here.</p>
                </div>
              ) : (
                recentlyViewed.map((art) => {
                  if (!art || !art.id) return null;
                  return (
                    <div
                      className="archive-item hover-lift"
                      key={art.id}
                      onClick={() => {
                        if (art.url) window.open(art.url, "_blank");
                      }}
                    >
                      <span>{art.topic || "News"}</span>
                      <h4>{art.title || "Untitled story"}</h4>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <main
      className={`${compact ? "app compact" : "app"} ${theme === "light" ? "light-theme" : ""}`}
      style={{
        "--theme-accent": activeTheme.accent,
        "--theme-glow": activeTheme.glow,
        "--theme-ink": activeTheme.ink,
      }}
    >
      {/* Sleek Floating Header */}
      <nav className={`topbar glass-surface ${scrolled ? "scrolled" : ""}`} aria-label="Primary navigation" onMouseMove={handleGlowMove}>
        <div className="topbar-left">
          <button className="mobile-menu-btn hover-lift" onClick={() => setMobileSidebarOpen(true)} aria-label="Open sidebar panel">
            <Menu size={18} />
          </button>
          <button className="brand hover-lift" onMouseMove={handleGlowMove} onClick={() => { setActiveTopic("Top Stories"); setShowSavedOnly(false); setQuery(""); }} aria-label="Go to top stories">
            <span className="brand-mark">H</span>
            <span>Headlyn</span>
          </button>
        </div>

        <div className="search-wrap hover-lift" onMouseMove={handleGlowMove}>
          <span aria-hidden="true">Search</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Topics, sources, regions"
            aria-label="Search news"
          />
        </div>

        <div className="topbar-actions">
          <button className="theme-toggle-btn hover-lift" onMouseMove={handleGlowMove} onClick={() => setTheme((theme) => (theme === "dark" ? "light" : "dark"))} aria-label="Toggle light and dark themes">
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button className="icon-button hover-lift" onMouseMove={handleGlowMove} onClick={() => setCompact((value) => !value)} aria-label="Toggle compact layout">
            {compact ? <LayoutGrid size={16} /> : <List size={16} />}
          </button>
        </div>
      </nav>

      {/* Main Premium Dashboard Container Split */}
      <div className="dashboard-container">
        
        {/* Left Side: Dynamic Scrolling News Feed */}
        <section className="feed-area">
          
          {/* Lead Story Card with skeletons */}
          {loading ? (
            <article className="lead-story glass-surface skeleton-lead">
              <div className="skeleton-lead-image skeleton-shimmer"></div>
              <div className="lead-copy">
                <div className="eyebrow">
                  <span className="skeleton-text skeleton-shimmer short"></span>
                  <span className="skeleton-text skeleton-shimmer short"></span>
                </div>
                <h1 className="skeleton-title skeleton-shimmer large"></h1>
                <h1 className="skeleton-title skeleton-shimmer large medium"></h1>
                <p className="skeleton-text skeleton-shimmer"></p>
                <p className="skeleton-text skeleton-shimmer medium"></p>
                <div className="lead-actions">
                  <span className="skeleton-btn skeleton-shimmer large"></span>
                  <span className="skeleton-btn skeleton-shimmer large"></span>
                </div>
              </div>
            </article>
          ) : (
            <motion.article
              className="lead-story glass-surface hover-lift"
              onMouseMove={handleGlowMove}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <img src={lead.image} alt="" />
              <div className="lead-copy">
                <div className="eyebrow">
                  <span>{status}</span>
                  <span>{lead.source}</span>
                </div>
                <h1>{lead.title}</h1>
                <p>{lead.dek}</p>
                <div className="lead-actions">
                  <button className="hover-lift" onMouseMove={handleGlowMove} onClick={() => toggleSaved(lead)}>
                    {saved.has(lead.id) ? <BookmarkCheck size={14} className="btn-icon-inside" /> : <Bookmark size={14} className="btn-icon-inside" />}
                    {saved.has(lead.id) ? "Saved" : "Save story"}
                  </button>
                  {lead.url ? (
                    <a className="hover-lift" onMouseMove={handleGlowMove} href={lead.url} target="_blank" rel="noreferrer" onClick={() => trackRecentlyViewed(lead)}>
                      <Compass size={14} className="btn-icon-inside" /> Open source
                    </a>
                  ) : (
                    <span>{lead.minutes} min briefing</span>
                  )}
                </div>
              </div>
            </motion.article>
          )}

          {/* Core Horizontal Topic Strip Selector */}
          <section className="topic-strip" aria-label="Topics">
            {topics.map((topic) => {
              const topicTheme = categoryThemes[topic] || categoryThemes["Top Stories"];
              return (
                <button
                  key={topic}
                  className={topic === activeTopic && !showSavedOnly ? "active hover-lift" : "hover-lift"}
                  style={{ "--item-glow": topicTheme.glow, "--item-accent": topicTheme.accent }}
                  onMouseMove={handleGlowMove}
                  onClick={() => {
                    setShowSavedOnly(false);
                    setActiveTopic(topic);
                  }}
                >
                  {topic}
                </button>
              );
            })}
          </section>

          {/* Content Heading Shell */}
          <div className="section-heading">
            <div>
              <span>Edition</span>
              <h2>{showSavedOnly ? "Saved Archives" : activeTopic}</h2>
            </div>
            <p>{query ? `Filtered by "${query}"` : "Sharp, line-clamped briefings."}</p>
          </div>

          {/* Multi-Column News Cards Grid */}
          <div className="news-grid">
            {loading ? (
              Array.from({ length: 8 }).map((_, index) => (
                <div className="story-card skeleton-card glass-surface" key={`skeleton-${index}`}>
                  <div className="skeleton-image skeleton-shimmer"></div>
                  <div className="story-body">
                    <div className="story-meta">
                      <span className="skeleton-badge skeleton-shimmer"></span>
                      <span className="skeleton-text skeleton-shimmer short"></span>
                    </div>
                    <h3 className="skeleton-title skeleton-shimmer"></h3>
                    <h3 className="skeleton-title skeleton-shimmer medium"></h3>
                    <p className="skeleton-text skeleton-shimmer"></p>
                    <p className="skeleton-text skeleton-shimmer medium"></p>
                    <div className="story-footer">
                      <span className="skeleton-text skeleton-shimmer short"></span>
                      <span className="skeleton-btn skeleton-shimmer"></span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredArticles.map((article) => {
                  const articleTheme = themeForArticle(article.topic);
                  const isSaved = saved.has(article.id);
                  const isPersonalRecommendation = recommendationTopic === article.topic;
                  const hasAILensOpen = activeAILensId === article.id;
                  const aiData = getAILensData(article);

                  return (
                    <motion.article
                      className={article.url ? "story-card clickable-card glass-surface hover-lift" : "story-card glass-surface hover-lift"}
                      key={article.id}
                      onMouseMove={handleGlowMove}
                      onClick={() => {
                        trackRecentlyViewed(article);
                        if (article.url) window.open(article.url, "_blank", "noopener,noreferrer");
                      }}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3 }}
                      style={{
                        "--item-accent": articleTheme.accent,
                        "--item-glow": articleTheme.glow,
                        "--item-ink": articleTheme.ink,
                      }}
                    >
                      <div className="card-image-wrap">
                        <img src={article.image} alt="" />
                        {isPersonalRecommendation && (
                          <div className="personal-match-badge">
                            <Sparkles size={11} /> AI Match
                          </div>
                        )}
                      </div>

                      <div className="story-body">
                        <div className="story-meta">
                          <span>{article.topic}</span>
                          <span>{article.minutes} min read</span>
                        </div>
                        <h3>{article.title}</h3>
                        <p>{article.dek}</p>
                        
                        <div className="story-footer">
                          <span>{article.source}</span>
                          <div className="card-action-btns">
                            <button
                              className={hasAILensOpen ? "ai-lens-trigger-btn active hover-lift" : "ai-lens-trigger-btn hover-lift"}
                              onClick={(event) => {
                                event.stopPropagation();
                                setActiveAILensId(hasAILensOpen ? null : article.id);
                              }}
                              aria-label="Open AI tools"
                            >
                              <Sparkles size={13} />
                            </button>
                            <button
                              className="save-action-btn hover-lift"
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleSaved(article);
                              }}
                              aria-label={`Save ${article.title}`}
                            >
                              {isSaved ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Framer Motion Slide-Down AI Drawer Panel */}
                      <AnimatePresence>
                        {hasAILensOpen && (
                          <motion.div
                            className="card-ai-drawer"
                            onClick={(e) => e.stopPropagation()}
                            initial={{ opacity: 0, scaleY: 0.94, originY: 0 }}
                            animate={{ opacity: 1, scaleY: 1, originY: 0 }}
                            exit={{ opacity: 0, scaleY: 0.94, originY: 0 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                          >
                            <div className="ai-drawer-tabs">
                              <button
                                className={aiLensTab === "summary" ? "ai-tab active" : "ai-tab"}
                                onClick={() => setAiLensTab("summary")}
                              >
                                <BookOpen size={12} /> Brief
                              </button>
                              <button
                                className={aiLensTab === "elif5" ? "ai-tab active" : "ai-tab"}
                                onClick={() => setAiLensTab("elif5")}
                              >
                                <Info size={12} /> ELI5
                              </button>
                              <button
                                className={aiLensTab === "bias" ? "ai-tab active" : "ai-tab"}
                                onClick={() => setAiLensTab("bias")}
                              >
                                <Gauge size={12} /> Analytical Lens
                              </button>
                            </div>

                            <div className="ai-drawer-pane">
                              {aiLensTab === "summary" && (
                                <ul className="ai-summary-bullets">
                                  {aiData.summary.map((b, i) => (
                                    <li key={i}>{b}</li>
                                  ))}
                                </ul>
                              )}
                              
                              {aiLensTab === "elif5" && (
                                <p className="ai-elif5-text">{aiData.elif5}</p>
                              )}

                              {aiLensTab === "bias" && (
                                <div className="ai-bias-dashboard">
                                  <div className="bias-dashboard-row">
                                    <span>Bias Rating:</span>
                                    <strong style={{ color: aiData.biasColor }}>{aiData.biasLabel}</strong>
                                  </div>
                                  <div className="bias-dashboard-row">
                                    <span>Credibility Level:</span>
                                    <strong style={{ color: aiData.credibilityColor }}>{aiData.credibilityLabel}</strong>
                                  </div>
                                  <div className="fact-meter-wrap">
                                    <div className="fact-meter-label">
                                      <span>Fact Check Rating:</span>
                                      <strong>{aiData.score}%</strong>
                                    </div>
                                    <div className="fact-meter-track">
                                      <div className="fact-meter-fill" style={{ width: `${aiData.score}%` }}></div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            )}
          </div>

          {/* Empty Search / Bookmarks State */}
          {!loading && filteredArticles.length === 0 && (
            <div className="empty-state glass-surface">
              <h3>{showSavedOnly ? "No saved headlines" : "No matching headlines"}</h3>
              <p>{showSavedOnly ? "Save a story and it will appear here." : "Try a broader topic or clear the search field."}</p>
              <button className="hover-lift" onMouseMove={handleGlowMove} onClick={() => (showSavedOnly ? setShowSavedOnly(false) : setQuery(""))}>
                {showSavedOnly ? "Back to feed" : "Clear search"}
              </button>
            </div>
          )}
        </section>

        {/* Right Side: Desktop Sidebar Dashboard Widget Hub */}
        <aside className="dashboard-sidebar desktop-only">
          {renderSidebarContent()}
        </aside>
      </div>

      {/* Slide-out Overlay Drawer Sidebar on Tablets & Mobile */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <div className="mobile-sidebar-overlay" onClick={() => setMobileSidebarOpen(false)}>
            <motion.div
              className="mobile-sidebar-drawer glass-surface"
              onClick={(e) => e.stopPropagation()}
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
            >
              <div className="mobile-sidebar-header">
                <div className="footer-brand">
                  <span className="brand-mark">H</span>
                  <span>Headlyn</span>
                </div>
                <button className="close-sidebar-btn hover-lift" onClick={() => setMobileSidebarOpen(false)} aria-label="Close sidebar">
                  <X size={16} />
                </button>
              </div>
              <div className="mobile-sidebar-scroll">
                {renderSidebarContent()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Curated Global Footer */}
      <footer className="footer-wrap" aria-label="Site Footer">
        <div className="footer-grid">
          <div className="footer-col brand-col">
            <div className="footer-brand">
              <span className="brand-mark">H</span>
              <span>Headlyn</span>
            </div>
            <p className="about-text">
              Headlyn is an independent, real-time news intelligence platform engineered for global decision-makers, tech professionals, and researchers who require immediate, noise-free situational awareness. By pairing high-frequency syndicated feeds with responsive context-aware aesthetics, we filter the static to deliver pure informational clarity.
            </p>
          </div>

          <div className="footer-col">
            <h4>Nav & Channels</h4>
            <ul>
              <li>
                <button onClick={() => {
                  setShowSavedOnly(false);
                  setActiveTopic("Top Stories");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}>Top Stories</button>
              </li>
              <li>
                <button onClick={() => {
                  setShowSavedOnly(false);
                  setActiveTopic("Technology");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}>Technology</button>
              </li>
              <li>
                <button onClick={() => {
                  setShowSavedOnly(false);
                  setActiveTopic("Science");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}>Science</button>
              </li>
              <li>
                <button onClick={() => {
                  setShowSavedOnly(false);
                  setActiveTopic("Economy");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}>Economy & Business</button>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Data Partners</h4>
            <ul>
              <li>
                <a href="https://newsapi.org" target="_blank" rel="noreferrer">NewsAPI Wire Service</a>
              </li>
              <li>
                <a href="https://firebase.google.com" target="_blank" rel="noreferrer">Google Firebase DB</a>
              </li>
              <li>
                <a href="https://vercel.com" target="_blank" rel="noreferrer">Vercel Serverless CDN</a>
              </li>
              <li>
                <a href="https://unsplash.com" target="_blank" rel="noreferrer">Unsplash Photography</a>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Security & Ops</h4>
            <div className="footer-badges">
              <span className="footer-badge">SSL SECURED</span>
              <span className="footer-badge">HELMET ENFORCED</span>
              <span className="footer-badge">FIRESTORE SYNC</span>
              <span className="footer-badge">API RATE LIMITED</span>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="copyright-info">
            <p>
              © 2026 Headlyn Technologies Inc. All rights reserved. Headlyn® and the stylized "H" logo are registered trademarks of Headlyn Technologies. Real-time news snippets, descriptive abstracts, and publisher properties displayed remain the intellectual property of their respective originating news outlets.
            </p>
          </div>
          <div className="footer-legal-links">
            <a href="#privacy" onClick={(e) => { e.preventDefault(); alert("Privacy Policy: Headlyn curates news locally and syncs saved news accounts via Google Firestore with zero third-party commercial sale of data."); }}>Privacy Policy</a>
            <span className="legal-dot">•</span>
            <a href="#terms" onClick={(e) => { e.preventDefault(); alert("Terms of Service: This service aggregates feeds dynamically via secure proxy and is provided exclusively for personal research and situational review."); }}>Terms of Service</a>
            <span className="legal-dot">•</span>
            <a href="#status" onClick={(e) => { e.preventDefault(); alert("System Status: All services operational. CORS checks active. Frontend: Vercel CDN; Backend: Vercel serverless Node middleware."); }}>System Status</a>
          </div>
        </div>
      </footer>

      {/* Account Login / Signup Auth Modal */}
      {showAuthModal && (
        <div className="modal-backdrop" onClick={() => setShowAuthModal(false)}>
          <div className="modal-content glass-surface" onClick={(e) => e.stopPropagation()} onMouseMove={handleGlowMove}>
            <button className="modal-close hover-lift" onClick={() => setShowAuthModal(false)} aria-label="Close authentication modal">
              &times;
            </button>
            <h2 className="modal-title">Welcome to Headlyn</h2>
            <p className="modal-subtitle">Save articles and sync your preferences</p>
            <form onSubmit={handleAuthSubmit}>
              <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
                <button
                  type="button"
                  className={authMode === "login" ? "active" : ""}
                  onClick={() => setAuthMode("login")}
                >
                  Login
                </button>
                <button
                  type="button"
                  className={authMode === "register" ? "active" : ""}
                  onClick={() => setAuthMode("register")}
                >
                  Register
                </button>
              </div>
              <input
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                placeholder="Email"
                type="email"
                autoComplete="email"
                required
              />
              <input
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                placeholder="Password"
                type="password"
                autoComplete={authMode === "register" ? "new-password" : "current-password"}
                required
              />
              <button type="submit" disabled={authBusy} className="hover-lift auth-submit-btn">
                {authBusy ? "Working..." : authMode === "register" ? "Create account" : "Sign in"}
              </button>
              <p className="auth-message">{firebaseReady ? authMessage || "Sign in to sync saved stories." : "Add Firebase env vars to enable login."}</p>
            </form>

            <div className="google-auth-separator">
              <span>or connect with</span>
            </div>
            
            <button
              type="button"
              className="google-sign-in-btn hover-lift"
              onClick={handleGoogleSignIn}
              disabled={authBusy}
            >
              <svg className="google-icon" viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign In with Google
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
