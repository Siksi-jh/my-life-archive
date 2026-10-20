window.SITE_CONFIG = {
  title: "THE YEARS",
  subtitle: "기록은 쌓이고, 시간은 남는다.",
  startText: "2026 — ongoing"
};

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-site-title]").forEach(el => el.textContent = SITE_CONFIG.title);
  document.querySelectorAll("[data-site-subtitle]").forEach(el => el.textContent = SITE_CONFIG.subtitle);
  document.querySelectorAll("[data-site-start]").forEach(el => el.textContent = SITE_CONFIG.startText);
});
