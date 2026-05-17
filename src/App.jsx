import { useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { deleteDoc, doc, getDocs, serverTimestamp, setDoc, collection } from "firebase/firestore";
import "./App.css";
import { auth, db, firebaseReady } from "./firebase";

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

const seedArticles = [
  {
    id: "grid-ai-energy",
    title: "Grid planners race to keep up with AI-era power demand",
    dek: "Utilities are fast-tracking transmission upgrades as data centers, factories, and electric fleets compete for reliable capacity.",
    source: "Signal Desk",
    topic: "Technology",
    region: "World",
    minutes: 5,
    trend: "+18%",
    image: "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "india-monsoon-cities",
    title: "Indian cities prepare flood response rooms before monsoon peak",
    dek: "Municipal teams are linking weather alerts, drainage maps, and emergency dispatch into shared dashboards.",
    source: "Civic Wire",
    topic: "India",
    region: "India",
    minutes: 4,
    trend: "+9%",
    image: "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "markets-rate-watch",
    title: "Markets drift as investors wait for the next inflation print",
    dek: "Bond yields held steady while traders looked for signals on consumer demand, wages, and central-bank timing.",
    source: "Market Loop",
    topic: "Economy",
    region: "US",
    minutes: 3,
    trend: "-2%",
    image: "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "ocean-heat-study",
    title: "New ocean heat study sharpens forecasts for coastal risk",
    dek: "Researchers say better measurements of upper-ocean warming could improve storm intensity projections.",
    source: "Field Notes",
    topic: "Science",
    region: "World",
    minutes: 6,
    trend: "+12%",
    image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "streaming-local-sports",
    title: "Streaming platforms court fans with local sports bundles",
    dek: "New packages are designed around city loyalties, flexible pricing, and shorter highlight-first broadcasts.",
    source: "Culture Beat",
    topic: "Culture",
    region: "US",
    minutes: 4,
    trend: "+6%",
    image: "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "chip-supply-map",
    title: "Chip suppliers redraw factory maps around resilient logistics",
    dek: "Executives are prioritizing ports, talent pools, and water security as much as incentives in new site searches.",
    source: "Supply Brief",
    topic: "Technology",
    region: "World",
    minutes: 7,
    trend: "+15%",
    image: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "health-clinics-ai",
    title: "Clinics test AI note tools as doctors push for guardrails",
    dek: "Pilot programs show time savings, but medical groups want clearer audits and patient disclosure standards.",
    source: "Health Ledger",
    topic: "Health",
    region: "World",
    minutes: 5,
    trend: "+11%",
    image: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "startup-credit",
    title: "Startups turn to revenue financing as venture rounds take longer",
    dek: "Founders are blending smaller equity raises with credit products tied to recurring revenue and customer invoices.",
    source: "Founder Daily",
    topic: "Economy",
    region: "World",
    minutes: 4,
    trend: "+4%",
    image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=80",
  },
];

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
  const activeTheme = categoryThemes[activeTopic] || categoryThemes["Top Stories"];

  useEffect(() => {
    if (!auth) return undefined;

    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthMessage("");
    });
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
      .catch(() => setAuthMessage("Saved articles could not be loaded."));
  }, [user]);

  useEffect(() => {
    let ignore = false;
    const params = new URLSearchParams({
      country: activeTheme.country,
      category: activeTheme.apiCategory,
    });

    if (activeTheme.q) params.set("q", activeTheme.q);

    fetch(`/api/news?${params.toString()}`)
      .then((response) => {
        if (!response.ok) throw new Error("Backend unavailable");
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
      });

    return () => {
      ignore = true;
    };
  }, [activeTopic, activeTheme.apiCategory, activeTheme.country, activeTheme.q]);

  const articles = useMemo(
    () => (liveArticles.length > 0 ? [...liveArticles, ...seedArticles] : seedArticles),
    [liveArticles],
  );
  const lead = articles[0];

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
      setAuthMessage("Saved article sync failed. Your local state is still updated.");
    }
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    if (!auth) {
      setAuthMessage("Add Firebase env vars to enable authentication.");
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

  return (
    <main
      className={compact ? "app compact" : "app"}
      style={{
        "--theme-accent": activeTheme.accent,
        "--theme-glow": activeTheme.glow,
        "--theme-ink": activeTheme.ink,
      }}
    >
      <nav className="topbar glass-surface" aria-label="Primary navigation" onMouseMove={handleGlowMove}>
        <button className="brand hover-lift" onMouseMove={handleGlowMove} onClick={() => setActiveTopic("Top Stories")} aria-label="Go to top stories">
          <span className="brand-mark">H</span>
          <span>Headlyn</span>
        </button>

        <div className="search-wrap hover-lift" onMouseMove={handleGlowMove}>
          <span aria-hidden="true">Search</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Topics, sources, regions"
            aria-label="Search news"
          />
        </div>

        <button className="icon-button hover-lift" onMouseMove={handleGlowMove} onClick={() => setCompact((value) => !value)} aria-label="Toggle compact layout">
          {compact ? "Grid" : "List"}
        </button>
      </nav>

      <section className="hero-section">
        <article className="lead-story glass-surface hover-lift" onMouseMove={handleGlowMove}>
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
                {saved.has(lead.id) ? "Saved" : "Save lead"}
              </button>
              {lead.url ? (
                <a className="hover-lift" onMouseMove={handleGlowMove} href={lead.url} target="_blank" rel="noreferrer">
                  Open source
                </a>
              ) : (
                <span>{lead.minutes} min briefing</span>
              )}
            </div>
          </div>
        </article>

        <aside className="briefing-panel" aria-label="Morning briefing">
          <div className="auth-card glass-surface hover-lift" onMouseMove={handleGlowMove}>
            {user ? (
              <>
                <span className="panel-kicker">Account</span>
                <strong>{user.email?.split("@")[0]}</strong>
                <p>{user.email}</p>
                <button className="hover-lift" onMouseMove={handleGlowMove} onClick={handleSignOut}>Sign out</button>
              </>
            ) : (
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
                />
                <input
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  placeholder="Password"
                  type="password"
                  autoComplete={authMode === "register" ? "new-password" : "current-password"}
                />
                <button type="submit" disabled={authBusy}>
                  {authBusy ? "Working..." : authMode === "register" ? "Create account" : "Sign in"}
                </button>
                <p>{firebaseReady ? authMessage || "Sign in to sync saved stories." : "Add Firebase env vars to enable login."}</p>
              </form>
            )}
          </div>
          <div className="glass-surface hover-lift" onMouseMove={handleGlowMove}>
            <span className="panel-kicker">Today</span>
            <strong>{filteredArticles.length}</strong>
            <p>{showSavedOnly ? "saved stories" : "stories matched"}</p>
          </div>
          <button
            className={showSavedOnly ? "briefing-button active glass-surface hover-lift" : "briefing-button glass-surface hover-lift"}
            onMouseMove={handleGlowMove}
            onClick={() => setShowSavedOnly((value) => !value)}
          >
            <span className="panel-kicker">Saved</span>
            <strong>{saved.size}</strong>
            <p>{showSavedOnly ? "showing saved" : "for later"}</p>
          </button>
        </aside>
      </section>

      <section className="topic-strip" aria-label="Topics">
        {topics.map((topic) => {
          const theme = categoryThemes[topic] || categoryThemes["Top Stories"];

          return (
            <button
              key={topic}
              className={topic === activeTopic ? "active hover-lift" : "hover-lift"}
              style={{ "--item-glow": theme.glow, "--item-accent": theme.accent }}
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

      <section className="content-shell">
        <div className="section-heading">
          <div>
            <span>Edition</span>
            <h2>{showSavedOnly ? "Saved" : activeTopic}</h2>
          </div>
          <p>{query ? `Filtered by "${query}"` : "Sharp summaries for fast scanning."}</p>
        </div>

        <div className="news-grid">
          {filteredArticles.map((article) => {
            const theme = themeForArticle(article.topic);

            return (
              <article
                className={article.url ? "story-card clickable-card glass-surface hover-lift" : "story-card glass-surface hover-lift"}
                key={article.id}
                onMouseMove={handleGlowMove}
                onClick={() => {
                  if (article.url) window.open(article.url, "_blank", "noopener,noreferrer");
                }}
                role={article.url ? "link" : undefined}
                tabIndex={article.url ? 0 : undefined}
                onKeyDown={(event) => {
                  if (article.url && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    window.open(article.url, "_blank", "noopener,noreferrer");
                  }
                }}
                style={{
                  "--item-accent": theme.accent,
                  "--item-glow": theme.glow,
                  "--item-ink": theme.ink,
                }}
              >
                <img src={article.image} alt="" />
                <div className="story-body">
                  <div className="story-meta">
                    <span>{article.topic}</span>
                    <span>{article.minutes} min</span>
                  </div>
                  <h3>{article.title}</h3>
                  <p>{article.dek}</p>
                  <div className="story-footer">
                    <span>{article.source}</span>
                    <button
                      className="hover-lift"
                      onMouseMove={handleGlowMove}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleSaved(article);
                      }}
                      aria-label={`Save ${article.title}`}
                    >
                      {saved.has(article.id) ? "Saved" : "Save"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {filteredArticles.length === 0 && (
          <div className="empty-state glass-surface">
            <h3>{showSavedOnly ? "No saved headlines" : "No matching headlines"}</h3>
            <p>{showSavedOnly ? "Save a story and it will appear here." : "Try a broader topic or clear the search field."}</p>
            <button className="hover-lift" onMouseMove={handleGlowMove} onClick={() => (showSavedOnly ? setShowSavedOnly(false) : setQuery(""))}>
              {showSavedOnly ? "Back to feed" : "Clear search"}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
