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

/* ========= Sticker (single emoji/text you can reposition) ========= */
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

/* Stickers are now DATA-DRIVEN off this single array */
const stickers: StickerTool[] = [
  { kind: "sticker", label: "⭐", emoji: "⭐", size: 28 },
  { kind: "sticker", label: "❤️", emoji: "❤️", size: 28 },
  { kind: "sticker", label: "🔥", emoji: "🔥", size: 28 },
  // Add more by pushing into this array, or via the Custom button below
];

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

/* Rows */
const toolRow = document.createElement("div");
toolRow.className = "tool-row";
controls.appendChild(toolRow);

const stickerRow = document.createElement("div");
stickerRow.className = "tool-row";
controls.appendChild(stickerRow);

const actionRow = document.createElement("div");
actionRow.className = "action-row";
controls.appendChild(actionRow);

/* Marker buttons */
const thinBtn = document.createElement("button");
thinBtn.textContent = "Thin";
thinBtn.className = "btn tool";
toolRow.appendChild(thinBtn);

const thickBtn = document.createElement("button");
thickBtn.textContent = "Thick";
thickBtn.className = "btn tool";
toolRow.appendChild(thickBtn);

/* Sticker buttons are generated from data */
type StickerEntry = { tool: StickerTool; button: HTMLButtonElement };
let stickerEntries: StickerEntry[] = [];
function renderStickerButtons() {
  stickerRow.innerHTML = "";
  stickerEntries = [];
  for (const tool of stickers) {
    const btn = document.createElement("button");
    btn.textContent = tool.label;
    btn.className = "btn tool";
    btn.addEventListener("click", () => selectTool(tool));
    stickerRow.appendChild(btn);
    stickerEntries.push({ tool, button: btn });
  }
  // Add the "Custom Sticker" button at the end
  const addBtn = document.createElement("button");
  addBtn.textContent = "Custom Sticker";
  addBtn.className = "btn";
  addBtn.addEventListener("click", onAddCustomSticker);
  stickerRow.appendChild(addBtn);

  updateToolSelection();
}

/* Actions */
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

/* ========= Tool selection & Custom stickers ========= */
function updateToolSelection() {
  const isThin = currentTool.kind === "marker" && currentTool === THIN;
  const isThick = currentTool.kind === "marker" && currentTool === THICK;

  thinBtn.classList.toggle("selectedTool", isThin);
  thickBtn.classList.toggle("selectedTool", isThick);

  for (const { tool, button } of stickerEntries) {
    const isSelected = currentTool.kind === "sticker" &&
      currentTool.emoji === tool.emoji;
    button.classList.toggle("selectedTool", isSelected);
  }
}

function selectTool(tool: Tool) {
  currentTool = tool;
  updateToolSelection();
  // Recreate preview for the new tool
  preview = makePreviewForTool(currentTool);
  notifyToolMoved(); // force immediate preview redraw per instructions
}

function onAddCustomSticker() {
  const text = prompt("Custom sticker text", "🧽");
  if (text == null) return; // cancel
  const trimmed = text.trim();
  if (trimmed.length === 0) return; // ignore empty

  const newSticker: StickerTool = {
    kind: "sticker",
    label: trimmed, // show same text on button
    emoji: trimmed, // draw exactly what the user typed
    size: 28,
  };
  stickers.push(newSticker);
  renderStickerButtons(); // rebuild buttons including the new one
  selectTool(newSticker); // auto-select and preview it
}

/* Marker tool clicks */
thinBtn.addEventListener("click", () => selectTool(THIN));
thickBtn.addEventListener("click", () => selectTool(THICK));

/* Build sticker buttons from data initially */
renderStickerButtons();

/* ========= Initial paint and UI state ========= */
updateToolSelection();
updateButtonState();
notifyToolMoved();
