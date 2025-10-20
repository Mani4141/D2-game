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

function createMarkerLine(
  start: Point,
  thickness: number,
  color = "#00449f",
): Command {
  const points: Point[] = [start];

  return {
    drag(x: number, y: number) {
      points.push({ x, y });
    },
    display(ctx: CanvasRenderingContext2D) {
      if (points.length === 0) return;
      ctx.save();
      ctx.beginPath();
      ctx.lineWidth = thickness;
      ctx.lineCap = "round";
      ctx.strokeStyle = color;
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        const p = points[i];
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.restore();
    },
  };
}

interface ToolPreview {
  draw(ctx: CanvasRenderingContext2D): void;
  moveTo(x: number, y: number): void;
  setThickness(th: number): void;
}

function createMarkerPreview(
  thickness: number,
  color = "#00449f",
): ToolPreview {
  let pos: Point | null = null;
  let w = thickness;

  return {
    moveTo(x: number, y: number) {
      pos = { x, y };
    },
    setThickness(th: number) {
      w = th;
    },
    draw(ctx: CanvasRenderingContext2D) {
      if (!pos) return;
      // draw a circle the size of the marker tip
      ctx.save();
      ctx.beginPath();
      ctx.lineWidth = 1;
      ctx.strokeStyle = color;
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      const r = Math.max(1, w / 2);
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    },
  };
}

/** DATA: display list + redo stack hold Commands */
const displayList: Command[] = [];
const redoStack: Command[] = [];
let currentCommand: Command | null = null;

/** Tool state */
type Tool = { label: "Thin" | "Thick"; thickness: number };
const THIN: Tool = { label: "Thin", thickness: 2 };
const THICK: Tool = { label: "Thick", thickness: 6 };
let currentTool: Tool = THIN;

/** Preview state (nullable reference) */
let preview: ToolPreview | null = createMarkerPreview(currentTool.thickness);

/** UI */
const appTitle = document.createElement("h1");
appTitle.textContent = "D2 Game Demo";
document.body.appendChild(appTitle);

const controls = document.createElement("div");
controls.className = "controls";
document.body.appendChild(controls);

const toolRow = document.createElement("div");
toolRow.className = "tool-row";
controls.appendChild(toolRow);

const thinBtn = document.createElement("button");
thinBtn.textContent = "Thin";
thinBtn.className = "btn tool";
toolRow.appendChild(thinBtn);

const thickBtn = document.createElement("button");
thickBtn.textContent = "Thick";
thickBtn.className = "btn tool";
toolRow.appendChild(thickBtn);

const actionRow = document.createElement("div");
actionRow.className = "action-row";
controls.appendChild(actionRow);

const clearButton = document.createElement("button");
clearButton.textContent = "Clear";
clearButton.className = "btn";
actionRow.appendChild(clearButton);

const undoButton = document.createElement("button");
undoButton.textContent = "Undo";
undoButton.className = "btn";
actionRow.appendChild(undoButton);

const redoButton = document.createElement("button");
redoButton.textContent = "Redo";
redoButton.className = "btn";
actionRow.appendChild(redoButton);

const canvas = document.createElement("canvas");
canvas.width = 256;
canvas.height = 256;
canvas.className = "game-canvas";
document.body.appendChild(canvas);

const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
if (!ctx) throw new Error("Canvas rendering context not found.");

/** Events */
const DRAWING_CHANGED = "drawing-changed" as const;
const TOOL_MOVED = "tool-moved" as const;

/** Button state updater */
function updateButtonState() {
  undoButton.disabled = displayList.length === 0;
  redoButton.disabled = redoStack.length === 0;
}

function notifyDrawingChanged() {
  canvas.dispatchEvent(new Event(DRAWING_CHANGED));
  updateButtonState();
}
function notifyToolMoved() {
  canvas.dispatchEvent(new Event(TOOL_MOVED));
}

/** Shared renderer for both events */
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // draw committed commands
  for (const cmd of displayList) cmd.display(ctx);
  // draw preview only when not drawing
  if (!isDrawing && preview) preview.draw(ctx);
}

canvas.addEventListener(
  DRAWING_CHANGED as unknown as string,
  (() => render()) as EventListener,
);
canvas.addEventListener(
  TOOL_MOVED as unknown as string,
  (() => render()) as EventListener,
);

let isDrawing = false;

/** Helpers */
function pointFromEvent(e: MouseEvent): Point {
  return { x: e.offsetX, y: e.offsetY };
}

/** INPUT -> MODEL / PREVIEW */
canvas.addEventListener("mousedown", (e: MouseEvent) => {
  isDrawing = true;

  // New action invalidates redo history
  redoStack.length = 0;

  const start = pointFromEvent(e);
  currentCommand = createMarkerLine(start, currentTool.thickness);
  displayList.push(currentCommand);

  // Hide preview while drawing
  notifyDrawingChanged();
});

canvas.addEventListener("mousemove", (e: MouseEvent) => {
  if (isDrawing) {
    if (currentCommand) {
      currentCommand.drag?.(e.offsetX, e.offsetY);
      notifyDrawingChanged();
    }
    return;
  }

  // Not drawing: update preview position and fire tool-moved
  if (!preview) preview = createMarkerPreview(currentTool.thickness);
  preview.setThickness(currentTool.thickness);
  preview.moveTo(e.offsetX, e.offsetY);
  notifyToolMoved();
});

function endStroke() {
  if (!isDrawing) return;
  isDrawing = false;
  currentCommand = null;
  // Next mousemove will update and show preview again
}

canvas.addEventListener("mouseup", endStroke);
canvas.addEventListener("mouseleave", () => {
  // Hide preview when cursor leaves canvas
  preview = null;
  notifyToolMoved();
});

/** Actions */
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

/** Tool selection (also update preview thickness) */
function updateToolSelection() {
  thinBtn.classList.toggle("selectedTool", currentTool === THIN);
  thickBtn.classList.toggle("selectedTool", currentTool === THICK);
}
thinBtn.addEventListener("click", () => {
  currentTool = THIN;
  updateToolSelection();
  if (preview) preview.setThickness(currentTool.thickness);
  notifyToolMoved();
});
thickBtn.addEventListener("click", () => {
  currentTool = THICK;
  updateToolSelection();
  if (preview) preview.setThickness(currentTool.thickness);
  notifyToolMoved();
});

/** Initial paint and UI state */
updateToolSelection();
updateButtonState();
notifyToolMoved();
