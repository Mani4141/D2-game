import "./style.css";

interface Point {
  x: number;
  y: number;
}
type Stroke = Point[];

const strokes: Stroke[] = [];
const redoStack: Stroke[] = [];
let currentStroke: Stroke | null = null;

const appTitle = document.createElement("h1");
appTitle.textContent = "D2 Game Demo";
document.body.appendChild(appTitle);

const controls = document.createElement("div");
controls.className = "controls";
document.body.appendChild(controls);

const canvas = document.createElement("canvas");
canvas.width = 256;
canvas.height = 256;
canvas.className = "game-canvas";
document.body.appendChild(canvas);

const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
if (!ctx) throw new Error("Canvas rendering context not found.");

const clearButton = document.createElement("button");
clearButton.textContent = "Clear";
clearButton.className = "btn";
controls.appendChild(clearButton);

const undoButton = document.createElement("button");
undoButton.textContent = "Undo";
undoButton.className = "btn";
controls.appendChild(undoButton);

const redoButton = document.createElement("button");
redoButton.textContent = "Redo";
redoButton.className = "btn";
controls.appendChild(redoButton);

// Custom event name
const DRAWING_CHANGED = "drawing-changed" as const;

/** Fire whenever the drawing model changes */
function notifyDrawingChanged() {
  canvas.dispatchEvent(new Event(DRAWING_CHANGED));
  updateButtonState();
}

/** Enable/disable undo/redo based on stacks */
function updateButtonState() {
  undoButton.disabled = strokes.length === 0;
  redoButton.disabled = redoStack.length === 0;
}

/** Redraw everything from the display list */
canvas.addEventListener(
  DRAWING_CHANGED as unknown as string,
  (() => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#00449f";

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

/** Helpers */
function pointFromEvent(e: MouseEvent): Point {
  return { x: e.offsetX, y: e.offsetY };
}

/** INPUT -> MODEL (record points, then notify) */
canvas.addEventListener("mousedown", (e: MouseEvent) => {
  isDrawing = true;

  // Starting a new user action invalidates redo history
  redoStack.length = 0;

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
  // Last mousemove already notified
}

canvas.addEventListener("mouseup", endStroke);
canvas.addEventListener("mouseleave", endStroke);

/** Clear resets model and redo stack */
clearButton.addEventListener("click", () => {
  strokes.length = 0;
  redoStack.length = 0;
  notifyDrawingChanged();
});

/** Undo: move last stroke to redo stack */
function undo() {
  if (strokes.length === 0) return;
  const popped = strokes.pop()!;
  redoStack.push(popped);
  notifyDrawingChanged();
}

/** Redo: move last redo stroke back to display list */
function redo() {
  if (redoStack.length === 0) return;
  const popped = redoStack.pop()!;
  strokes.push(popped);
  notifyDrawingChanged();
}

undoButton.addEventListener("click", undo);
redoButton.addEventListener("click", redo);

// Initial paint and button state
notifyDrawingChanged();
