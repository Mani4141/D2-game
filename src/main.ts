import "./style.css";

interface Point {
  x: number;
  y: number;
}
type Stroke = Point[];

const strokes: Stroke[] = [];
let currentStroke: Stroke | null = null;

const appTitle = document.createElement("h1");
appTitle.textContent = "D2 Game Demo";
document.body.appendChild(appTitle);

const canvas = document.createElement("canvas");
canvas.width = 256;
canvas.height = 256;
canvas.className = "game-canvas";
document.body.appendChild(canvas);

const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
if (!ctx) throw new Error("Canvas rendering context not found.");

const clearButton = document.createElement("button");
clearButton.textContent = "Clear Canvas";
clearButton.className = "clear-button";
document.body.appendChild(clearButton);

const DRAWING_CHANGED = "drawing-changed" as const;

function notifyDrawingChanged() {
  canvas.dispatchEvent(new Event(DRAWING_CHANGED));
}

canvas.addEventListener(
  DRAWING_CHANGED as unknown as string,
  (() => {
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Style
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#00449f";

    // Redraw all strokes
    for (const stroke of strokes) {
      if (stroke.length === 0) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        const p = stroke[i];
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
  }) as EventListener,
);

let isDrawing = false;

//Helpers

function pointFromEvent(e: MouseEvent): Point {
  return { x: e.offsetX, y: e.offsetY };
}

canvas.addEventListener("mousedown", (e: MouseEvent) => {
  isDrawing = true;
  currentStroke = [];
  strokes.push(currentStroke);
  currentStroke.push(pointFromEvent(e));
  notifyDrawingChanged();
});

canvas.addEventListener("mousemove", (e: MouseEvent) => {
  if (!isDrawing || !currentStroke) return;
  currentStroke.push(pointFromEvent(e));
  notifyDrawingChanged();
});

function endStroke() {
  if (!isDrawing) return;
  isDrawing = false;
  currentStroke = null;
}

canvas.addEventListener("mouseup", endStroke);
canvas.addEventListener("mouseleave", endStroke);

clearButton.addEventListener("click", () => {
  strokes.length = 0; // reset in place
  notifyDrawingChanged();
});

// Initial paint
notifyDrawingChanged();
