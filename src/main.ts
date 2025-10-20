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

/* ========= Marker (freehand line) ========= */
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

/* ========= Sticker (single emoji you can reposition) ========= */
function createStickerCommand(emoji: string, start: Point, size = 24): Command {
  let pos: Point = { ...start };
  const fontSize = Math.max(12, size); // px

  return {
    drag(x: number, y: number) {
      // Reposition sticker instead of leaving a trail
      pos = { x, y };
    },
    display(ctx: CanvasRenderingContext2D) {
      ctx.save();
      ctx.font =
        `${fontSize}px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(emoji, pos.x, pos.y);
      ctx.restore();
    },
  };
}

/* ========= PREVIEW OBJECTS ========= */
interface ToolPreview {
  draw(ctx: CanvasRenderingContext2D): void;
  moveTo(x: number, y: number): void;
}

/** Circle preview for marker thickness */
function createMarkerPreview(
  thickness: number,
  color = "#00449f",
): ToolPreview {
  let pos: Point | null = null;
  const r = Math.max(1, thickness / 2);

  return {
    moveTo(x: number, y: number) {
      pos = { x, y };
    },
    draw(ctx: CanvasRenderingContext2D) {
      if (!pos) return;
      ctx.save();
      ctx.beginPath();
      ctx.lineWidth = 1;
      ctx.strokeStyle = color;
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    },
  };
}

/** Preview that shows the emoji ghosted at the cursor */
function createStickerPreview(emoji: string, size = 24): ToolPreview {
  let pos: Point | null = null;
  const fontSize = Math.max(12, size);

  return {
    moveTo(x: number, y: number) {
      pos = { x, y };
    },
    draw(ctx: CanvasRenderingContext2D) {
      if (!pos) return;
      ctx.save();
      ctx.globalAlpha = 0.65;
      ctx.font =
        `${fontSize}px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(emoji, pos.x, pos.y);
      ctx.restore();
    },
  };
}

/* ========= DATA ========= */
const displayList: Command[] = [];
const redoStack: Command[] = [];
let currentCommand: Command | null = null;

/* ========= TOOLS ========= */
type MarkerTool = {
  kind: "marker";
  label: "Thin" | "Thick";
  thickness: number;
};
type StickerTool = {
  kind: "sticker";
  label: string;
  emoji: string;
  size: number;
};
type Tool = MarkerTool | StickerTool;

const THIN: MarkerTool = { kind: "marker", label: "Thin", thickness: 2 };
const THICK: MarkerTool = { kind: "marker", label: "Thick", thickness: 6 };

// stickers
const STAR: StickerTool = {
  kind: "sticker",
  label: "⭐",
  emoji: "⭐",
  size: 28,
};
const HEART: StickerTool = {
  kind: "sticker",
  label: "❤️",
  emoji: "❤️",
  size: 28,
};
const FIRE: StickerTool = {
  kind: "sticker",
  label: "🔥",
  emoji: "🔥",
  size: 28,
};

let currentTool: Tool = THIN;

/* ========= PREVIEW ========= */
let preview: ToolPreview | null = makePreviewForTool(currentTool);
function makePreviewForTool(tool: Tool): ToolPreview {
  return tool.kind === "marker"
    ? createMarkerPreview(tool.thickness)
    : createStickerPreview(tool.emoji, tool.size);
}

/* ========= UI ========= */
const appTitle = document.createElement("h1");
appTitle.textContent = "D2 Game Demo";
document.body.appendChild(appTitle);

const controls = document.createElement("div");
controls.className = "controls";
document.body.appendChild(controls);

/* Tool rows */
const toolRow = document.createElement("div");
toolRow.className = "tool-row";
controls.appendChild(toolRow);

/* Marker buttons */
const thinBtn = document.createElement("button");
thinBtn.textContent = "Thin";
thinBtn.className = "btn tool";
toolRow.appendChild(thinBtn);

const thickBtn = document.createElement("button");
thickBtn.textContent = "Thick";
thickBtn.className = "btn tool";
toolRow.appendChild(thickBtn);

