// ===== Мобильное меню (бургер) =====
const burger = document.getElementById("burger");
const navLinks = document.getElementById("navLinks");

burger.addEventListener("click", () => {
  navLinks.classList.toggle("open");
});

// Закрываем меню после выбора пункта (удобно на телефоне)
navLinks.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => navLinks.classList.remove("open"));
});

// ===== Плавное появление блоков при прокрутке =====
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target); // анимация только один раз
      }
    });
  },
  { threshold: 0.15 }
);

document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

// ===== Форма обратной связи =====
// Пока что она просто показывает уведомление. Чтобы получать настоящие
// письма, можно бесплатно подключить сервисы: Formspree, Getform или Netlify Forms.
const form = document.getElementById("contactForm");

form.addEventListener("submit", (e) => {
  e.preventDefault(); // не даём странице перезагрузиться
  const name = form.name.value.trim() || "Гость";
  alert(`Спасибо, ${name}! Ваше сообщение отправлено.`);
  form.reset();
});
