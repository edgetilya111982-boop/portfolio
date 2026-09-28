// ===== Бургер-меню =====
const burger = document.getElementById("burger");
const navLinks = document.getElementById("navLinks");

if (burger && navLinks) {
  burger.addEventListener("click", () => {
    navLinks.classList.toggle("open");
    burger.textContent = navLinks.classList.contains("open") ? "✕" : "☰";
  });
  navLinks.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
      navLinks.classList.remove("open");
      burger.textContent = "☰";
    })
  );
}

// ===== Появление блоков при прокрутке =====
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
        observer.unobserve(e.target);
      }
    });
  },
  { threshold: 0.15 }
);
document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

// ===== Счётчики статистики =====
function animateCount(el) {
  const target = parseInt(el.dataset.count, 10);
  const suffix = el.dataset.suffix || "";
  const duration = 1400;
  const start = performance.now();
  function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
const countObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        animateCount(e.target);
        countObserver.unobserve(e.target);
      }
    });
  },
  { threshold: 0.6 }
);
document.querySelectorAll(".num[data-count]").forEach((el) => countObserver.observe(el));

// ===== Слайдер кейсов =====
const track = document.getElementById("casesTrack");
const prevBtn = document.getElementById("prevCase");
const nextBtn = document.getElementById("nextCase");

function scrollCases(dir) {
  if (!track) return;
  const card = track.querySelector(".case");
  const step = card ? card.offsetWidth + 22 : 320;
  track.scrollBy({ left: dir * step, behavior: "smooth" });
}
if (prevBtn) prevBtn.addEventListener("click", () => scrollCases(-1));
if (nextBtn) nextBtn.addEventListener("click", () => scrollCases(1));

// ===== Форма контактов (демо) =====
const form = document.getElementById("contactForm");
const note = document.getElementById("formNote");
if (form) {
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const name = document.getElementById("nameInput").value.trim();
    if (note) note.textContent = `Спасибо, ${name}! Сообщение отправлено (демо).`;
    form.reset();
  });
}
