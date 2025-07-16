const panicButton = document.getElementById("panicButton");
const panicOverlay = document.getElementById("panicOverlay");
const closePanic = document.getElementById("closePanic");

panicButton.addEventListener("click", () => {
  panicOverlay.classList.add("show");
  panicOverlay.classList.remove("hidden");
});

closePanic.addEventListener("click", () => {
  panicOverlay.classList.remove("show");
  setTimeout(() => panicOverlay.classList.add("hidden"), 300);
});

panicOverlay.addEventListener("click", (e) => {
  if (e.target === panicOverlay) {
    closePanic.click();
  }
});
