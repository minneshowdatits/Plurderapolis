// Hamburger toggle
document.querySelector(".hamburger").addEventListener("click", () => {
  document.querySelector(".nav-menu").classList.toggle("show");
});

// Search bar with auto-suggest
const pages = [
  { name: "Home", url: "index.html" },
  { name: "Safety", url: "safety.html" },
  { name: "Drug Info", url: "drugs.html" },
  { name: "Consent", url: "consent.html" },
  { name: "Local Scene", url: "localscene.html" },
  { name: "Extras", url: "extras.html" },
  { name: "Bad Trip Mode", url: "badtrip.html" },
  { name: "Polydrug Tool", url: "polydrug.html" },
  { name: "MN Resources", url: "mnresources.html" },
  { name: "Raver Health", url: "health.html" },
  { name: "Sober Ravers", url: "sober.html" },
  { name: "Panic / Emergency", url: "panic.html" }
];
const input = document.getElementById("searchInput");
const suggestions = document.getElementById("suggestions");

input.addEventListener("input", () => {
  const query = input.value.toLowerCase();
  suggestions.innerHTML = "";
  if(query){
    const results = pages.filter(p => p.name.toLowerCase().includes(query));
    results.forEach(p => {
      const li = document.createElement("li");
      li.textContent = p.name;
      li.addEventListener("click", () => { window.location.href = p.url; });
      suggestions.appendChild(li);
    });
  }
});
