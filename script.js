// Replace these values with your Supabase project details.
// Use a public anon / publishable key, never a service_role key.
const SUPABASE_URL = "supabase url";
const SUPABASE_ANON_KEY = "supabase anon key";

const form = document.querySelector("#search-form");
const professionInput = document.querySelector("#profession");
const cityInput = document.querySelector("#city");
const searchButton = document.querySelector("#search-button");
const categoryButtons = document.querySelectorAll("[data-category]");
const resultsContainer = document.querySelector("#results");
const resultCount = document.querySelector("#result-count");
const statusMessage = document.querySelector("#status");
const emptyState = document.querySelector("#empty-state");
const mapDialog = document.querySelector("#map-dialog");
const mapPreview = document.querySelector("#map-preview");
const mapOpenLink = document.querySelector("#map-open-link");

let opportunities = [];
let selectedCategory = "all";
let appliedProfession = "";
let appliedCity = cityInput.value;
let isDemo = false;
let loadFailed = false;

// DEMO ONLY: these are fictional opportunities.
// Dates are generated in the future so you can try the app anytime.
function futureDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

const demoOpportunities = [
  {
    id: 1,
    title: "Design Meetup",
    category: "event",
    city: "Skopje",
    description: "Meet local designers and share creative ideas.",
    tags: ["design", "graphic design", "branding"],
    starts_at: futureDate(7),
    expires_at: futureDate(8),
    url: null
  },
  {
    id: 2,
    title: "Graphic Design Internship",
    category: "internship",
    city: "Skopje",
    description: "Practice visual design and build your portfolio.",
    tags: ["design", "graphic design", "branding"],
    starts_at: null,
    expires_at: futureDate(20),
    url: null
  },
  {
    id: 3,
    title: "Figma Workshop",
    category: "workshop",
    city: "Skopje",
    description: "Learn the basics of interfaces and prototyping.",
    tags: ["design", "figma", "ui", "ux"],
    starts_at: futureDate(10),
    expires_at: futureDate(11),
    url: null
  },
  {
    id: 4,
    title: "JavaScript Meetup",
    category: "event",
    city: "Skopje",
    description: "Connect with people interested in web development.",
    tags: ["development", "javascript", "programming"],
    starts_at: futureDate(12),
    expires_at: futureDate(13),
    url: null
  },
  {
    id: 5,
    title: "Social Media Workshop",
    category: "workshop",
    city: "Kavadarci",
    description: "Explore content creation and social media basics.",
    tags: ["marketing", "social media", "content"],
    starts_at: futureDate(9),
    expires_at: futureDate(10),
    url: null
  }
];

// Simple keyword matching, not AI.
// Add more professions and synonyms as your app grows.
const interestGroups = [
  [
    "design", "designer", "graphic", "branding", "figma",
    "ui", "ux", "дизајн", "дизајнер", "графички"
  ],
  [
    "development", "developer", "programming", "programmer",
    "javascript", "coding", "web", "програмер", "програмирање"
  ],
  [
    "marketing", "marketer", "social media", "content",
    "маркетинг", "маркетер"
  ]
];

const cityAliases = {
  "скопје": "skopje",
  "кавадарци": "kavadarci",
  "битола": "bitola",
  "охрид": "ohrid",
  "тетово": "tetovo",
  "штип": "stip",
  "štip": "stip"
};

function normalize(value) {
  return String(value ?? "").toLowerCase().trim();
}

function normalizeCity(value) {
  const city = normalize(value);
  return cityAliases[city] || city;
}

function getSearchTerms(query) {
  const normalized = normalize(query);

  if (!normalized) {
    return [];
  }

  const words = normalized.match(/[\p{L}\p{N}]+/gu) || [];
  const ignoredWords = new Set([
    "i", "im", "m", "am", "a", "an", "the", "and",
    "interested", "in", "looking", "for",
    "јас", "сум", "и", "за", "сакам", "да"
  ]);

  const meaningfulWords = words.filter(
    (word) => !ignoredWords.has(word)
  );

  const terms = new Set([normalized, ...meaningfulWords]);

  for (const group of interestGroups) {
    const matchesGroup = group.some((keyword) => {
      return keyword.includes(" ")
        ? normalized.includes(keyword)
        : meaningfulWords.includes(keyword);
    });

    if (matchesGroup) {
      group.forEach((keyword) => terms.add(keyword));
    }
  }

  return [...terms];
}

function isActive(opportunity) {
  const expiry = Date.parse(opportunity.expires_at);
  return Number.isFinite(expiry) && expiry > Date.now();
}

function formatDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date to be confirmed";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

// Use textContent for database text so it is not interpreted as HTML.
function makeElement(tag, classes, text) {
  const element = document.createElement(tag);
  element.className = classes;

  if (text !== undefined) {
    element.textContent = text;
  }

  return element;
}

// Only allow normal web links.
function getSafeUrl(value) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol === "https:" || url.protocol === "http:") {
      return url.href;
    }
  } catch {
    return null;
  }

  return null;
}

