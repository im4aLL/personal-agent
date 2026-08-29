const THEME_STORAGE_KEY = "personal-agent:theme";
const TYPED_COMMANDS = [
  "/agent writing-partner",
  "/skill no-emojis",
  "/instructions concise-format",
  "/agent daily-driver",
];
const TYPE_MS = 55;
const ERASE_MS = 26;
const HOLD_MS = 1700;
const GAP_MS = 420;

const root = document.documentElement;
const themeToggle = document.querySelector("[data-theme-toggle]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const nav = document.querySelector("[data-nav]");
const typed = document.querySelector("[data-typed]");
const year = document.querySelector("[data-year]");

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readStoredTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    return;
  }
}

function applyTheme(theme) {
  root.dataset.theme = theme;

  if (themeToggle) {
    themeToggle.setAttribute("aria-pressed", String(theme === "light"));
  }
}

function initTheme() {
  const stored = readStoredTheme();

  applyTheme(stored === "light" ? "light" : "dark");

  if (!themeToggle) {
    return;
  }

  themeToggle.addEventListener("click", () => {
    const next = root.dataset.theme === "light" ? "dark" : "light";

    applyTheme(next);
    storeTheme(next);
  });
}

function closeMenu() {
  if (!nav || !menuToggle) {
    return;
  }

  nav.classList.remove("nav--open");
  menuToggle.classList.remove("menu-toggle--open");
  menuToggle.setAttribute("aria-expanded", "false");
}

function initMenu() {
  if (!menuToggle || !nav) {
    return;
  }

  menuToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("nav--open");

    menuToggle.classList.toggle("menu-toggle--open", isOpen);
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  nav.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a")) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });
}

async function typeCommand(command) {
  for (let i = 1; i <= command.length; i += 1) {
    typed.textContent = command.slice(0, i);
    await sleep(TYPE_MS);
  }

  await sleep(HOLD_MS);

  for (let i = command.length; i >= 0; i -= 1) {
    typed.textContent = command.slice(0, i);
    await sleep(ERASE_MS);
  }
}

async function initTyping() {
  if (!typed) {
    return;
  }

  if (prefersReducedMotion) {
    typed.textContent = TYPED_COMMANDS[0];
    return;
  }

  let index = 0;

  while (true) {
    await typeCommand(TYPED_COMMANDS[index % TYPED_COMMANDS.length]);
    index += 1;
    await sleep(GAP_MS);
  }
}

function initReveal() {
  const revealElements = document.querySelectorAll(".reveal");

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    revealElements.forEach((element) => element.classList.add("reveal--visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue;
        }

        entry.target.classList.add("reveal--visible");
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -48px 0px" },
  );

  revealElements.forEach((element) => observer.observe(element));
}

function initPreview() {
  const tabs = document.querySelectorAll("[data-preview-tab]");
  const panels = document.querySelectorAll("[data-preview-panel]");

  if (tabs.length === 0 || panels.length === 0) {
    return;
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("data-preview-tab");

      tabs.forEach((other) => {
        const isActive = other === tab;

        other.classList.toggle("preview__tab--active", isActive);
        other.setAttribute("aria-pressed", String(isActive));
      });

      panels.forEach((panel) => {
        const isActive = panel.getAttribute("data-preview-panel") === target;

        panel.classList.toggle("preview__image--active", isActive);
        panel.toggleAttribute("hidden", !isActive);
      });
    });
  });
}

function initYear() {
  if (!year) {
    return;
  }

  year.textContent = String(new Date().getFullYear());
}

initTheme();
initMenu();
initReveal();
initPreview();
initYear();
initTyping();
