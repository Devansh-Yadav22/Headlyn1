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
      .catch(() => setAuthMessage("Saved articles could not be loaded."));
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

  const articles = useMemo(
    () => liveArticles,
    [liveArticles],
  );
  const lead = articles[0] || {
    id: "loading",
    title: "Connecting to live feed...",
    dek: "Please wait while we connect to secure news API systems and gather updates.",
    source: "Headlyn Desk",
    minutes: 3,
    image: "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=80",
  };

  // Automatic Dynamic SEO Meta-Tag and Title Updates
  useEffect(() => {
    // 1. Dynamic Title based on Active Section and Queries
    let seoTitle = "Headlyn";
    if (query.trim()) {
      seoTitle = `Search: "${query.trim()}" — Headlyn`;
    } else if (activeTopic && activeTopic !== "Top Stories") {
      seoTitle = `${activeTopic} — Headlyn`;
    } else if (showSavedOnly) {
      seoTitle = "Saved — Headlyn";
    }
    document.title = seoTitle;

    // 2. Dynamic Curated Description
    let descriptionText = "Get sharp, visually stunning, and highly curated news briefings across World, India, Technology, Economy, Science, and Culture on Headlyn.";
    if (lead && lead.title && lead.id !== "loading") {
      descriptionText = `Latest in ${activeTopic}: ${lead.title}. ${lead.dek}`;
    }

    // Helper utility to safely create/update meta attributes
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

    // 3. Open Graph Social Media Preview Attributes
    updateMetaTag("og:title", seoTitle, true);
    updateMetaTag("og:description", descriptionText, true);
    if (lead && lead.image) {
      updateMetaTag("og:image", lead.image, true);
    }
    updateMetaTag("og:type", "website", true);
    updateMetaTag("og:url", window.location.href, true);

    // 4. Set Canonical Link
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
      className={`${compact ? "app compact" : "app"} ${theme === "light" ? "light-theme" : ""}`}
      style={{
        "--theme-accent": activeTheme.accent,
        "--theme-glow": activeTheme.glow,
        "--theme-ink": activeTheme.ink,
      }}
    >
      <nav className={`topbar glass-surface ${scrolled ? "scrolled" : ""}`} aria-label="Primary navigation" onMouseMove={handleGlowMove}>
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

        <div className="topbar-actions">
          <button className="theme-toggle-btn hover-lift" onMouseMove={handleGlowMove} onClick={() => setTheme((theme) => (theme === "dark" ? "light" : "dark"))} aria-label="Toggle light and dark themes">
            {theme === "dark" ? "☀" : "🌙"}
          </button>
          <button className="icon-button hover-lift" onMouseMove={handleGlowMove} onClick={() => setCompact((value) => !value)} aria-label="Toggle compact layout">
            {compact ? "Grid" : "List"}
          </button>
        </div>
      </nav>

      <section className="hero-section">
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
        )}

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
              <>
                <span className="panel-kicker">Account</span>
                <strong>Personalize</strong>
                <p>Sign in to sync your saved stories and custom feed.</p>
                <button
                  className="hover-lift auth-trigger-btn"
                  onMouseMove={handleGlowMove}
                  onClick={() => {
                    setShowAuthModal(true);
                    setAuthMessage("");
                  }}
                >
                  Sign In / Sign Up
                </button>
              </>
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
            filteredArticles.map((article) => {
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
            })
          )}
        </div>

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
              <button type="submit" disabled={authBusy} className="hover-lift">
                {authBusy ? "Working..." : authMode === "register" ? "Create account" : "Sign in"}
              </button>
              <p className="auth-message">{firebaseReady ? authMessage || "Sign in to sync saved stories." : "Add Firebase env vars to enable login."}</p>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