function createOpportunityRow(opportunity) {
  const article = makeElement("article", "py-5");

  const categoryLabels = {
    event: "Event",
    internship: "Internship",
    workshop: "Workshop"
  };

  const category = makeElement(
    "p",
    "text-xs font-semibold uppercase tracking-wide text-blue-600",
    categoryLabels[opportunity.category] || "Opportunity"
  );

  const title = makeElement(
    "h3",
    "mt-1 text-base font-semibold",
    opportunity.title
  );

  const dateLabel = opportunity.category === "internship"
    ? `Apply by ${formatDate(opportunity.expires_at)}`
    : formatDate(opportunity.starts_at);

  const details = makeElement(
    "p",
    "mt-1 text-sm text-slate-500",
    `${opportunity.city} · ${dateLabel}`
  );

  const description = makeElement(
    "p",
    "mt-2 text-sm leading-relaxed text-slate-600",
    opportunity.description || ""
  );

  article.append(category, title, details, description);

  if (opportunity.category === "event") {
    const mapButton = makeElement(
      "button",
      "mt-3 inline-flex min-h-[44px] items-center rounded border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50",
      "View on map"
    );

    mapButton.type = "button";
    mapButton.dataset.mapTitle = opportunity.title || "Event";
    mapButton.dataset.mapCity = opportunity.city || "";
    article.append(mapButton);
  }

  const safeUrl = getSafeUrl(opportunity.url);

  if (safeUrl) {
    const link = makeElement(
      "a",
      "mt-3 inline-flex min-h-[44px] items-center text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline",
      "View details →"
    );

    link.href = safeUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute(
      "aria-label",
      `View details for ${opportunity.title}`
    );

    article.append(link);
  } else {
    article.append(
      makeElement(
        "p",
        "mt-3 text-xs text-slate-400",
        isDemo ? "Demo listing — no application link" : "Link unavailable"
      )
    );
  }

  return article;
}

function updateCategoryButtons() {
  categoryButtons.forEach((button) => {
    const active = button.dataset.category === selectedCategory;

    button.setAttribute("aria-pressed", String(active));

    button.className = active
      ? "rounded-lg border border-blue-600 bg-blue-600 px-3 py-2 text-sm font-medium text-white"
      : "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100";
  });
}

function renderResults() {
  const searchTerms = getSearchTerms(appliedProfession);

  const filtered = opportunities.filter((opportunity) => {
    const matchesCity = !appliedCity ||
      normalizeCity(opportunity.city) === normalizeCity(appliedCity);

    const matchesCategory = selectedCategory === "all" ||
      opportunity.category === selectedCategory;

    const tags = Array.isArray(opportunity.tags)
      ? opportunity.tags.join(" ")
      : String(opportunity.tags || "");

    const searchableText = normalize([
      opportunity.title,
      opportunity.description,
      tags
    ].join(" "));

    const matchesProfession = searchTerms.length === 0 ||
      searchTerms.some((term) => searchableText.includes(term));

    return isActive(opportunity) &&
      matchesCity &&
      matchesCategory &&
      matchesProfession;
  });

  filtered.sort((first, second) => {
    const firstDate = Date.parse(first.starts_at || first.expires_at);
    const secondDate = Date.parse(second.starts_at || second.expires_at);
    return firstDate - secondDate;
  });

  resultsContainer.replaceChildren();

  const fragment = document.createDocumentFragment();

  filtered.forEach((opportunity) => {
    fragment.append(createOpportunityRow(opportunity));
  });

  resultsContainer.append(fragment);

  resultCount.textContent =
    `${filtered.length} ${filtered.length === 1 ? "result" : "results"}`;

  emptyState.hidden = loadFailed || filtered.length > 0;

  if (!loadFailed) {
    statusMessage.textContent = isDemo
      ? "Demo mode: fictional opportunities. Connect Supabase to show real listings."
      : "Showing active opportunities. Search uses keywords and tags.";
  }

  updateCategoryButtons();
}

async function loadOpportunities() {
  searchButton.disabled = true;
  searchButton.textContent = "Loading...";
  resultsContainer.setAttribute("aria-busy", "true");
  statusMessage.textContent = "Loading opportunities...";

  try {
    const configured =
      SUPABASE_URL !== "supabase url" &&
      SUPABASE_ANON_KEY !== "supabase anon key";

    if (!configured) {
      isDemo = true;
      opportunities = demoOpportunities;
    } else {
      if (!window.supabase) {
        throw new Error("The Supabase library could not be loaded.");
      }

      // Different variable name avoids a conflict with the CDN library.
      const supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        }
      );

      const { data, error } = await supabaseClient
        .from("opportunities")
        .select(
          "id,title,category,city,description,tags,starts_at,expires_at,url"
        )
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: true });

      if (error) {
        throw error;
      }

      opportunities = data || [];
    }

    renderResults();
  } catch (error) {
    loadFailed = true;
    opportunities = [];
    resultsContainer.replaceChildren();
    emptyState.hidden = true;
    resultCount.textContent = "";

    statusMessage.textContent =
      "Could not load opportunities. Check your connection, Supabase settings and table permissions, then refresh.";

    console.error("Nearmigo loading error:", error);
  } finally {
    searchButton.disabled = false;
    searchButton.textContent = "Find opportunities";
    resultsContainer.setAttribute("aria-busy", "false");
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  if (loadFailed) {
    return;
  }

  appliedProfession = professionInput.value;
  appliedCity = cityInput.value;

  renderResults();
});

categoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedCategory = button.dataset.category;
    renderResults();
  });
});

resultsContainer.addEventListener("click", (event) => {
  const button = event.target.closest("[data-map-title]");

  if (!button) {
    return;
  }

  const location = [button.dataset.mapTitle, button.dataset.mapCity]
    .filter(Boolean)
    .join(", ");
  const mapsUrl = new URL("https://www.google.com/maps");
  mapsUrl.searchParams.set("q", location);
  mapsUrl.searchParams.set("output", "embed");

  mapPreview.src = mapsUrl.href;
  mapOpenLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
  mapDialog.showModal();
});

document.querySelector("#map-dialog-close").addEventListener("click", () => {
  mapDialog.close();
});

mapDialog.addEventListener("close", () => {
  mapPreview.src = "about:blank";
});

loadOpportunities();

// Hide listings that expire while the page stays open.
setInterval(() => {
  if (!loadFailed && !searchButton.disabled) {
    renderResults();
  }
}, 60000);