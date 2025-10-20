import "./style.css";

interface DisplayCommand {
  display(ctx: CanvasRenderingContext2D): void;
}
interface Draggable {
  drag(x: number, y: number): void;
}
type Command = DisplayCommand & Partial<Draggable>;

interface Point {
  x: number;
  y: number;
}

function createMarkerLine(start: Point): Command {
  const points: Point[] = [start];

  return {
    drag(x: number, y: number) {
      points.push({ x, y });
    },
    display(ctx: CanvasRenderingContext2D) {
      if (points.length === 0) return;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        const p = points[i];
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    },
  };
}

const displayList: Command[] = [];
const redoStack: Command[] = [];
let currentCommand: Command | null = null;

/** UI */
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

/** Event + wiring */
const DRAWING_CHANGED = "drawing-changed" as const;

function notifyDrawingChanged() {
  canvas.dispatchEvent(new Event(DRAWING_CHANGED));
  updateButtonState();
}

function updateButtonState() {
  undoButton.disabled = displayList.length === 0;
  redoButton.disabled = redoStack.length === 0;
}

/** RENDER: ask each Command to draw itself */
canvas.addEventListener(
  DRAWING_CHANGED as unknown as string,
  (() => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Global style (individual commands could set their own if needed)
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#00449f";

    for (const cmd of displayList) {
      cmd.display(ctx);
    }
  }) as EventListener,
);

let isDrawing = false;

/** Helpers */
function pointFromEvent(e: MouseEvent): Point {
  return { x: e.offsetX, y: e.offsetY };
}

canvas.addEventListener("mousedown", (e: MouseEvent) => {
  isDrawing = true;

  // New action invalidates redo history
  redoStack.length = 0;

  const start = pointFromEvent(e);
  currentCommand = createMarkerLine(start);
  displayList.push(currentCommand);
  notifyDrawingChanged();
});

canvas.addEventListener("mousemove", (e: MouseEvent) => {
  if (!isDrawing || !currentCommand) return;
  // If this command supports dragging, extend it
  currentCommand.drag?.(e.offsetX, e.offsetY);
  notifyDrawingChanged();
});

function endStroke() {
  if (!isDrawing) return;
  isDrawing = false;
  currentCommand = null;
  // Last mousemove already triggered a redraw
}

canvas.addEventListener("mouseup", endStroke);
canvas.addEventListener("mouseleave", endStroke);

/** Clear / Undo / Redo operate on Commands now */
clearButton.addEventListener("click", () => {
  displayList.length = 0;
  redoStack.length = 0;
  notifyDrawingChanged();
});

function undo() {
  if (displayList.length === 0) return;
  const popped = displayList.pop()!;
  redoStack.push(popped);
  notifyDrawingChanged();
}

function redo() {
  if (redoStack.length === 0) return;
  const popped = redoStack.pop()!;
  displayList.push(popped);
  notifyDrawingChanged();
}

undoButton.addEventListener("click", undo);
redoButton.addEventListener("click", redo);

/** Initial paint and button state */
notifyDrawingChanged();
