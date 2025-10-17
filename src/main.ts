import "./style.css";

const appTitle = document.createElement("h1");
appTitle.textContent = "D2 Game Demo";
document.body.appendChild(appTitle);

const canvas = document.createElement("canvas");
canvas.width = 256;
canvas.height = 256;
canvas.className = "game-canvas";
document.body.appendChild(canvas);

const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Canvas rendering context not found.");

//clear button
const clearButton = document.createElement("button");
clearButton.textContent = "Clear Canvas";
clearButton.className = "clear-button";
document.body.appendChild(clearButton);

let isDrawing = false;

canvas.addEventListener("mousedown", (e) => {
  isDrawing = true;
  ctx.beginPath();
  ctx.moveTo(e.offsetX, e.offsetY);
});

canvas.addEventListener("mousemove", (e) => {
  if (!isDrawing) return;
  ctx.lineTo(e.offsetX, e.offsetY);
  ctx.strokeStyle = "#00449f";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.stroke();
});

canvas.addEventListener("mouseup", () => {
  isDrawing = false;
});

canvas.addEventListener("mouseleave", () => {
  isDrawing = false;
});

clearButton.addEventListener("click", () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});
