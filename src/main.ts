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

/** DATA: display list + redo stack hold Commands */
const displayList: Command[] = [];
const redoStack: Command[] = [];
let currentCommand: Command | null = null;

/** Tool state */
type Tool = { label: "Thin" | "Thick"; thickness: number };
const THIN: Tool = { label: "Thin", thickness: 2 };
const THICK: Tool = { label: "Thick", thickness: 6 };
// default tool
let currentTool: Tool = THIN;

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

function updateToolSelection() {
  thinBtn.classList.toggle("selectedTool", currentTool === THIN);
  thickBtn.classList.toggle("selectedTool", currentTool === THICK);
}

/** RENDER: ask each Command to draw itself */
canvas.addEventListener(
  DRAWING_CHANGED as unknown as string,
  (() => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const cmd of displayList) cmd.display(ctx);
  }) as EventListener,
);

let isDrawing = false;

/** Helpers */
function pointFromEvent(e: MouseEvent): Point {
  return { x: e.offsetX, y: e.offsetY };
}

/** INPUT -> MODEL */
canvas.addEventListener("mousedown", (e: MouseEvent) => {
  isDrawing = true;

  // new action invalidates redo history
  redoStack.length = 0;

  const start = pointFromEvent(e);
  currentCommand = createMarkerLine(start, currentTool.thickness);
  displayList.push(currentCommand);
  notifyDrawingChanged();
});

canvas.addEventListener("mousemove", (e: MouseEvent) => {
  if (!isDrawing || !currentCommand) return;
  currentCommand.drag?.(e.offsetX, e.offsetY);
  notifyDrawingChanged();
});

function endStroke() {
  if (!isDrawing) return;
  isDrawing = false;
  currentCommand = null;
  // last mousemove already redrew
}

canvas.addEventListener("mouseup", endStroke);
canvas.addEventListener("mouseleave", endStroke);

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

/** Tool selection */
thinBtn.addEventListener("click", () => {
  currentTool = THIN;
  updateToolSelection();
});
thickBtn.addEventListener("click", () => {
  currentTool = THICK;
  updateToolSelection();
});

updateToolSelection();
notifyDrawingChanged();
