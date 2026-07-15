(function initDocument() {
  var navLinks = Array.prototype.slice.call(document.querySelectorAll("#docNav a"));
  var sections = Array.prototype.slice.call(document.querySelectorAll("main section, main header.hero"));
  var searchInput = document.getElementById("sectionSearch");
  var themeToggle = document.getElementById("themeToggle");
  var printButton = document.getElementById("printButton");

  function setActive(hash) {
    navLinks.forEach(function(link) {
      link.classList.toggle("active", link.getAttribute("href") === hash);
    });
  }

  navLinks.forEach(function(link) {
    link.addEventListener("click", function() {
      setActive(link.getAttribute("href"));
    });
  });

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        var id = entry.target.id;
        if (id) {
          setActive("#" + id);
        }
      }
    });
  }, { rootMargin: "-45% 0px -45% 0px", threshold: 0.01 });

  sections.forEach(function(section) {
    observer.observe(section);
  });

  searchInput.addEventListener("input", function() {
    var value = searchInput.value.trim().toLowerCase();
    navLinks.forEach(function(link) {
      var text = link.textContent.toLowerCase();
      var visible = !value || text.indexOf(value) > -1;
      link.style.display = visible ? "block" : "none";
    });
  });

  var savedTheme = localStorage.getItem("careerTwinSingleTheme");
  if (savedTheme) {
    document.body.setAttribute("data-theme", savedTheme);
  }

  themeToggle.addEventListener("click", function() {
    var current = document.body.getAttribute("data-theme");
    var next = current === "dark" ? "light" : "dark";
    document.body.setAttribute("data-theme", next);
    localStorage.setItem("careerTwinSingleTheme", next);
  });

  printButton.addEventListener("click", function() {
    window.print();
  });
})();
