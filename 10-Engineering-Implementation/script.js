(function implementationDocs() {
  const docLinks = Array.from(document.querySelectorAll(".doc-nav a"));
  const sectionLinks = Array.from(document.querySelectorAll(".section-nav a"));
  const searchInput = document.getElementById("searchInput");
  const themeToggle = document.getElementById("themeToggle");
  const printButton = document.getElementById("printButton");

  function setActiveDocLink() {
    const current = window.location.pathname.split("/").pop();
    docLinks.forEach((link) => {
      const href = link.getAttribute("href");
      link.classList.toggle("active", href === current);
    });
  }

  function setActiveSection(hash) {
    sectionLinks.forEach((link) => {
      link.classList.toggle("active", link.getAttribute("href") === hash);
    });
  }

  sectionLinks.forEach((link) => {
    link.addEventListener("click", () => setActiveSection(link.getAttribute("href")));
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || !entry.target.id) {
          return;
        }
        setActiveSection(`#${entry.target.id}`);
      });
    },
    { rootMargin: "-45% 0px -45% 0px", threshold: 0.01 }
  );

  document.querySelectorAll("section, header.hero").forEach((el) => observer.observe(el));

  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();
    [...docLinks, ...sectionLinks].forEach((link) => {
      const label = link.textContent.toLowerCase();
      link.style.display = !query || label.includes(query) ? "block" : "none";
    });
  });

  const savedTheme = localStorage.getItem("careerTwinImplementationDocsTheme");
  if (savedTheme) {
    document.body.setAttribute("data-theme", savedTheme);
  }

  themeToggle.addEventListener("click", () => {
    const currentTheme = document.body.getAttribute("data-theme");
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    document.body.setAttribute("data-theme", nextTheme);
    localStorage.setItem("careerTwinImplementationDocsTheme", nextTheme);
  });

  printButton.addEventListener("click", () => window.print());
  setActiveDocLink();
})();