/* Sticker buttons */
const stickerRow = document.createElement("div");
stickerRow.className = "tool-row";
controls.appendChild(stickerRow);

const starBtn = document.createElement("button");
starBtn.textContent = STAR.label;
starBtn.className = "btn tool";
stickerRow.appendChild(starBtn);

const heartBtn = document.createElement("button");
heartBtn.textContent = HEART.label;
heartBtn.className = "btn tool";
stickerRow.appendChild(heartBtn);

const fireBtn = document.createElement("button");
fireBtn.textContent = FIRE.label;
fireBtn.className = "btn tool";
stickerRow.appendChild(fireBtn);

/* Action row */
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

/* Canvas */
const canvas = document.createElement("canvas");
canvas.width = 256;
canvas.height = 256;
canvas.className = "game-canvas";
document.body.appendChild(canvas);

const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
if (!ctx) throw new Error("Canvas rendering context not found.");

/* ========= Events ========= */
const DRAWING_CHANGED = "drawing-changed" as const;
const TOOL_MOVED = "tool-moved" as const;

/* Button state updater */
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

/* Shared renderer for both events */
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

/* ========= Input ========= */
let isDrawing = false;

function pointFromEvent(e: MouseEvent): Point {
  return { x: e.offsetX, y: e.offsetY };
}

canvas.addEventListener("mousedown", (e: MouseEvent) => {
  isDrawing = true;
  // New action invalidates redo history
  redoStack.length = 0;

  const start = pointFromEvent(e);

  if (currentTool.kind === "marker") {
    currentCommand = createMarkerLine(start, currentTool.thickness);
  } else {
    // Sticker: create placed sticker at cursor
    currentCommand = createStickerCommand(
      currentTool.emoji,
      start,
      currentTool.size,
    );
  }

  displayList.push(currentCommand);
  notifyDrawingChanged(); // hide preview and show new command
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
  if (!preview) preview = makePreviewForTool(currentTool);
  preview.moveTo(e.offsetX, e.offsetY);
  notifyToolMoved();
});

function endStroke() {
  if (!isDrawing) return;
  isDrawing = false;
  currentCommand = null;
  // Next mousemove will rebuild & show preview
}

canvas.addEventListener("mouseup", endStroke);
canvas.addEventListener("mouseleave", () => {
  // Hide preview when cursor leaves canvas
  preview = null;
  notifyToolMoved();
});

/* ========= Actions ========= */
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

/* ========= Tool selection ========= */
function updateToolSelection() {
  const isThin = currentTool.kind === "marker" && currentTool === THIN;
  const isThick = currentTool.kind === "marker" && currentTool === THICK;
  const isStar = currentTool.kind === "sticker" &&
    currentTool.emoji === STAR.emoji;
  const isHeart = currentTool.kind === "sticker" &&
    currentTool.emoji === HEART.emoji;
  const isFire = currentTool.kind === "sticker" &&
    currentTool.emoji === FIRE.emoji;

  thinBtn.classList.toggle("selectedTool", isThin);
  thickBtn.classList.toggle("selectedTool", isThick);
  starBtn.classList.toggle("selectedTool", isStar);
  heartBtn.classList.toggle("selectedTool", isHeart);
  fireBtn.classList.toggle("selectedTool", isFire);
}

function selectTool(tool: Tool) {
  currentTool = tool;
  updateToolSelection();
  // Recreate preview for the new tool
  preview = makePreviewForTool(currentTool);
  notifyToolMoved(); // force immediate preview redraw per instructions
}

/* Marker tool clicks */
thinBtn.addEventListener("click", () => selectTool(THIN));
thickBtn.addEventListener("click", () => selectTool(THICK));

/* Sticker tool clicks (fire tool-moved on click) */
starBtn.addEventListener("click", () => selectTool(STAR));
heartBtn.addEventListener("click", () => selectTool(HEART));
fireBtn.addEventListener("click", () => selectTool(FIRE));

/* ========= Initial paint and UI state ========= */
updateToolSelection();
updateButtonState();
notifyToolMoved();
