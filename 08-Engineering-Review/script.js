(function engineeringReviewPage() {
  const navLinks = Array.from(document.querySelectorAll("#sideNav a"));
  const searchInput = document.getElementById("searchInput");
  const themeToggle = document.getElementById("themeToggle");
  const printButton = document.getElementById("printButton");

  function setActive(hash) {
    navLinks.forEach((link) => {
      link.classList.toggle("active", link.getAttribute("href") === hash);
    });
  }

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      setActive(link.getAttribute("href"));
    });
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || !entry.target.id) {
          return;
        }
        setActive(`#${entry.target.id}`);
      });
    },
    { rootMargin: "-45% 0px -45% 0px", threshold: 0.01 }
  );

  document.querySelectorAll("section, header.hero").forEach((section) => observer.observe(section));

  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();
    navLinks.forEach((link) => {
      const label = link.textContent.toLowerCase();
      link.style.display = !query || label.includes(query) ? "block" : "none";
    });
  });

  const savedTheme = localStorage.getItem("careerTwinEngineeringReviewTheme");
  if (savedTheme) {
    document.body.setAttribute("data-theme", savedTheme);
  }

  themeToggle.addEventListener("click", () => {
    const currentTheme = document.body.getAttribute("data-theme");
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    document.body.setAttribute("data-theme", nextTheme);
    localStorage.setItem("careerTwinEngineeringReviewTheme", nextTheme);
  });

  printButton.addEventListener("click", () => {
    window.print();
  });
})();
