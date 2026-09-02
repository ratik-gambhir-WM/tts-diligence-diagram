// server/src/server.ts
import { createServer } from "node:http";

// server/src/app.ts
import { randomUUID } from "node:crypto";
import express from "express";

// server/src/errors.ts
var ApiError = class extends Error {
  constructor(status, code, message, options) {
    super(message, options);
    this.status = status;
    this.code = code;
  }
  status;
  code;
};
var errorHandler = (error, _request, response, _next) => {
  const apiError = toApiError(error);
  response.status(apiError.status).json({
    error: {
      code: apiError.code,
      message: apiError.message,
      requestId: response.locals.requestId
    }
  });
};
function notFoundHandler(_request, response) {
  response.status(404).json({
    error: {
      code: "route_not_found",
      message: "The requested route does not exist.",
      requestId: response.locals.requestId
    }
  });
}
function toApiError(error) {
  if (error instanceof ApiError) {
    return error;
  }
  if (isParserError(error) && (error.type === "entity.too.large" || error.status === 413)) {
    return new ApiError(413, "payload_too_large", "The request body exceeds the configured size limit.");
  }
  if (isParserError(error) && (error.type === "encoding.unsupported" || error.status === 415)) {
    return new ApiError(415, "unsupported_content_encoding", "Compressed request bodies are not supported.");
  }
  if (isParserError(error) && error.type === "entity.parse.failed") {
    return new ApiError(400, "invalid_json", "The request body must contain valid JSON.");
  }
  return new ApiError(500, "internal_error", "The request could not be completed.");
}
function isParserError(value) {
  return value instanceof Error;
}

// server/src/routes/exportRoutes.ts
import { json, Router } from "express";

// server/src/handlers/exportHandlers.ts
var POWERPOINT_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
function createExportHandlers(service) {
  const create = async (request, response) => {
    if (!request.is("application/json")) {
      throw new ApiError(
        415,
        "unsupported_media_type",
        "Content-Type must be application/json."
      );
    }
    const result = await service.export(request.body);
    const bytes = Buffer.from(result.bytes);
    response.status(200).set({
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${result.fileName}"`,
      "Content-Length": String(bytes.length),
      "Content-Type": POWERPOINT_CONTENT_TYPE,
      "X-PowerPoint-Warning-Count": String(result.warnings.length)
    }).send(bytes);
  };
  return { create };
}

// server/src/routes/exportRoutes.ts
function createExportRouter(service, maxJsonBytes) {
  const router = Router();
  const handlers = createExportHandlers(service);
  router.post(
    "/",
    json({ inflate: false, limit: maxJsonBytes, strict: true, type: "application/json" }),
    handlers.create
  );
  return router;
}

// server/src/routes/healthRoutes.ts
import { Router as Router2 } from "express";
function createHealthRouter(checkHealth) {
  const router = Router2();
  router.get("/", (_request, response) => {
    try {
      checkHealth();
    } catch (error) {
      throw new ApiError(503, "not_ready", "The service is not ready.", { cause: error });
    }
    response.status(200).set("Cache-Control", "no-store").json({ status: "ok" });
  });
  return router;
}

// server/src/routes/importRoutes.ts
import { Router as Router3, raw } from "express";

// server/src/handlers/importHandlers.ts
function createImportHandlers(service) {
  const create = async (request, response) => {
    if (!request.is("application/vnd.openxmlformats-officedocument.presentationml.presentation")) {
      throw new ApiError(
        415,
        "unsupported_media_type",
        "Content-Type must be application/vnd.openxmlformats-officedocument.presentationml.presentation."
      );
    }
    if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
      throw new ApiError(400, "missing_powerpoint", "A PowerPoint file is required in the request body.");
    }
    const result = await service.import(request.body);
    response.status(201).json(result);
  };
  const find = (request, response) => {
    const template = service.find(request.params.templateId);
    if (!template) {
      throw new ApiError(404, "template_not_found", "The requested template does not exist.");
    }
    response.json(template);
  };
  return { create, find };
}

// server/src/routes/importRoutes.ts
var POWERPOINT_CONTENT_TYPE2 = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
function createImportRouter(service, maxUploadBytes) {
  const router = Router3();
  const handlers = createImportHandlers(service);
  router.post(
    "/",
    raw({ inflate: false, limit: maxUploadBytes, type: POWERPOINT_CONTENT_TYPE2 }),
    handlers.create
  );
  router.get("/:templateId", handlers.find);
  return router;
}

// server/src/app.ts
function createApp(dependencies) {
  const app = express();
  app.disable("x-powered-by");
  app.use((_request, response, next) => {
    const requestId = randomUUID();
    response.locals.requestId = requestId;
    response.setHeader("X-Request-Id", requestId);
    next();
  });
  app.use("/health", createHealthRouter(dependencies.healthCheck));
  app.use("/export", createExportRouter(dependencies.exportService, dependencies.maxExportJsonBytes));
  app.use("/import", createImportRouter(dependencies.importService, dependencies.maxUploadBytes));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

// server/src/config.ts
import path from "node:path";
var DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
var DEFAULT_MAX_EXPORT_JSON_BYTES = 50 * 1024 * 1024;
function loadServerConfig(environment = process.env) {
  return {
    databasePath: path.resolve(environment.SQLITE_DB_PATH ?? "data/templates.sqlite"),
    maxExportJsonBytes: parsePositiveInteger(
      environment.MAX_EXPORT_JSON_BYTES,
      DEFAULT_MAX_EXPORT_JSON_BYTES,
      "MAX_EXPORT_JSON_BYTES"
    ),
    maxUploadBytes: parsePositiveInteger(
      environment.MAX_PPTX_UPLOAD_BYTES,
      DEFAULT_MAX_UPLOAD_BYTES,
      "MAX_PPTX_UPLOAD_BYTES"
    ),
    port: parsePort(environment.PORT)
  };
}
function parsePort(value) {
  const port = parsePositiveInteger(value, 3001, "PORT");
  if (port > 65535) {
    throw new Error("PORT must be between 1 and 65535.");
  }
  return port;
}
function parsePositiveInteger(value, fallback, name) {
  if (value === void 0) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive whole number.`);
  }
  return parsed;
}

// server/src/repositories/SqliteTemplateRepository.ts
import { mkdirSync } from "node:fs";
import path2 from "node:path";
import Database from "better-sqlite3";
var SqliteTemplateRepository = class {
  #database;
  constructor(databasePath) {
    if (databasePath !== ":memory:") {
      mkdirSync(path2.dirname(databasePath), { recursive: true });
    }
    this.#database = new Database(databasePath);
    this.#database.pragma("busy_timeout = 5000");
    if (databasePath !== ":memory:") {
      this.#database.pragma("journal_mode = WAL");
    }
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS templates (
        template_id TEXT PRIMARY KEY,
        template_json TEXT NOT NULL CHECK (json_valid(template_json))
      ) STRICT
    `);
  }
  insert(template) {
    this.#database.prepare("INSERT INTO templates (template_id, template_json) VALUES (?, json(?))").run(template.templateId, JSON.stringify(template.templateJson));
  }
  findById(templateId) {
    const row = this.#database.prepare("SELECT template_id, template_json FROM templates WHERE template_id = ?").get(templateId);
    if (!row) {
      return void 0;
    }
    return {
      templateId: row.template_id,
      templateJson: JSON.parse(row.template_json)
    };
  }
  close() {
    this.#database.close();
  }
  checkHealth() {
    this.#database.prepare("SELECT 1").get();
  }
};

// server/src/lib/export/PowerpointGenerator.ts
import JSZip from "jszip";

// server/src/lib/export/PowerpointRenderer.ts
import path3 from "node:path";
import PptxGenJS from "pptxgenjs";

// server/src/lib/WestMonroeBrandFrame.ts
var WEST_MONROE_BRAND_COLOR = "E8EEF8";
var REFERENCE_WIDTH = 1280;
var REFERENCE_HEIGHT = 720;
var FOOTER_HEIGHT = 75;
var REFERENCE_LOGO = {
  x: 48.33,
  y: 664.08,
  w: 153,
  h: 32.02
};
var REFERENCE_DOTS = Array.from({ length: 15 * 17 }, (_, index) => ({
  x: 15 + index % 15 * 19,
  y: 6 + Math.floor(index / 15) * 19,
  w: 2.5,
  h: 2.5
}));
function getWestMonroeBrandFrameLayout(width, height) {
  const scaleX = width / REFERENCE_WIDTH;
  const scaleY = height / REFERENCE_HEIGHT;
  const scaleRect = (rect) => ({
    x: rect.x * scaleX,
    y: rect.y * scaleY,
    w: rect.w * scaleX,
    h: rect.h * scaleY
  });
  return {
    dots: REFERENCE_DOTS.map(scaleRect),
    footer: {
      x: 0,
      y: height - FOOTER_HEIGHT * scaleY,
      w: width,
      h: FOOTER_HEIGHT * scaleY
    },
    logo: scaleRect(REFERENCE_LOGO)
  };
}

// server/src/lib/shared/PowerpointConstants.ts
var DEFAULT_WIDTH_PX = 1280;
var DEFAULT_HEIGHT_PX = 720;
var DEFAULT_FONT_FACE = "Arial";
var EMU_PER_INCH = 914400;
var PX_PER_INCH = 96;
var DEFAULT_THEME = {
  dk1: "070154",
  lt1: "FFFFFF",
  dk2: "0047FF",
  lt2: "F6EB20",
  accent1: "F900D3",
  accent2: "50658E",
  accent3: "CED7E6",
  accent4: "E8EEF8",
  accent5: "00E8FA",
  accent6: "00A3FF",
  hlink: "0563C1",
  folHlink: "954F72"
};
var shapeAliases = {
  rect: "rect",
  roundedRect: "roundRect",
  roundRect: "roundRect",
  ellipse: "ellipse",
  oval: "ellipse",
  diamond: "diamond",
  chevron: "chevron",
  database: "flowChartMagneticDisk",
  cylinder: "flowChartMagneticDisk",
  flowChartMagneticDisk: "flowChartMagneticDisk",
  line: "line"
};

// server/src/lib/shared/PowerpointUtils.ts
function parseLineColor(lineNode, theme, fallback) {
  if (!lineNode || hasChild(lineNode, "a:noFill")) {
    return "transparent";
  }
  return parseColor(findChild(lineNode, "a:solidFill"), theme, fallback);
}
function parseFontColor(styleNode, theme, fallback) {
  const fontRef = findChild(styleNode, "a:fontRef");
  if (!fontRef) {
    return fallback;
  }
  const colorNode = (fontRef.children ?? []).find((child2) => isColorTag(child2.tag));
  return colorNode ? parseColorNode(colorNode, theme, fallback) : fallback;
}
function parseColor(fillNode, theme, fallback) {
  if (!fillNode) {
    return fallback;
  }
  const colorNode = (fillNode.children ?? []).find((child2) => isColorTag(child2.tag));
  return colorNode ? parseColorNode(colorNode, theme, fallback) : fallback;
}
function parseColorOpacity(fillNode) {
  const colorNode = fillNode?.children?.find((child2) => isColorTag(child2.tag));
  if (!colorNode) {
    return 1;
  }
  let opacity = 1;
  for (const modifier of colorNode.children ?? []) {
    const value = Number(modifier.attributes?.val ?? 1e5) / 1e5;
    if (modifier.tag === "a:alpha") {
      opacity = value;
    } else if (modifier.tag === "a:alphaMod") {
      opacity *= value;
    } else if (modifier.tag === "a:alphaOff") {
      opacity += value;
    }
  }
  return clamp01(opacity);
}
function parseColorNode(node, theme, fallback) {
  if (node.tag === "a:srgbClr") {
    return cleanHex(node.attributes?.val, fallback);
  }
  if (node.tag === "a:sysClr") {
    return cleanHex(node.attributes?.lastClr || node.attributes?.val, fallback);
  }
  if (node.tag === "a:schemeClr") {
    const scheme = node.attributes?.val ?? "";
    const base = theme[mapSchemeColorKey(scheme)] || theme[scheme] || fallback;
    return applyColorModifiers(cleanHex(base, fallback), node.children ?? []);
  }
  return fallback;
}
function applyColorModifiers(baseHex, children2) {
  let rgb = hexToRgb(baseHex);
  if (!rgb) {
    return baseHex;
  }
  for (const child2 of children2) {
    if (child2.tag === "a:shade") {
      const factor = Number(child2.attributes?.val ?? "100000") / 1e5;
      rgb = rgb.map((channel) => Math.round(channel * factor));
    }
    if (child2.tag === "a:tint") {
      const factor = Number(child2.attributes?.val ?? "0") / 1e5;
      rgb = rgb.map((channel) => Math.round(channel + (255 - channel) * factor));
    }
  }
  return rgbToHex(rgb);
}
function normalizeShapeName(shape) {
  if (!shape) {
    return "rect";
  }
  return shapeAliases[shape] || shape;
}
function normalizeNativeKind(kind) {
  if (!kind) {
    return void 0;
  }
  const lower = kind.toLowerCase();
  if (lower === "text" || lower === "textbox") {
    return "text";
  }
  if (lower === "image" || lower === "picture") {
    return "image";
  }
  if (lower === "line" || lower === "arrow" || lower === "connector") {
    return "line";
  }
  return "shape";
}
function normalizeAlign(value) {
  if (value === "ctr" || value === "center") {
    return "center";
  }
  if (value === "r" || value === "right") {
    return "right";
  }
  return "left";
}
function normalizeValign(value) {
  if (value === "top" || value === "t") {
    return "top";
  }
  if (value === "bottom" || value === "b") {
    return "bottom";
  }
  return "middle";
}
function normalizeBodyAnchor(value) {
  if (value === "t") {
    return "top";
  }
  if (value === "b") {
    return "bottom";
  }
  return "middle";
}
function normalizeDash(value) {
  if (value === "dash" || value === "sysDash") {
    return "dash";
  }
  if (value === "dot" || value === "sysDot") {
    return "dot";
  }
  return "solid";
}
function normalizeArrow(value) {
  if (value === "triangle" || value === "arrow" || value === "diamond" || value === "oval" || value === "stealth") {
    return value;
  }
  return "none";
}
function normalizeLineType(value) {
  if (value === "elbow" || value === "angle" || value === "angled" || value === "angleBracket") {
    return "elbow";
  }
  return "straight";
}
function parseDashStyle(lineNode) {
  const dashNode = findChild(lineNode, "a:prstDash");
  return normalizeDash(dashNode?.attributes?.val);
}
function parseArrowType(lineNode) {
  const tailEnd = findChild(lineNode, "a:tailEnd");
  return normalizeArrow(tailEnd?.attributes?.type);
}
function parseBeginArrowType(lineNode) {
  const headEnd = findChild(lineNode, "a:headEnd");
  return normalizeArrow(headEnd?.attributes?.type);
}
function bodyPadding(bodyProperties) {
  const rawInsets = [
    bodyProperties?.lIns,
    bodyProperties?.tIns,
    bodyProperties?.rIns,
    bodyProperties?.bIns
  ];
  const definedInsets = rawInsets.filter((value) => value !== void 0);
  if (!definedInsets.length) {
    return 8;
  }
  const insets = definedInsets.map(emuToPoints);
  return insets.reduce((sum2, value) => sum2 + value, 0) / insets.length;
}
function resolveImageSource(src, options) {
  if (!src) {
    return void 0;
  }
  if (src.startsWith("data:") || src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }
  if (isAbsolutePathLike(src)) {
    return src;
  }
  if (options.baseDir) {
    return joinPathLike(options.baseDir, src);
  }
  return src;
}
function normalizeImageFit(value) {
  if (value === "cover" || value === "stretch") {
    return value;
  }
  return "contain";
}
function emuLineWidthToPoints(value) {
  const width = Number(value);
  if (!Number.isFinite(width) || width <= 0) {
    return 1;
  }
  return width / 12700;
}
function emuToPoints(value) {
  const emu = Number(value);
  if (!Number.isFinite(emu) || emu <= 0) {
    return 0;
  }
  return emu / EMU_PER_INCH * 72;
}
function inchesToPx(inches) {
  return inches * PX_PER_INCH;
}
function cleanHex(value, fallback) {
  if (!value) {
    return fallback;
  }
  const trimmed = value.replace("#", "").trim();
  if (trimmed.toLowerCase() === "transparent") {
    return "transparent";
  }
  return /^[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toUpperCase() : fallback;
}
function mapSchemeColorKey(key) {
  if (key === "tx1") {
    return "dk1";
  }
  if (key === "bg1") {
    return "lt1";
  }
  if (key === "tx2") {
    return "dk2";
  }
  if (key === "bg2") {
    return "lt2";
  }
  return key;
}
function isColorTag(tag) {
  return tag === "a:srgbClr" || tag === "a:schemeClr" || tag === "a:sysClr";
}
function findChild(node, tag) {
  return (node?.children ?? []).find((child2) => child2.tag === tag);
}
function hasChild(node, tag) {
  return !!findChild(node, tag);
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function asString(value) {
  return typeof value === "string" ? value : void 0;
}
function coerceNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function coerceBoolean(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}
function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function hexToRgb(hex) {
  const normalized = cleanHex(hex, "");
  if (!normalized) {
    return void 0;
  }
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16)
  ];
}
function rgbToHex([r, g, b]) {
  return [r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("").toUpperCase();
}
function isDefined(value) {
  return value !== void 0;
}
function isAbsolutePathLike(value) {
  return value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value);
}
function joinPathLike(baseDir, relativePath) {
  const separator = baseDir.includes("\\") ? "\\" : "/";
  const trimmedBase = baseDir.replace(/[\\/]+$/, "");
  const trimmedRelative = relativePath.replace(/^[\\/]+/, "");
  return `${trimmedBase}${separator}${trimmedRelative}`;
}

// server/src/lib/export/PowerpointUtils.ts
function toPptxShapeName(shape) {
  return normalizeShapeName(shape);
}
function toPptxVerticalAlign(value) {
  if (value === "top") {
    return "top";
  }
  if (value === "bottom") {
    return "bottom";
  }
  return "middle";
}
function opacityToTransparency(opacity) {
  return Math.round((1 - clamp01(opacity)) * 100);
}
function pxToInches(px) {
  return px / PX_PER_INCH;
}
function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function escapeXml(input) {
  return input.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// server/src/lib/shared/PowerpointLayering.ts
function getConnectorAwareElementOrder(slide) {
  return slide.elements.map((element, index) => ({
    element,
    index,
    layer: getConnectorAwareLayer(element, slide)
  })).sort((a, b) => a.layer - b.layer || a.index - b.index).map(({ element }) => element);
}
function getConnectorAwareLayer(element, slide) {
  if (isBrandedBackgroundDecoration(element)) {
    return 0;
  }
  if (isSlideContainerElement(element, slide)) {
    return 10;
  }
  if (element.kind === "line") {
    return 20;
  }
  return 30;
}
function isBrandedBackgroundDecoration(element) {
  return element.id === "west-monroe-footer" || element.id.startsWith("west-monroe-dot-");
}
function isSlideContainerElement(element, slide) {
  if (element.kind !== "shape" || element.shape !== "rect") {
    return false;
  }
  const slideArea = Math.max(slide.width * slide.height, 1);
  const elementArea = Math.max(element.w * element.h, 0);
  const coversLargeRegion = elementArea / slideArea >= 0.08;
  const coversTallLane = element.h / slide.height >= 0.45 && element.w / slide.width >= 0.12;
  return coversLargeRegion || coversTallLane;
}
function addConnectorOcclusionRects(elements, slide) {
  const slideForLayering = { ...slide, elements };
  const occlusionRects = elements.filter(
    (element) => element.kind !== "line" && !isSlideContainerElement(element, slideForLayering)
  ).map(getElementBounds);
  return elements.map((element) => {
    if (element.kind !== "line") {
      return element;
    }
    return {
      ...element,
      occlusionRects: element.endArrow === "none" ? occlusionRects : []
    };
  });
}
function getElementBounds(element) {
  return {
    h: element.h,
    w: element.w,
    x: element.x,
    y: element.y
  };
}

// server/src/lib/export/PowerpointRenderer.ts
var westMonroeLogoImage = path3.resolve(process.cwd(), "server/assets/element-5.png");
function buildPptxPresentation(presentation) {
  const pptx = new PptxGenJS();
  const widthInches = pxToInches(presentation.meta.width);
  const heightInches = pxToInches(presentation.meta.height);
  const brandFrame = getWestMonroeBrandFrameLayout(
    presentation.meta.width,
    presentation.meta.height
  );
  pptx.defineLayout({
    name: "JSON_LAYOUT",
    width: widthInches,
    height: heightInches
  });
  pptx.layout = "JSON_LAYOUT";
  pptx.author = "OpenAI Codex";
  pptx.company = "OpenAI";
  pptx.subject = "JSON to PowerPoint";
  pptx.title = presentation.meta.title;
  pptx.theme = {
    headFontFace: DEFAULT_FONT_FACE,
    bodyFontFace: DEFAULT_FONT_FACE
  };
  if (presentation.meta.showBranding) {
    pptx.defineSlideMaster({
      title: "WEST_MONROE_BRANDED_FRAME",
      objects: [
        {
          rect: {
            x: pxToInches(brandFrame.footer.x),
            y: pxToInches(brandFrame.footer.y),
            w: pxToInches(brandFrame.footer.w),
            h: pxToInches(brandFrame.footer.h),
            fill: { color: WEST_MONROE_BRAND_COLOR },
            line: { transparency: 100 }
          }
        },
        ...buildBrandDots(brandFrame.dots),
        {
          image: {
            path: westMonroeLogoImage,
            x: pxToInches(brandFrame.logo.x),
            y: pxToInches(brandFrame.logo.y),
            w: pxToInches(brandFrame.logo.w),
            h: pxToInches(brandFrame.logo.h)
          }
        }
      ]
    });
  }
  for (const slideSpec of presentation.slides) {
    const slide = presentation.meta.showBranding ? pptx.addSlide("WEST_MONROE_BRANDED_FRAME") : pptx.addSlide();
    slide.background = { color: cleanHex(slideSpec.backgroundColor, "FFFFFF") };
    const elements = slideSpec.preserveElementOrder ? slideSpec.elements : getConnectorAwareElementOrder(slideSpec);
    for (const element of elements) {
      if (element.kind === "line") {
        for (const segment of toPptxLineSegments(element)) {
          const lineGeometry = toPptxLineGeometry(segment);
          slide.addShape("line", {
            x: pxToInches(lineGeometry.x),
            y: pxToInches(lineGeometry.y),
            w: pxToInches(lineGeometry.w),
            h: pxToInches(lineGeometry.h),
            flipH: lineGeometry.flipH,
            flipV: lineGeometry.flipV,
            rotate: element.rotate,
            line: {
              color: cleanHex(element.stroke, "000000"),
              width: element.strokeWidth,
              transparency: opacityToTransparency(element.strokeOpacity ?? element.opacity),
              dashType: element.dash === "solid" ? "solid" : element.dash === "dot" ? "sysDot" : "dash",
              beginArrowType: segment.hasBeginArrow ? element.beginArrow : "none",
              endArrowType: segment.hasEndArrow ? element.endArrow : "none"
            }
          });
        }
        continue;
      }
      if (element.kind === "image") {
        const imageOptions = buildImageOptions(element);
        slide.addImage(imageOptions);
        continue;
      }
      if (element.kind === "text") {
        const maxFontSizePt = getMaxTextBoxFontSizePt(element);
        slide.addText(toPptxTextRuns(element.runs, maxFontSizePt), {
          x: pxToInches(element.x),
          y: pxToInches(element.y),
          w: pxToInches(element.w),
          h: pxToInches(element.h),
          margin: [element.padding, element.padding, element.padding, element.padding],
          fontFace: element.fontFace,
          fontSize: element.fontSize,
          color: cleanHex(element.color, "111827"),
          bold: element.runs.length ? element.runs.every((run) => run.bold) : element.bold,
          italic: element.runs.length ? element.runs.every((run) => run.italic) : element.italic,
          align: element.align,
          valign: toPptxVerticalAlign(element.valign),
          lineSpacingMultiple: 1.05,
          paraSpaceAfter: 0,
          paraSpaceBefore: 0,
          fill: colorToFill(element.fill, element.fillOpacity ?? element.opacity),
          line: colorToLine(element.stroke, element.strokeWidth, element.strokeOpacity ?? element.opacity),
          rotate: element.rotate,
          flipH: element.flipH,
          flipV: element.flipV,
          fit: "shrink",
          isTextBox: true,
          shape: element.borderRadius > 0 ? "roundRect" : "rect",
          rectRadius: element.borderRadius > 0 ? pxToInches(element.borderRadius) : void 0
        });
        continue;
      }
      if (element.label.trim().length > 0 && element.shape === "rect") {
        slide.addText(toPptxTextRuns(element.textRuns), {
          x: pxToInches(element.x),
          y: pxToInches(element.y),
          w: pxToInches(element.w),
          h: pxToInches(element.h),
          margin: [element.padding, element.padding, element.padding, element.padding],
          fontFace: element.fontFace,
          fontSize: element.fontSize,
          color: cleanHex(element.textColor, "111827"),
          bold: element.bold,
          align: element.align,
          valign: toPptxVerticalAlign(element.valign),
          rotate: element.rotate,
          flipH: element.flipH,
          flipV: element.flipV,
          fit: "shrink",
          isTextBox: true,
          fill: colorToFill(element.fill, element.fillOpacity ?? element.opacity),
          line: colorToLine(element.stroke, element.strokeWidth, element.strokeOpacity ?? element.opacity),
          shape: element.borderRadius > 0 ? "roundRect" : "rect",
          rectRadius: element.borderRadius > 0 ? pxToInches(element.borderRadius) : void 0
        });
        continue;
      }
      slide.addShape(toPptxShapeName(element.shape), {
        x: pxToInches(element.x),
        y: pxToInches(element.y),
        w: pxToInches(element.w),
        h: pxToInches(element.h),
        rotate: element.rotate,
        flipH: element.flipH,
        flipV: element.flipV,
        fill: colorToFill(element.fill, element.fillOpacity ?? element.opacity),
        line: colorToLine(element.stroke, element.strokeWidth, element.strokeOpacity ?? element.opacity),
        rectRadius: element.shape === "roundRect" && element.borderRadius > 0 ? pxToInches(element.borderRadius) : void 0
      });
      if (element.label.trim()) {
        const maxFontSizePt = element.shape === "rect" ? getMaxStackedFontSizePt(element) : void 0;
        slide.addText(toPptxTextRuns(element.textRuns, maxFontSizePt), {
          x: pxToInches(element.x),
          y: pxToInches(element.y),
          w: pxToInches(element.w),
          h: pxToInches(element.h),
          margin: [element.padding, element.padding, element.padding, element.padding],
          fontFace: element.fontFace,
          fontSize: element.fontSize,
          color: cleanHex(element.textColor, "111827"),
          bold: element.bold,
          align: element.align,
          valign: toPptxVerticalAlign(element.valign),
          lineSpacingMultiple: 1.05,
          paraSpaceAfter: 0,
          paraSpaceBefore: 0,
          rotate: element.rotate,
          fit: "shrink",
          isTextBox: true,
          fill: { color: "FFFFFF", transparency: 100 },
          line: { color: "FFFFFF", transparency: 100, width: 0 },
          shape: "rect"
        });
      }
    }
  }
  return pptx;
}
function buildBrandDots(dots) {
  return dots.map((dot) => ({
    rect: {
      x: pxToInches(dot.x),
      y: pxToInches(dot.y),
      w: pxToInches(dot.w),
      h: pxToInches(dot.h),
      fill: { color: WEST_MONROE_BRAND_COLOR },
      line: { transparency: 100 }
    }
  }));
}
function toPptxLineSegments(element) {
  if (element.lineType !== "elbow") {
    return [{ x1: element.x1, x2: element.x2, y1: element.y1, y2: element.y2, hasBeginArrow: true, hasEndArrow: true }];
  }
  return [
    { x1: element.x1, x2: element.x2, y1: element.y1, y2: element.y1, hasBeginArrow: true, hasEndArrow: false },
    { x1: element.x2, x2: element.x2, y1: element.y1, y2: element.y2, hasBeginArrow: false, hasEndArrow: true }
  ].filter((segment) => segment.x1 !== segment.x2 || segment.y1 !== segment.y2);
}
function toPptxLineGeometry(element) {
  return {
    x: Math.min(element.x1, element.x2),
    y: Math.min(element.y1, element.y2),
    w: Math.abs(element.x2 - element.x1),
    h: Math.abs(element.y2 - element.y1),
    flipH: element.x2 < element.x1,
    flipV: element.y2 < element.y1
  };
}
function buildImageOptions(element) {
  const crop = element.crop;
  const visibleWidth = crop ? Math.max(1 - crop.left - crop.right, 1e-3) : 1;
  const visibleHeight = crop ? Math.max(1 - crop.top - crop.bottom, 1e-3) : 1;
  const sourceBoxWidth = element.w / visibleWidth;
  const sourceBoxHeight = element.h / visibleHeight;
  const base = {
    x: pxToInches(element.x),
    y: pxToInches(element.y),
    w: pxToInches(sourceBoxWidth),
    h: pxToInches(sourceBoxHeight),
    altText: element.altText,
    transparency: opacityToTransparency(element.opacity),
    rotate: element.rotate,
    flipH: element.flipH,
    flipV: element.flipV,
    sizing: crop ? {
      type: "crop",
      x: pxToInches(crop.left * sourceBoxWidth),
      y: pxToInches(crop.top * sourceBoxHeight),
      w: pxToInches(element.w),
      h: pxToInches(element.h)
    } : void 0
  };
  if (element.src.startsWith("data:")) {
    return {
      ...base,
      data: element.src
    };
  }
  return {
    ...base,
    path: element.src
  };
}
function toPptxTextRuns(runs, maxFontSizePt) {
  return runs.map((run, index) => ({
    text: run.text,
    options: {
      bold: run.bold,
      italic: run.italic,
      underline: run.underline ? {} : void 0,
      breakLine: run.breakLine && index < runs.length - 1,
      color: cleanHex(run.color, "111827"),
      fontFace: run.fontFace,
      fontSize: Math.min(run.fontSize, maxFontSizePt ?? run.fontSize)
    }
  }));
}
function getMaxStackedFontSizePt(element) {
  const lineCount = Math.max(
    element.textRuns.reduce((count, run) => count + Math.max(run.text.split("\n").length, 1), 0),
    element.label.split("\n").length,
    1
  );
  const largestRunSize = Math.max(...element.textRuns.map((run) => run.fontSize), element.fontSize);
  const availableHeight = Math.max(element.h - element.padding * 2, 1);
  const heightLimitedSize = availableHeight / (lineCount * 1.28);
  return Math.max(Math.min(largestRunSize, heightLimitedSize), 5);
}
function getMaxTextBoxFontSizePt(element) {
  if (!element.runs.length) {
    return void 0;
  }
  const largestRunSize = Math.max(...element.runs.map((run) => run.fontSize), element.fontSize);
  const availableHeight = Math.max(element.h - element.padding * 2, 1);
  const availableWidth = Math.max(element.w - element.padding * 2, 1);
  const estimatedHeight = estimateTextRunHeight(element.runs, element.text, availableWidth);
  if (estimatedHeight <= availableHeight) {
    return largestRunSize;
  }
  return Math.max(largestRunSize * (availableHeight / estimatedHeight) * 0.96, 5);
}
function estimateTextRunHeight(runs, fallbackText, availableWidth) {
  const lines = getTextRunLines(runs, fallbackText);
  return lines.reduce((height, line) => {
    const fontSize = Math.max(line.fontSize, 1);
    const averageGlyphWidth = fontSize * 0.5;
    const charactersPerLine = Math.max(Math.floor(availableWidth / averageGlyphWidth), 1);
    const wrappedLineCount = Math.max(Math.ceil(line.text.trim().length / charactersPerLine), 1);
    return height + wrappedLineCount * fontSize * 1.05;
  }, 0);
}
function getTextRunLines(runs, fallbackText) {
  if (!runs.length) {
    return fallbackText.split("\n").map((line) => ({
      fontSize: 16,
      text: line
    }));
  }
  const lines = [];
  let currentLine = "";
  let currentFontSize = runs[0]?.fontSize ?? 16;
  for (const run of runs) {
    const parts = run.text.split("\n");
    parts.forEach((part, index) => {
      currentLine += part;
      currentFontSize = Math.max(currentFontSize, run.fontSize);
      if (index < parts.length - 1) {
        lines.push({ fontSize: currentFontSize, text: currentLine });
        currentLine = "";
        currentFontSize = run.fontSize;
      }
    });
    if (run.breakLine) {
      lines.push({ fontSize: currentFontSize, text: currentLine });
      currentLine = "";
      currentFontSize = run.fontSize;
    }
  }
  if (currentLine || !lines.length) {
    lines.push({ fontSize: currentFontSize, text: currentLine });
  }
  return lines;
}
function colorToFill(color, opacity = 1) {
  if (color === "transparent") {
    return { color: "FFFFFF", transparency: 100 };
  }
  return { color: cleanHex(color, "FFFFFF"), transparency: opacityToTransparency(opacity) };
}
function colorToLine(color, width, opacity = 1) {
  if (color === "transparent" || width <= 0) {
    return { color: "FFFFFF", transparency: 100, width: 0 };
  }
  return { color: cleanHex(color, "000000"), transparency: opacityToTransparency(opacity), width };
}

// server/src/lib/export/PowerpointConstants.ts
var WEST_MONROE_THEME_NAME = "west monroe 3";
var WEST_MONROE_THEME_FAMILY = "2024_West_Monroe_Template";
var WEST_MONROE_THEME_DISPLAY_NAME = "Covers, agenda, content slides";
var WEST_MONROE_THEME_FAMILY_ID = "{C81014D0-DA20-1C43-A69C-43A00C88AFD4}";
var WEST_MONROE_THEME_VERSION_ID = "{F7E5B7F2-98A1-0648-ACD7-27DE9B03B0A8}";
var WEST_MONROE_CUSTOM_COLORS = {
  "Highlight Magenta": "F900D3",
  "WM Light Blue": "00E8FA",
  "WM Green": "1DD566",
  "WM Gold": "FFC700",
  "WM Purple": "B741FF",
  "WM Light Green": "00FCB0",
  "WM Orange": "FF8A00",
  "WM Blue": "00A3FF",
  "WM Red": "F52C00",
  "WM Light Gray": "E8EEF8",
  "WM Medium Gray": "CED7E6",
  "WM Gray": "97A4BA"
};

// server/src/lib/export/PowerpointTheme.ts
function applyDefaultThemeXml(xml) {
  const themed = xml.replace(/<a:theme([^>]*)name="[^"]*"/u, `<a:theme$1name="${WEST_MONROE_THEME_DISPLAY_NAME}"`).replace(/<a:clrScheme\b[^>]*>[\s\S]*?<\/a:clrScheme>/u, buildThemeColorSchemeXml()).replace(/<a:fontScheme\b[^>]*>/u, '<a:fontScheme name="Arial">').replace(/<a:majorFont><a:latin\b[^>]*\/>/u, '<a:majorFont><a:latin typeface="Arial"/>').replace(/<a:minorFont><a:latin\b[^>]*\/>/u, '<a:minorFont><a:latin typeface="Arial"/>').replace(
    /<thm15:themeFamily\b([^>]*)name="[^"]*"/u,
    `<thm15:themeFamily$1name="${WEST_MONROE_THEME_FAMILY}"`
  ).replace(/(<thm15:themeFamily\b[^>]*\bid=")[^"]*"/u, `$1${WEST_MONROE_THEME_FAMILY_ID}"`).replace(/(<thm15:themeFamily\b[^>]*\bvid=")[^"]*"/u, `$1${WEST_MONROE_THEME_VERSION_ID}"`);
  return upsertCustomColorList(themed);
}
function buildThemeColorSchemeXml() {
  const colorXml = Object.entries(DEFAULT_THEME).map(([name, color]) => `<a:${name}><a:srgbClr val="${color}"/></a:${name}>`).join("");
  return `<a:clrScheme name="${WEST_MONROE_THEME_NAME}">${colorXml}</a:clrScheme>`;
}
function upsertCustomColorList(xml) {
  const customColorXml = `<a:custClrLst>${Object.entries(WEST_MONROE_CUSTOM_COLORS).map(([name, color]) => `<a:custClr name="${escapeXml(name)}"><a:srgbClr val="${color}"/></a:custClr>`).join("")}</a:custClrLst>`;
  if (/<a:custClrLst>[\s\S]*?<\/a:custClrLst>/u.test(xml)) {
    return xml.replace(/<a:custClrLst>[\s\S]*?<\/a:custClrLst>/u, customColorXml);
  }
  if (xml.includes("<a:extLst>")) {
    return xml.replace("<a:extLst>", `${customColorXml}<a:extLst>`);
  }
  return xml.replace("</a:theme>", `${customColorXml}</a:theme>`);
}

// server/src/lib/shared/PowerpointExtractedNormalizer.ts
function normalizeExtractedPresentation(input, issues) {
  const width = coerceNumber(input.slideSize?.widthPx, DEFAULT_WIDTH_PX);
  const height = coerceNumber(input.slideSize?.heightPx, DEFAULT_HEIGHT_PX);
  const theme = extractThemeColors(input.supportParts);
  const slideId = `slide-${input.slideNumber ?? 1}`;
  const slideName = deriveTitleFromExtractedSlide(input);
  const normalizedElements = (input.shapeTree?.elements ?? []).slice().sort((left, right) => coerceNumber(left.zIndex, 0) - coerceNumber(right.zIndex, 0)).flatMap(
    (element, index) => normalizeExtractedElement(
      element,
      index,
      width,
      height,
      theme,
      input.relationships ?? [],
      input.supportParts ?? {},
      issues
    )
  );
  const elements = normalizedElements;
  if (!elements.length) {
    issues.push({
      level: "warning",
      path: "shapeTree.elements",
      message: "No exportable slide elements were found. The PowerPoint will be empty."
    });
  }
  return {
    meta: {
      title: slideName,
      width,
      height,
      preserveElementOrder: true,
      showBranding: false,
      sourceType: "extracted-slide"
    },
    slides: [
      {
        id: slideId,
        name: slideName,
        width,
        height,
        backgroundColor: "FFFFFF",
        preserveElementOrder: true,
        elements
      }
    ]
  };
}
function normalizeExtractedElement(element, index, slideWidth, slideHeight, theme, relationships, supportParts, issues) {
  if (element.nonVisual?.hidden) {
    return [];
  }
  const id = `element-${element.nonVisual?.id ?? index + 1}`;
  const sourcePath = element.path || `shapeTree.elements[${index}]`;
  const transform = element.transform ?? {};
  const x = coerceNumber(transform.xPx, transform.xInches ? transform.xInches * 96 : 0);
  const y = coerceNumber(transform.yPx, transform.yInches ? transform.yInches * 96 : 0);
  const w = coerceNumber(transform.widthPx, transform.widthInches ? transform.widthInches * 96 : 0);
  const h = coerceNumber(transform.heightPx, transform.heightInches ? transform.heightInches * 96 : 0);
  const rotate = coerceNumber(transform.rotation, 0);
  const presetShape = normalizeShapeName(element.presetGeometry?.preset);
  if (element.kind === "connector" || presetShape === "line" || presetShape === "lineInv") {
    const lineNode2 = findChild(element.shapeProperties, "a:ln");
    const reverseX = !!transform.flipH || presetShape === "lineInv";
    const reverseY = !!transform.flipV || presetShape === "lineInv";
    return [
      {
        kind: "line",
        id,
        sourcePath,
        opacity: 1,
        rotate,
        valign: "middle",
        lineType: "straight",
        x1: clampNumber(reverseX ? x + w : x, 0, slideWidth),
        y1: clampNumber(reverseY ? y + h : y, 0, slideHeight),
        x2: clampNumber(reverseX ? x : x + w, 0, slideWidth),
        y2: clampNumber(reverseY ? y : y + h, 0, slideHeight),
        stroke: parseLineColor(lineNode2, theme, "334155"),
        strokeOpacity: parseColorOpacity(findChild(lineNode2, "a:solidFill")),
        strokeWidth: emuLineWidthToPoints(lineNode2?.attributes?.w),
        dash: parseDashStyle(lineNode2),
        beginArrow: parseBeginArrowType(lineNode2),
        endArrow: parseArrowType(lineNode2),
        occlusionRects: []
      }
    ];
  }
  if (element.kind === "graphicFrame") {
    const image = extractGraphicFrameImage(
      element,
      relationships,
      supportParts,
      theme,
      id,
      sourcePath,
      x,
      y,
      w,
      h,
      rotate
    );
    if (image) {
      return [image];
    }
    issues.push({
      level: "warning",
      path: sourcePath,
      message: "Skipped a graphic frame because it is not a plain PowerPoint drawable element."
    });
    return [];
  }
  if (element.kind !== "shape") {
    issues.push({
      level: "warning",
      path: sourcePath,
      message: `Skipped unsupported extracted element kind "${element.kind ?? "unknown"}".`
    });
    return [];
  }
  const textBody = element.text;
  if (hasChild(element.shapeProperties, "a:custGeom")) {
    issues.push({
      level: "warning",
      path: sourcePath,
      message: "Rendered a custom/freeform PowerPoint geometry as a rectangle fallback."
    });
  }
  if (hasChild(element.shapeProperties, "a:gradFill") || hasChild(element.shapeProperties, "a:pattFill") || hasChild(element.shapeProperties, "a:blipFill")) {
    issues.push({
      level: "warning",
      path: sourcePath,
      message: "This shape uses a gradient, pattern, or picture fill; the compact canvas schema uses a solid-color fallback."
    });
  }
  const textRuns = normalizeExtractedTextRuns(textBody, theme, element.style);
  const label = paragraphText(textBody);
  const fillNode = findChild(element.shapeProperties, "a:solidFill");
  const lineNode = findChild(element.shapeProperties, "a:ln");
  const fillReference = findChild(element.style, "a:fillRef");
  const lineReference = findChild(element.style, "a:lnRef");
  const hasLineReference = !!lineReference && lineReference.attributes?.idx !== "0";
  const lineFill = findChild(lineNode, "a:solidFill");
  const hasNoFill = hasChild(element.shapeProperties, "a:noFill");
  const fill = hasNoFill ? "transparent" : fillNode ? parseColor(fillNode, theme, "transparent") : parseColor(fillReference, theme, "transparent");
  const strokeVisible = !hasChild(lineNode, "a:noFill") && (!!lineFill || hasLineReference);
  const stroke = strokeVisible ? lineFill ? parseLineColor(lineNode, theme, "334155") : parseColor(lineReference, theme, "334155") : "transparent";
  const strokeWidth = strokeVisible ? emuLineWidthToPoints(lineNode?.attributes?.w) : 0;
  const textColor = textRuns.find((run) => run.color)?.color ?? parseFontColor(element.style, theme, stroke === "transparent" ? "111827" : "FFFFFF");
  const fontSize = textRuns.find((run) => run.fontSize)?.fontSize ?? 16;
  const fontFace = textRuns.find((run) => run.fontFace)?.fontFace ?? DEFAULT_FONT_FACE;
  const align = normalizeAlign(textBody?.paragraphs?.[0]?.properties?.algn);
  const valign = normalizeBodyAnchor(textBody?.bodyProperties?.anchor);
  const padding = bodyPadding(textBody?.bodyProperties);
  const shapeName = presetShape;
  const fillOpacity = parseColorOpacity(fillNode ?? fillReference);
  const strokeOpacity = parseColorOpacity(lineFill ?? lineReference);
  if (!label && w <= 0 && h <= 0) {
    return [];
  }
  const textOnly = !!label && (element.nonVisual?.isTextBox || element.nonVisual?.name?.toLowerCase().includes("textbox") || (fill === "transparent" || fillOpacity === 0) && (stroke === "transparent" || strokeOpacity === 0));
  if (textOnly) {
    return [
      {
        kind: "text",
        id,
        sourcePath,
        opacity: 1,
        rotate,
        flipH: transform.flipH || void 0,
        flipV: transform.flipV || void 0,
        valign,
        x,
        y,
        w: Math.max(w, 1),
        h: Math.max(h, fontSize * Math.max(textRuns.length, 1)),
        text: label,
        fill: "transparent",
        fillOpacity,
        stroke: "transparent",
        strokeOpacity,
        strokeWidth: 0,
        borderRadius: 0,
        padding,
        align,
        color: textColor,
        fontSize,
        fontFace,
        bold: textRuns.length > 0 && textRuns.every((run) => run.bold),
        italic: textRuns.length > 0 && textRuns.every((run) => run.italic),
        runs: textRuns.length ? textRuns : [
          {
            text: label,
            bold: false,
            italic: false,
            underline: false,
            color: textColor,
            fontSize,
            fontFace
          }
        ]
      }
    ];
  }
  return [
    {
      kind: "shape",
      id,
      sourcePath,
      opacity: 1,
      rotate,
      flipH: transform.flipH || void 0,
      flipV: transform.flipV || void 0,
      valign,
      x,
      y,
      w,
      h,
      shape: shapeName,
      label,
      fill,
      fillOpacity,
      stroke,
      strokeOpacity,
      strokeWidth,
      borderRadius: parseBorderRadius(element, shapeName, w, h),
      padding,
      align,
      textColor,
      fontSize,
      fontFace,
      bold: textRuns.length > 0 && textRuns.every((run) => run.bold),
      textRuns: textRuns.length ? textRuns : label ? [
        {
          text: label,
          bold: false,
          italic: false,
          underline: false,
          color: textColor,
          fontSize,
          fontFace
        }
      ] : []
    }
  ];
}
function parseBorderRadius(element, shapeName, width, height) {
  if (shapeName !== "roundRect") {
    return 0;
  }
  const adjustment = findChild(findChild(element.presetGeometry?.xmlAst, "a:avLst"), "a:gd");
  const match = /^val\s+(-?\d+(?:\.\d+)?)$/u.exec(adjustment?.attributes?.fmla ?? "");
  const ratio = match ? clampNumber(Number(match[1]) / 1e5, 0, 0.5) : 1 / 6;
  return Math.min(width, height) * ratio;
}
function extractGraphicFrameImage(element, relationships, supportParts, theme, id, sourcePath, x, y, w, h, rotate) {
  void theme;
  const relationshipId = element.relationshipIds?.find((candidate) => {
    const relationship2 = relationships.find((entry) => entry.Id === candidate);
    return relationship2?.typeShort === "image" || relationship2?.Type?.includes("/image");
  });
  if (!relationshipId) {
    return void 0;
  }
  const relationship = relationships.find((entry) => entry.Id === relationshipId);
  const supportPart = relationship ? getRelationshipSupportPart(relationship, supportParts) : void 0;
  const base64 = supportPart?.base64;
  const mimeType = supportPart?.contentTypeHint && supportPart.contentTypeHint.startsWith("image/") ? supportPart.contentTypeHint : extensionToMimeType((relationship?.resolvedTarget || relationship?.Target || "").split(".").pop());
  if (!relationship || !base64 || !mimeType) {
    return void 0;
  }
  const imageElement = {
    kind: "image",
    id,
    sourcePath,
    opacity: extractImageOpacity(element.xmlAst),
    rotate,
    flipH: element.transform?.flipH || void 0,
    flipV: element.transform?.flipV || void 0,
    valign: "middle",
    x,
    y,
    w: Math.max(w, 1),
    h: Math.max(h, 1),
    src: `data:${mimeType};base64,${base64}`,
    fit: "stretch",
    crop: extractImageCrop(element.xmlAst),
    borderRadius: 0,
    altText: element.nonVisual?.description || element.nonVisual?.name || "Embedded image"
  };
  return imageElement;
}
function extractImageOpacity(node) {
  const blip = findFirstDescendant(node, "a:blip");
  const alpha = findChild(blip, "a:alphaModFix");
  return clampNumber(Number(alpha?.attributes?.amt ?? 1e5) / 1e5, 0, 1);
}
function extractImageCrop(node) {
  const srcRect = findChild(findFirstDescendant(node, "p:blipFill"), "a:srcRect");
  if (!srcRect) {
    return void 0;
  }
  const crop = {
    top: clampNumber(Number(srcRect.attributes?.t ?? 0) / 1e5, 0, 1),
    right: clampNumber(Number(srcRect.attributes?.r ?? 0) / 1e5, 0, 1),
    bottom: clampNumber(Number(srcRect.attributes?.b ?? 0) / 1e5, 0, 1),
    left: clampNumber(Number(srcRect.attributes?.l ?? 0) / 1e5, 0, 1)
  };
  return crop.top || crop.right || crop.bottom || crop.left ? crop : void 0;
}
function findFirstDescendant(node, tag) {
  if (!node) {
    return void 0;
  }
  if (node.tag === tag) {
    return node;
  }
  for (const childNode of node.children ?? []) {
    const match = findFirstDescendant(childNode, tag);
    if (match) {
      return match;
    }
  }
  return void 0;
}
function getRelationshipSupportPart(relationship, supportParts) {
  const candidates = [
    relationship.resolvedTarget,
    relationship.Target
  ].filter((candidate) => !!candidate);
  for (const candidate of candidates) {
    const exactMatch = supportParts[candidate];
    if (exactMatch) {
      return exactMatch;
    }
    const normalizedCandidate = candidate.replace(/^\/+/u, "");
    const normalizedMatch = Object.entries(supportParts).find(
      ([partPath]) => partPath.replace(/^\/+/u, "") === normalizedCandidate
    )?.[1];
    if (normalizedMatch) {
      return normalizedMatch;
    }
  }
  return void 0;
}
function extensionToMimeType(extension) {
  if (!extension) {
    return void 0;
  }
  const normalized = extension.toLowerCase();
  if (normalized === "png") {
    return "image/png";
  }
  if (normalized === "jpg" || normalized === "jpeg") {
    return "image/jpeg";
  }
  if (normalized === "svg") {
    return "image/svg+xml";
  }
  if (normalized === "gif") {
    return "image/gif";
  }
  if (normalized === "emf") {
    return "image/emf";
  }
  return void 0;
}
function normalizeExtractedTextRuns(textBody, theme, styleNode) {
  const runs = [];
  const defaultColor = parseFontColor(styleNode, theme, "111827");
  for (const paragraph of textBody?.paragraphs ?? []) {
    const paragraphRuns = paragraph.runs ?? [];
    if (!paragraphRuns.length) {
      continue;
    }
    paragraphRuns.forEach((run, runIndex) => {
      const properties = run.properties ?? {};
      runs.push({
        text: run.text ?? "",
        bold: properties.b === "1",
        italic: properties.i === "1",
        underline: !!properties.u && properties.u !== "none",
        color: defaultColor,
        fontFace: DEFAULT_FONT_FACE,
        fontSize: properties.sz ? Number(properties.sz) / 100 : 16,
        breakLine: runIndex === paragraphRuns.length - 1
      });
    });
  }
  if (!runs.length && textBody?.plainText) {
    runs.push({
      text: textBody.plainText,
      bold: false,
      italic: false,
      underline: false,
      color: defaultColor,
      fontFace: DEFAULT_FONT_FACE,
      fontSize: 16
    });
  }
  return runs;
}
function paragraphText(textBody) {
  const lines = (textBody?.paragraphs ?? []).map((paragraph) => (paragraph.runs ?? []).map((run) => run.text ?? "").join(""));
  while (lines.length && !lines[0].trim()) {
    lines.shift();
  }
  while (lines.length && !lines.at(-1)?.trim()) {
    lines.pop();
  }
  if (lines.length) {
    return lines.join("\n");
  }
  return textBody?.plainText?.trim() ?? "";
}
function extractThemeColors(supportParts) {
  const rawXml = supportParts?.["ppt/theme/theme1.xml"]?.rawXml;
  if (!rawXml) {
    return DEFAULT_THEME;
  }
  const theme = { ...DEFAULT_THEME };
  for (const key of Object.keys(DEFAULT_THEME)) {
    const match = rawXml.match(
      new RegExp(
        `<a:${key}>[\\s\\S]*?(?:<a:srgbClr val="([0-9A-Fa-f]{6})"\\/?>(?:[\\s\\S]*?)<\\/a:srgbClr>|<a:srgbClr val="([0-9A-Fa-f]{6})"\\s*\\/?>|<a:sysClr[^>]*lastClr="([0-9A-Fa-f]{6})"\\s*\\/?>)[\\s\\S]*?<\\/a:${key}>`
      )
    );
    const color = match?.[1] || match?.[2] || match?.[3];
    if (color) {
      theme[key] = color.toUpperCase();
    }
  }
  return theme;
}
function deriveTitleFromExtractedSlide(input) {
  const titleCandidate = input.shapeTree?.elements?.filter((element) => element.kind === "shape" && !!paragraphText(element.text)).sort((left, right) => coerceNumber(left.transform?.yPx, 0) - coerceNumber(right.transform?.yPx, 0))[0];
  const title = paragraphText(titleCandidate?.text).replace(/\s+/g, " ").trim();
  return title || `Slide ${input.slideNumber ?? 1}`;
}

// server/src/lib/shared/PowerpointNativeNormalizer.ts
function normalizeNativePresentation(input, issues, options) {
  const presentationNode = isRecord(input.presentation) ? input.presentation : input;
  const slidesSource = Array.isArray(presentationNode.slides) ? presentationNode.slides : isRecord(presentationNode.slide) && Array.isArray(presentationNode.slide.elements) ? [presentationNode.slide] : Array.isArray(input.slides) ? input.slides : Array.isArray(input.elements) ? [input] : void 0;
  if (!slidesSource?.length) {
    issues.push({
      level: "error",
      path: "slides",
      message: "Expected either an extracted PowerPoint slide payload (`shapeTree`) or a slide/deck object with `slides` or `elements`."
    });
    return void 0;
  }
  const width = resolveNativeDimension(
    presentationNode,
    presentationNode.canvas,
    presentationNode.size,
    presentationNode.layout,
    "width",
    DEFAULT_WIDTH_PX
  );
  const height = resolveNativeDimension(
    presentationNode,
    presentationNode.canvas,
    presentationNode.size,
    presentationNode.layout,
    "height",
    DEFAULT_HEIGHT_PX
  );
  const mappedSlides = slidesSource.map(
    (slideSource, index) => normalizeNativeSlide(
      slideSource,
      index,
      width,
      height,
      issues,
      options,
      presentationNode.preserveElementOrder === true
    )
  );
  const slides = mappedSlides.filter(isDefined);
  if (!slides.length) {
    issues.push({
      level: "error",
      path: "slides",
      message: "The deck did not contain any valid slides after normalization."
    });
    return void 0;
  }
  return {
    meta: {
      title: asString(presentationNode.title) || "Generated Presentation",
      width: slides[0].width,
      height: slides[0].height,
      preserveElementOrder: presentationNode.preserveElementOrder === true,
      showBranding: presentationNode.showBranding !== false,
      sourceType: "native-presentation"
    },
    slides
  };
}
function normalizeNativeSlide(slideSource, index, defaultWidth, defaultHeight, issues, options, preserveElementOrder = false) {
  if (!isRecord(slideSource)) {
    issues.push({
      level: "warning",
      path: `slides[${index}]`,
      message: "Skipped a slide because it was not an object."
    });
    return void 0;
  }
  const width = resolveNativeDimension(
    slideSource,
    slideSource.canvas,
    slideSource.size,
    slideSource.layout,
    "width",
    defaultWidth
  );
  const height = resolveNativeDimension(
    slideSource,
    slideSource.canvas,
    slideSource.size,
    slideSource.layout,
    "height",
    defaultHeight
  );
  const elementsSource = Array.isArray(slideSource.elements) ? slideSource.elements : [];
  const mappedElements = elementsSource.map(
    (item, elementIndex) => normalizeNativeElement(item, width, height, issues, `slides[${index}].elements[${elementIndex}]`, options)
  );
  const normalizedElements = mappedElements.filter(isDefined);
  const elements = preserveElementOrder ? normalizedElements : addConnectorOcclusionRects(normalizedElements, { height, width });
  return {
    id: asString(slideSource.id) || `slide-${index + 1}`,
    name: asString(slideSource.name) || asString(slideSource.title) || `Slide ${index + 1}`,
    width,
    height,
    backgroundColor: cleanHex(asString(slideSource.backgroundColor), "FFFFFF"),
    preserveElementOrder,
    elements
  };
}
function normalizeNativeElement(input, width, height, issues, pathLabel, options) {
  if (!isRecord(input)) {
    issues.push({
      level: "warning",
      path: pathLabel,
      message: "Skipped a non-object element."
    });
    return void 0;
  }
  const rawKind = asString(input.kind) || asString(input.type) || asString(input.elementType) || asString(input.shape);
  const kind = normalizeNativeKind(rawKind);
  if (!kind) {
    issues.push({
      level: "warning",
      path: pathLabel,
      message: `Unsupported element type "${rawKind ?? "unknown"}".`
    });
    return void 0;
  }
  if (kind === "line") {
    const x1 = resolvePosition(input.x1 ?? input.x ?? input.left, width);
    const y1 = resolvePosition(input.y1 ?? input.y ?? input.top, height);
    const x2 = input.x2 !== void 0 ? resolvePosition(input.x2, width) : x1 + resolvePosition(input.w ?? input.width ?? 0, width);
    const y2 = input.y2 !== void 0 ? resolvePosition(input.y2, height) : y1 + resolvePosition(input.h ?? input.height ?? 0, height);
    const element2 = {
      kind: "line",
      id: asString(input.id) || pathLabel,
      sourcePath: pathLabel,
      opacity: clamp01(coerceNumber(input.opacity, 1)),
      rotate: coerceNumber(input.rotate, 0),
      flipH: coerceBoolean(input.flipH) || void 0,
      flipV: coerceBoolean(input.flipV) || void 0,
      valign: "middle",
      lineType: normalizeLineType(asString(input.lineType)),
      x1,
      y1,
      x2,
      y2,
      stroke: cleanHex(asString(input.stroke) || asString(input.color), "334155"),
      strokeOpacity: clamp01(coerceNumber(input.strokeOpacity, 1)),
      strokeWidth: coerceNumber(input.strokeWidth, 1.5),
      dash: normalizeDash(asString(input.dash)),
      beginArrow: normalizeArrow(asString(input.beginArrow) || asString(input.startArrow)),
      endArrow: normalizeArrow(asString(input.endArrow) || asString(input.arrow)),
      occlusionRects: []
    };
    return element2;
  }
  if (kind === "image") {
    const src = resolveImageSource(asString(input.src) || asString(input.path) || asString(input.data), options);
    if (!src) {
      issues.push({
        level: "warning",
        path: `${pathLabel}.src`,
        message: "Skipped an image element because it did not include a usable image source."
      });
      return void 0;
    }
    const element2 = {
      kind: "image",
      id: asString(input.id) || pathLabel,
      sourcePath: pathLabel,
      opacity: clamp01(coerceNumber(input.opacity, 1)),
      rotate: coerceNumber(input.rotate, 0),
      flipH: coerceBoolean(input.flipH) || void 0,
      flipV: coerceBoolean(input.flipV) || void 0,
      valign: "middle",
      x: resolvePosition(input.x ?? input.left, width),
      y: resolvePosition(input.y ?? input.top, height),
      w: resolvePosition(input.w ?? input.width, width),
      h: resolvePosition(input.h ?? input.height, height),
      src,
      fit: normalizeImageFit(asString(input.fit)),
      crop: normalizeImageCrop(input.crop),
      borderRadius: coerceNumber(input.borderRadius, 0),
      altText: asString(input.altText) || ""
    };
    return element2;
  }
  const x = resolvePosition(input.x ?? input.left, width);
  const y = resolvePosition(input.y ?? input.top, height);
  const w = resolvePosition(input.w ?? input.width, width);
  const h = resolvePosition(input.h ?? input.height, height);
  const padding = coerceNumber(input.padding, 8);
  const align = normalizeAlign(asString(input.align));
  const valign = normalizeValign(asString(input.valign));
  const fontSize = coerceNumber(input.fontSize, 18);
  const fontFace = asString(input.fontFace) || DEFAULT_FONT_FACE;
  const textColor = cleanHex(asString(input.color) || asString(input.textColor), "111827");
  const textContent = asString(input.text) || asString(input.label) || "";
  const nativeRuns = normalizeNativeTextRuns(input.runs, fontFace, fontSize, textColor);
  const runs = nativeRuns.length > 0 ? nativeRuns : textContent ? [
    {
      text: textContent,
      bold: coerceBoolean(input.bold),
      italic: coerceBoolean(input.italic),
      underline: false,
      fontFace,
      fontSize,
      color: textColor
    }
  ] : [];
  if (kind === "text") {
    const element2 = {
      kind: "text",
      id: asString(input.id) || pathLabel,
      sourcePath: pathLabel,
      opacity: clamp01(coerceNumber(input.opacity, 1)),
      rotate: coerceNumber(input.rotate, 0),
      flipH: coerceBoolean(input.flipH) || void 0,
      flipV: coerceBoolean(input.flipV) || void 0,
      valign,
      x,
      y,
      w,
      h,
      text: textContent,
      fill: cleanHex(asString(input.fill), "FFFFFF"),
      fillOpacity: clamp01(coerceNumber(input.fillOpacity, 1)),
      stroke: cleanHex(asString(input.stroke), "FFFFFF"),
      strokeOpacity: clamp01(coerceNumber(input.strokeOpacity, 1)),
      strokeWidth: coerceNumber(input.strokeWidth, 0),
      borderRadius: coerceNumber(input.borderRadius, 0),
      padding,
      align,
      color: textColor,
      fontSize,
      fontFace,
      bold: coerceBoolean(input.bold),
      italic: coerceBoolean(input.italic),
      runs
    };
    return element2;
  }
  const element = {
    kind: "shape",
    id: asString(input.id) || pathLabel,
    sourcePath: pathLabel,
    opacity: clamp01(coerceNumber(input.opacity, 1)),
    rotate: coerceNumber(input.rotate, 0),
    flipH: coerceBoolean(input.flipH) || void 0,
    flipV: coerceBoolean(input.flipV) || void 0,
    valign,
    x,
    y,
    w,
    h,
    shape: normalizeShapeName(asString(input.shape) || rawKind),
    label: textContent,
    fill: cleanHex(asString(input.fill), "E5EEF8"),
    fillOpacity: clamp01(coerceNumber(input.fillOpacity, 1)),
    stroke: cleanHex(asString(input.stroke), "334155"),
    strokeOpacity: clamp01(coerceNumber(input.strokeOpacity, 1)),
    strokeWidth: coerceNumber(input.strokeWidth, 1),
    borderRadius: coerceNumber(input.borderRadius, 0),
    padding,
    align,
    textColor,
    fontSize,
    fontFace,
    bold: coerceBoolean(input.bold),
    textRuns: runs
  };
  return element;
}
function normalizeImageCrop(input) {
  if (!isRecord(input)) {
    return void 0;
  }
  const crop = {
    top: clamp01(coerceNumber(input.top, 0)),
    right: clamp01(coerceNumber(input.right, 0)),
    bottom: clamp01(coerceNumber(input.bottom, 0)),
    left: clamp01(coerceNumber(input.left, 0))
  };
  return crop.top || crop.right || crop.bottom || crop.left ? crop : void 0;
}
function normalizeNativeTextRuns(input, fallbackFontFace, fallbackFontSize, fallbackColor) {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.filter((run) => isRecord(run)).map((run) => ({
    text: asString(run.text) || "",
    bold: coerceBoolean(run.bold),
    italic: coerceBoolean(run.italic),
    underline: coerceBoolean(run.underline),
    color: cleanHex(asString(run.color), fallbackColor),
    fontFace: asString(run.fontFace) || fallbackFontFace,
    fontSize: coerceNumber(run.fontSize, fallbackFontSize),
    breakLine: coerceBoolean(run.breakLine) || void 0
  }));
}
function resolveNativeDimension(source, canvas, size, layout, axis, fallback) {
  const sourceNode = isRecord(source) ? source : void 0;
  const canvasNode = isRecord(canvas) ? canvas : void 0;
  const sizeNode = isRecord(size) ? size : void 0;
  const layoutNode = isRecord(layout) ? layout : void 0;
  const key = axis === "width" ? "width" : "height";
  const inchesKey = axis === "width" ? "widthInches" : "heightInches";
  const pixelValue = sourceNode?.[key] ?? canvasNode?.[key] ?? sizeNode?.[key] ?? layoutNode?.[key] ?? layoutNode?.[axis === "width" ? "w" : "h"];
  if (typeof pixelValue === "number") {
    return pixelValue;
  }
  const inchesValue = sourceNode?.[inchesKey] ?? canvasNode?.[inchesKey] ?? sizeNode?.[inchesKey] ?? layoutNode?.[inchesKey];
  if (typeof inchesValue === "number") {
    return inchesToPx(inchesValue);
  }
  return fallback;
}
function resolvePosition(value, canvasSize) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.endsWith("%")) {
      const percent = Number(trimmed.slice(0, -1));
      return Number.isFinite(percent) ? canvasSize * percent / 100 : 0;
    }
    if (trimmed.endsWith("in")) {
      const inches = Number(trimmed.slice(0, -2));
      return Number.isFinite(inches) ? inchesToPx(inches) : 0;
    }
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? numeric : 0;
  }
  return 0;
}

// server/src/lib/shared/PowerpointNormalizer.ts
function normalizePresentationSpec(input, options = {}) {
  const issues = [];
  if (Array.isArray(input)) {
    const slides = input.map((entry, index) => normalizeSingleSlideLike(entry, issues, `slides[${index}]`, options)).filter((slide) => slide !== void 0);
    if (!slides.length) {
      issues.push({
        level: "error",
        path: "slides",
        message: "No valid slides were found in the provided array."
      });
      return { issues };
    }
    return {
      presentation: {
        meta: {
          title: "Generated Presentation",
          width: slides[0].width,
          height: slides[0].height,
          preserveElementOrder: false,
          showBranding: true,
          sourceType: "native-presentation"
        },
        slides
      },
      issues
    };
  }
  if (!isRecord(input)) {
    issues.push({
      level: "error",
      path: "root",
      message: "Expected a JSON object or array of slide objects."
    });
    return { issues };
  }
  if ("shapeTree" in input) {
    const presentation2 = normalizeExtractedPresentation(input, issues);
    return { presentation: presentation2, issues };
  }
  const presentation = normalizeNativePresentation(input, issues, options);
  return { presentation, issues };
}
function normalizeSingleSlideLike(input, issues, pathLabel, options) {
  if (!isRecord(input)) {
    issues.push({
      level: "warning",
      path: pathLabel,
      message: "Skipped a non-object slide entry."
    });
    return void 0;
  }
  if ("shapeTree" in input) {
    return normalizeExtractedPresentation(input, issues).slides[0];
  }
  return normalizeNativeSlide(input, 0, DEFAULT_WIDTH_PX, DEFAULT_HEIGHT_PX, issues, options);
}

// server/src/lib/export/PowerpointGenerator.ts
function buildSuggestedFileName(presentation) {
  const stem = slugify(presentation.meta.title || "generated-presentation");
  return `${stem || "generated-presentation"}.pptx`;
}
async function buildThemedPptxBytes(presentation) {
  const pptx = buildPptxPresentation(presentation);
  const raw2 = await pptx.write({ outputType: "uint8array", compression: true });
  if (!(raw2 instanceof Uint8Array)) {
    throw new Error("PowerPoint export returned an unsupported binary output type.");
  }
  const zip = await JSZip.loadAsync(raw2);
  const themePath = "ppt/theme/theme1.xml";
  const existingTheme = await zip.file(themePath)?.async("text");
  if (existingTheme) {
    zip.file(themePath, applyDefaultThemeXml(existingTheme));
  }
  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE"
  });
}

// server/src/services/ExportPowerPointService.ts
var MAX_JSON_DEPTH = 100;
var MAX_JSON_NODES = 1e5;
var MAX_EMBEDDED_IMAGE_BYTES = 40 * 1024 * 1024;
var ExportPowerPointService = class {
  async export(input) {
    assertBoundedJsonValue(input);
    const { presentation, issues } = normalizePresentationSpec(input);
    const errors = issues.filter((issue) => issue.level === "error");
    if (!presentation || errors.length > 0) {
      throw new ApiError(
        422,
        "invalid_presentation_json",
        "The JSON could not be converted into a PowerPoint presentation."
      );
    }
    validateImageSources(presentation);
    const bytes = await buildThemedPptxBytes(presentation);
    return {
      bytes,
      fileName: buildSuggestedFileName(presentation),
      warnings: issues.filter((issue) => issue.level === "warning").map((issue) => `${issue.path}: ${issue.message}`)
    };
  }
};
function assertBoundedJsonValue(input) {
  const pending = [{ depth: 0, value: input }];
  let nodeCount = 0;
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) {
      continue;
    }
    nodeCount += 1;
    if (nodeCount > MAX_JSON_NODES || current.depth > MAX_JSON_DEPTH) {
      throw new ApiError(
        422,
        "presentation_too_complex",
        "The presentation JSON exceeds the processing complexity limit."
      );
    }
    const value = current.value;
    if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        pending.push({ depth: current.depth + 1, value: entry });
      }
      continue;
    }
    if (isPlainRecord(value)) {
      for (const entry of Object.values(value)) {
        pending.push({ depth: current.depth + 1, value: entry });
      }
      continue;
    }
    throw new ApiError(
      400,
      "invalid_json_value",
      "The request body contains an unsupported JSON value."
    );
  }
}
function validateImageSources(presentation) {
  let embeddedBytes = 0;
  for (const slide of presentation.slides) {
    for (const element of slide.elements) {
      if (element.kind !== "image") {
        continue;
      }
      const match = /^data:image\/(?:png|jpeg|jpg|gif|svg\+xml|emf);base64,([a-z0-9+/]*={0,2})$/iu.exec(
        element.src
      );
      if (!match) {
        throw new ApiError(
          422,
          "unsupported_image_source",
          "Exported images must use an embedded base64 data URI."
        );
      }
      const base64 = match[1] ?? "";
      embeddedBytes += Math.floor(base64.length * 3 / 4);
      if (embeddedBytes > MAX_EMBEDDED_IMAGE_BYTES) {
        throw new ApiError(
          413,
          "embedded_images_too_large",
          "The embedded presentation images exceed the processing limit."
        );
      }
    }
  }
}
function isPlainRecord(value) {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

// server/src/services/ImportTemplateService.ts
import { randomUUID as randomUUID2 } from "node:crypto";
var ImportTemplateService = class {
  constructor(converter, templates2, createTemplateId = randomUUID2) {
    this.converter = converter;
    this.templates = templates2;
    this.createTemplateId = createTemplateId;
  }
  converter;
  templates;
  createTemplateId;
  async import(source) {
    const conversion = await this.converter.convert(source);
    const template = {
      templateId: this.createTemplateId(),
      templateJson: conversion.templateJson
    };
    this.templates.insert(template);
    return {
      ...template,
      warnings: conversion.warnings
    };
  }
  find(templateId) {
    return this.templates.findById(templateId);
  }
};

// server/src/services/PowerPointConverter.ts
import { mkdtemp, rm, writeFile as writeFile3 } from "node:fs/promises";
import { tmpdir } from "node:os";
import path7 from "node:path";

// server/src/lib/import/PowerpointImporter.ts
import { mkdir as mkdir2, readFile, writeFile as writeFile2 } from "node:fs/promises";
import path6 from "node:path";
import JSZip2 from "jszip";

// server/src/lib/import/PowerpointCompactWriter.ts
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path4 from "node:path";

// server/src/lib/import/PowerpointImportUtils.ts
function firstDefined(values) {
  return values.find((value) => value !== void 0);
}
function positiveNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}
function positiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}
function optionalNumber(value, fallback) {
  return value === fallback ? void 0 : value;
}
function prune(input) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== void 0 && value !== null && value !== "")
  );
}
function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
function emuToPx(value) {
  return round(value / EMU_PER_INCH * PX_PER_INCH);
}

// server/src/lib/import/PowerpointCompactWriter.ts
async function compactPresentation(presentation, outputPath, options = {}) {
  return {
    presentation: {
      title: presentation.meta.title,
      preserveElementOrder: presentation.meta.preserveElementOrder,
      showBranding: presentation.meta.showBranding,
      slides: await Promise.all(
        presentation.slides.map(async (slide) => ({
          id: slide.id,
          name: slide.name,
          width: round(slide.width),
          height: round(slide.height),
          backgroundColor: slide.backgroundColor,
          elements: await Promise.all(
            slide.elements.map((element) => compactElement(element, outputPath, options))
          )
        }))
      )
    }
  };
}
async function compactElement(element, outputPath, options) {
  if (element.kind === "line") {
    return compactLine(element);
  }
  if (element.kind === "image") {
    return compactImage(element, outputPath, options);
  }
  if (element.kind === "text") {
    return compactText(element);
  }
  return compactShape(element);
}
function compactShape(element) {
  const hasText = !!element.label;
  return prune({
    id: element.id,
    type: "shape",
    shape: element.shape,
    x: round(element.x),
    y: round(element.y),
    w: round(element.w),
    h: round(element.h),
    rotate: optionalNumber(element.rotate, 0),
    flipH: element.flipH || void 0,
    flipV: element.flipV || void 0,
    opacity: optionalNumber(element.opacity, 1),
    fill: element.fill,
    fillOpacity: optionalNumber(element.fillOpacity ?? 1, 1),
    stroke: element.stroke,
    strokeOpacity: optionalNumber(element.strokeOpacity ?? 1, 1),
    strokeWidth: round(element.strokeWidth),
    borderRadius: optionalNumber(round(element.borderRadius), 0),
    padding: hasText ? optionalNumber(round(element.padding), 8) : void 0,
    text: element.label || void 0,
    align: hasText && element.align !== "left" ? element.align : void 0,
    valign: hasText && element.valign !== "middle" ? element.valign : void 0,
    fontSize: hasText ? round(element.fontSize) : void 0,
    fontFace: hasText ? element.fontFace : void 0,
    bold: hasText && element.bold ? true : void 0,
    textColor: hasText ? element.textColor : void 0,
    runs: compactRuns(element.textRuns, element.label)
  });
}
function compactText(element) {
  return prune({
    id: element.id,
    type: "text",
    x: round(element.x),
    y: round(element.y),
    w: round(element.w),
    h: round(element.h),
    rotate: optionalNumber(element.rotate, 0),
    flipH: element.flipH || void 0,
    flipV: element.flipV || void 0,
    opacity: optionalNumber(element.opacity, 1),
    fill: element.fill,
    fillOpacity: optionalNumber(element.fillOpacity ?? 1, 1),
    stroke: element.stroke,
    strokeOpacity: optionalNumber(element.strokeOpacity ?? 1, 1),
    strokeWidth: round(element.strokeWidth),
    borderRadius: optionalNumber(round(element.borderRadius), 0),
    padding: optionalNumber(round(element.padding), 8),
    text: element.text || void 0,
    align: element.align === "left" ? void 0 : element.align,
    valign: element.valign === "middle" ? void 0 : element.valign,
    fontSize: round(element.fontSize),
    fontFace: element.fontFace,
    bold: element.bold || void 0,
    italic: element.italic || void 0,
    textColor: element.color,
    runs: compactRuns(element.runs, element.text)
  });
}
function compactLine(element) {
  return prune({
    id: element.id,
    type: "line",
    x1: round(element.x1),
    y1: round(element.y1),
    x2: round(element.x2),
    y2: round(element.y2),
    rotate: optionalNumber(element.rotate, 0),
    beginArrow: !element.beginArrow || element.beginArrow === "none" ? void 0 : element.beginArrow,
    opacity: optionalNumber(element.opacity, 1),
    stroke: element.stroke,
    strokeOpacity: optionalNumber(element.strokeOpacity ?? 1, 1),
    strokeWidth: round(element.strokeWidth),
    dash: element.dash === "solid" ? void 0 : element.dash,
    endArrow: element.endArrow === "none" ? void 0 : element.endArrow
  });
}
async function compactImage(element, outputPath, options) {
  return prune({
    id: element.id,
    type: "image",
    x: round(element.x),
    y: round(element.y),
    w: round(element.w),
    h: round(element.h),
    rotate: optionalNumber(element.rotate, 0),
    flipH: element.flipH || void 0,
    flipV: element.flipV || void 0,
    opacity: optionalNumber(element.opacity, 1),
    src: options.embedAssets ? element.src : await externalizeImage(element.src, outputPath),
    fit: element.fit,
    crop: compactCrop(element.crop),
    borderRadius: optionalNumber(round(element.borderRadius), 0),
    altText: element.altText || void 0
  });
}
function compactRuns(runs, text) {
  if (!runs.length || runs.length === 1 && runs[0]?.text === text) {
    return void 0;
  }
  return runs.map(
    (run) => prune({
      text: run.text,
      bold: run.bold || void 0,
      italic: run.italic || void 0,
      underline: run.underline || void 0,
      color: run.color,
      fontFace: run.fontFace,
      fontSize: round(run.fontSize),
      breakLine: run.breakLine || void 0
    })
  );
}
function compactCrop(crop) {
  if (!crop) {
    return void 0;
  }
  return prune({
    top: optionalNumber(round(crop.top), 0),
    right: optionalNumber(round(crop.right), 0),
    bottom: optionalNumber(round(crop.bottom), 0),
    left: optionalNumber(round(crop.left), 0)
  });
}
async function externalizeImage(src, outputPath) {
  const dataUri = /^data:([^;,]+);base64,(.+)$/u.exec(src);
  if (!dataUri) {
    return src;
  }
  const [, mimeType, base64] = dataUri;
  const extension = mimeTypeToExtension(mimeType);
  const digest = createHash("sha256").update(base64).digest("hex").slice(0, 12);
  const fileName = `image-${digest}${extension}`;
  const assetDir = path4.join(path4.dirname(outputPath), "assets");
  const assetPath = path4.join(assetDir, fileName);
  await mkdir(assetDir, { recursive: true });
  await writeFile(assetPath, Buffer.from(base64, "base64"));
  return `./assets/${fileName}`;
}
function mimeTypeToExtension(mimeType) {
  if (mimeType === "image/jpeg") {
    return ".jpg";
  }
  if (mimeType === "image/svg+xml") {
    return ".svg";
  }
  if (mimeType === "image/gif") {
    return ".gif";
  }
  if (mimeType === "image/emf") {
    return ".emf";
  }
  return ".png";
}

// server/src/lib/import/PowerpointXml.ts
function parseXml(xml) {
  const root = { tag: "#document", children: [] };
  const stack = [root];
  const tokens = xml.match(/<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<\/?[^>]+>|[^<]+/g) ?? [];
  for (const token of tokens) {
    if (token.startsWith("<?") || token.startsWith("<!--") || token.startsWith("<!DOCTYPE")) {
      continue;
    }
    if (token.startsWith("</")) {
      stack.pop();
      continue;
    }
    if (token.startsWith("<![CDATA[")) {
      appendText(stack.at(-1), token.slice(9, -3));
      continue;
    }
    if (token.startsWith("<")) {
      const selfClosing = /\/>\s*$/u.test(token);
      const body = token.slice(1, selfClosing ? -2 : -1).trim();
      const spaceIndex = body.search(/\s/u);
      const tag = spaceIndex === -1 ? body : body.slice(0, spaceIndex);
      const attributes = parseAttributes(spaceIndex === -1 ? "" : body.slice(spaceIndex + 1));
      const node = { tag, attributes, children: [] };
      stack.at(-1)?.children?.push(node);
      if (!selfClosing) {
        stack.push(node);
      }
      continue;
    }
    appendText(stack.at(-1), decodeXml(token));
  }
  return root;
}
function parseAttributes(input) {
  const attributes = {};
  const pattern = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gu;
  let match;
  while (match = pattern.exec(input)) {
    attributes[match[1]] = decodeXml(match[2] ?? match[3] ?? "");
  }
  return attributes;
}
function appendText(node, text) {
  if (!node) {
    return;
  }
  const decoded = decodeXml(text);
  if (!decoded) {
    return;
  }
  node.text = `${node.text ?? ""}${decoded}`;
}
function collectRelationshipIds(node) {
  return [
    ...Object.entries(node.attributes ?? {}).filter(([name]) => name === "r:id" || name === "r:embed" || name === "r:link").map(([, value]) => value),
    ...(node.children ?? []).flatMap(collectRelationshipIds)
  ];
}
function paragraphText2(textBody) {
  const lines = (textBody?.paragraphs ?? []).map((paragraph) => (paragraph.runs ?? []).map((run) => run.text ?? "").join("")).filter((line) => line.trim());
  return lines.length ? lines.join("\n") : textBody?.plainText?.trim() ?? "";
}
function child(node, tag) {
  return node?.children?.find((candidate) => candidate.tag === tag);
}
function children(node, tag) {
  return node?.children?.filter((candidate) => candidate.tag === tag) ?? [];
}
function hasChild2(node, tag) {
  return !!child(node, tag);
}
function descendants(node, tag) {
  if (!node) {
    return [];
  }
  return [
    ...node.tag === tag ? [node] : [],
    ...(node.children ?? []).flatMap((candidate) => descendants(candidate, tag))
  ];
}
function findDescendant(node, tag) {
  return descendants(node, tag)[0];
}
function findTransformNode(node) {
  return child(node, "a:xfrm");
}
function decodeXml(input) {
  return input.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

// server/src/lib/import/PowerpointGeometry.ts
function extractElementTransform(node, matrix, placeholderSources = []) {
  const xfrm = node.tag === "p:graphicFrame" ? child(node, "p:xfrm") : findTransformNode(child(node, "p:spPr")) ?? firstDefined(
    placeholderSources.map((source) => findTransformNode(child(source, "p:spPr")))
  );
  const off = child(xfrm, "a:off")?.attributes ?? {};
  const ext = child(xfrm, "a:ext")?.attributes ?? {};
  const rawX = Number(off.x) || 0;
  const rawY = Number(off.y) || 0;
  const rawW = Number(ext.cx) || 0;
  const rawH = Number(ext.cy) || 0;
  const transformedCenter = transformPoint(matrix, rawX + rawW / 2, rawY + rawH / 2);
  const matrixScaleX = Math.hypot(matrix.a, matrix.b);
  const matrixScaleY = Math.hypot(matrix.c, matrix.d);
  const w = Math.abs(matrixScaleX * rawW);
  const h = Math.abs(matrixScaleY * rawH);
  const x = transformedCenter.x - w / 2;
  const y = transformedCenter.y - h / 2;
  const parentRotation = Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
  const ownRotation = xfrm?.attributes?.rot ? Number(xfrm.attributes.rot) / 6e4 : 0;
  const rotation = normalizeDegrees(parentRotation + ownRotation);
  const matrixIsReflected = matrix.a * matrix.d - matrix.b * matrix.c < 0;
  return {
    xPx: emuToPx(x),
    yPx: emuToPx(y),
    widthPx: emuToPx(w),
    heightPx: emuToPx(h),
    rotation,
    flipH: xfrm?.attributes?.flipH === "1",
    flipV: xfrm?.attributes?.flipV === "1" !== matrixIsReflected,
    xInches: round(x / EMU_PER_INCH, 4),
    yInches: round(y / EMU_PER_INCH, 4),
    widthInches: round(w / EMU_PER_INCH, 4),
    heightInches: round(h / EMU_PER_INCH, 4)
  };
}
function groupTransform(node) {
  const xfrm = findTransformNode(child(node, "p:grpSpPr"));
  const off = child(xfrm, "a:off")?.attributes ?? {};
  const ext = child(xfrm, "a:ext")?.attributes ?? {};
  const chOff = child(xfrm, "a:chOff")?.attributes ?? {};
  const chExt = child(xfrm, "a:chExt")?.attributes ?? {};
  const extCx = Number(ext.cx) || 0;
  const extCy = Number(ext.cy) || 0;
  const chExtCx = Number(chExt.cx) || extCx || 1;
  const chExtCy = Number(chExt.cy) || extCy || 1;
  const scaleX = extCx ? extCx / chExtCx : 1;
  const scaleY = extCy ? extCy / chExtCy : 1;
  const offX = Number(off.x) || 0;
  const offY = Number(off.y) || 0;
  const base = {
    a: scaleX,
    b: 0,
    c: 0,
    d: scaleY,
    e: offX - (Number(chOff.x) || 0) * scaleX,
    f: offY - (Number(chOff.y) || 0) * scaleY
  };
  const centerX = offX + extCx / 2;
  const centerY = offY + extCy / 2;
  const flip = scaleAround(
    centerX,
    centerY,
    xfrm?.attributes?.flipH === "1" ? -1 : 1,
    xfrm?.attributes?.flipV === "1" ? -1 : 1
  );
  const rotation = rotateAround(
    centerX,
    centerY,
    xfrm?.attributes?.rot ? Number(xfrm.attributes.rot) / 6e4 : 0
  );
  return multiplyTransform(rotation, multiplyTransform(flip, base));
}
function identityTransform() {
  return {
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: 0,
    f: 0
  };
}
function composeTransform(parent, childTransform) {
  return multiplyTransform(parent, childTransform);
}
function multiplyTransform(left, right) {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f
  };
}
function transformPoint(matrix, x, y) {
  return {
    x: matrix.a * x + matrix.c * y + matrix.e,
    y: matrix.b * x + matrix.d * y + matrix.f
  };
}
function rotateAround(centerX, centerY, degrees) {
  if (!degrees) {
    return identityTransform();
  }
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    a: cosine,
    b: sine,
    c: -sine,
    d: cosine,
    e: centerX - cosine * centerX + sine * centerY,
    f: centerY - sine * centerX - cosine * centerY
  };
}
function scaleAround(centerX, centerY, scaleX, scaleY) {
  return {
    a: scaleX,
    b: 0,
    c: 0,
    d: scaleY,
    e: centerX * (1 - scaleX),
    f: centerY * (1 - scaleY)
  };
}
function normalizeDegrees(value) {
  const normalized = (value % 360 + 360) % 360;
  return Math.abs(normalized) < 1e-4 ? 0 : round(normalized, 4);
}

// server/src/lib/import/PowerpointOoxml.ts
import path5 from "node:path";
async function collectSupportParts(zip, relationships) {
  const supportParts = {};
  const themeXml = await maybeReadZipText(zip, "ppt/theme/theme1.xml");
  if (themeXml) {
    supportParts["ppt/theme/theme1.xml"] = {
      path: "ppt/theme/theme1.xml",
      size: Buffer.byteLength(themeXml),
      relationshipType: "theme",
      contentTypeHint: "application/xml",
      rawXml: themeXml
    };
  }
  for (const relationship of relationships) {
    if (!relationship.resolvedTarget || !relationship.Type?.includes("/image")) {
      continue;
    }
    const bytes = await maybeReadZipBytes(zip, relationship.resolvedTarget);
    if (!bytes) {
      continue;
    }
    supportParts[relationship.resolvedTarget] = {
      path: relationship.resolvedTarget,
      size: bytes.length,
      relationshipType: relationship.Type,
      contentTypeHint: imageContentType(relationship.resolvedTarget),
      base64: bytes.toString("base64")
    };
  }
  return supportParts;
}
function extractSlidePaths(presentationXml, relationships) {
  const presentation = parseXml(presentationXml);
  const relById = new Map(relationships.map((relationship) => [relationship.Id, relationship]));
  return descendants(presentation, "p:sldId").map((slideId) => relById.get(slideId.attributes?.["r:id"] ?? "")?.resolvedTarget).filter((target) => !!target);
}
function extractSlideSize(presentationXml) {
  const presentation = parseXml(presentationXml);
  const sldSz = findDescendant(presentation, "p:sldSz");
  const cx = Number(sldSz?.attributes?.cx) || 12192e3;
  const cy = Number(sldSz?.attributes?.cy) || 6858e3;
  return {
    cx,
    cy,
    widthPx: round(cx / EMU_PER_INCH * PX_PER_INCH),
    heightPx: round(cy / EMU_PER_INCH * PX_PER_INCH)
  };
}
function parseRelationships(xml, baseDir) {
  const root = parseXml(xml);
  return descendants(root, "Relationship").map((relationship) => {
    const Type = relationship.attributes?.Type;
    const Target = relationship.attributes?.Target;
    return {
      Id: relationship.attributes?.Id ?? "",
      Type,
      Target,
      resolvedTarget: Target ? resolvePartPath(baseDir, Target) : void 0,
      typeShort: Type?.split("/").pop()
    };
  });
}
async function readZipText(zip, filePath) {
  const file = zip.file(filePath);
  if (!file) {
    throw new Error(`Missing expected PowerPoint part: ${filePath}`);
  }
  return file.async("text");
}
async function maybeReadZipText(zip, filePath) {
  return zip.file(filePath)?.async("text");
}
async function maybeReadZipBytes(zip, filePath) {
  const bytes = await zip.file(filePath)?.async("nodebuffer");
  return bytes;
}
function relationshipPathFor(partPath) {
  const directory = path5.posix.dirname(partPath);
  const base = path5.posix.basename(partPath);
  return path5.posix.join(directory, "_rels", `${base}.rels`);
}
function resolvePartPath(baseDir, target) {
  if (/^[a-z]+:/iu.test(target)) {
    return target;
  }
  return path5.posix.normalize(path5.posix.join(baseDir, target));
}
function imageContentType(filePath) {
  const extension = path5.extname(filePath).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }
  if (extension === ".svg") {
    return "image/svg+xml";
  }
  if (extension === ".gif") {
    return "image/gif";
  }
  if (extension === ".emf") {
    return "image/emf";
  }
  return "image/png";
}

// server/src/lib/import/PowerpointShapeUtils.ts
function extractNonVisual(node) {
  const nonVisualNode = child(node, "p:nvSpPr") ?? child(node, "p:nvCxnSpPr") ?? child(node, "p:nvPicPr") ?? child(node, "p:nvGraphicFramePr");
  const cNvPr = child(nonVisualNode, "p:cNvPr");
  const cNvSpPr = child(nonVisualNode, "p:cNvSpPr");
  const placeholder = findDescendant(nonVisualNode, "p:ph");
  return {
    id: Number(cNvPr?.attributes?.id) || void 0,
    name: cNvPr?.attributes?.name,
    description: cNvPr?.attributes?.descr || cNvPr?.attributes?.title,
    hidden: cNvPr?.attributes?.hidden === "1",
    isTextBox: cNvSpPr?.attributes?.txBox === "1",
    placeholder: placeholder ? {
      type: placeholder.attributes?.type,
      idx: placeholder.attributes?.idx
    } : void 0
  };
}

// server/src/lib/import/PowerpointText.ts
function extractText(textNode, fallbackTextNodes = []) {
  if (!textNode) {
    return void 0;
  }
  const fallbackParagraphs = fallbackTextNodes.map((node) => children(node, "a:p"));
  const paragraphs = children(textNode, "a:p").map((paragraph, paragraphIndex) => {
    const fallbackParagraph = firstDefined(
      fallbackParagraphs.map((entries) => entries[paragraphIndex] ?? entries[0])
    );
    const paragraphProperties = child(paragraph, "a:pPr");
    const fallbackParagraphProperties = child(fallbackParagraph, "a:pPr");
    const defaultRunProperties = {
      ...extractRunProperties(child(fallbackParagraphProperties, "a:defRPr")),
      ...extractRunProperties(child(paragraphProperties, "a:defRPr"))
    };
    const runs = (paragraph.children ?? []).filter((node) => node.tag === "a:r" || node.tag === "a:fld" || node.tag === "a:br").map((run) => ({
      text: run.tag === "a:br" ? "\n" : child(run, "a:t")?.text ?? "",
      properties: {
        ...defaultRunProperties,
        ...extractRunProperties(child(run, "a:rPr"))
      }
    }));
    const bulletPrefix = extractBulletPrefix(paragraphProperties, paragraphIndex);
    if (bulletPrefix) {
      if (runs.length) {
        runs[0].text = `${bulletPrefix}${runs[0].text}`;
      } else {
        runs.push({ text: bulletPrefix.trimEnd(), properties: defaultRunProperties });
      }
    }
    return {
      runs,
      properties: {
        ...fallbackParagraphProperties?.attributes ?? {},
        ...paragraphProperties?.attributes ?? {}
      },
      endParagraphRunProperties: {
        ...child(fallbackParagraph, "a:endParaRPr")?.attributes ?? {},
        ...child(paragraph, "a:endParaRPr")?.attributes ?? {}
      }
    };
  });
  const plainText = paragraphs.map((paragraph) => paragraph.runs.map((run) => run.text).join("")).join("\n");
  return {
    plainText,
    paragraphs,
    bodyProperties: {
      ...firstDefined(fallbackTextNodes.map((node) => child(node, "a:bodyPr")?.attributes)),
      ...child(textNode, "a:bodyPr")?.attributes ?? {}
    }
  };
}
function extractBulletPrefix(paragraphProperties, paragraphIndex) {
  if (!paragraphProperties || child(paragraphProperties, "a:buNone")) {
    return "";
  }
  const bullet = child(paragraphProperties, "a:buChar");
  if (bullet?.attributes?.char) {
    return `${bullet.attributes.char} `;
  }
  const automatic = child(paragraphProperties, "a:buAutoNum");
  if (automatic) {
    const startAt = positiveInt(automatic.attributes?.startAt, 1);
    const value = startAt + paragraphIndex;
    const type = automatic.attributes?.type ?? "";
    return type.includes("ParenR") ? `${value}) ` : `${value}. `;
  }
  return "";
}
function applyExtractedTypography(presentation, extracted) {
  const theme = extractThemeTypography(extracted.supportParts);
  const sourceByPath = new Map(
    (extracted.shapeTree?.elements ?? []).map((element) => [String(element.path ?? ""), element]).filter(([sourcePath]) => !!sourcePath)
  );
  for (const slide of presentation.slides) {
    if (extracted.backgroundColor) {
      slide.backgroundColor = extracted.backgroundColor;
    }
    for (const element of slide.elements) {
      if (element.kind === "line" || element.kind === "image") {
        continue;
      }
      const source = sourceByPath.get(element.sourcePath);
      const extractedRuns = flattenExtractedTextRuns(source?.text);
      const fallbackFontFace = bestFontFace(extractedRuns, theme) || theme.bodyFont || element.fontFace;
      if (element.kind === "text") {
        element.fontFace = fallbackFontFace;
        element.runs = applyRunTypography(element.runs, extractedRuns, theme, fallbackFontFace);
        element.color = firstRunColor(element.runs) || element.color;
        element.fontSize = firstRunFontSize(element.runs) || element.fontSize;
        element.bold = element.runs.length > 0 && element.runs.every((run) => run.bold);
        continue;
      }
      element.fontFace = fallbackFontFace;
      element.textRuns = applyRunTypography(element.textRuns, extractedRuns, theme, fallbackFontFace);
      element.textColor = firstRunColor(element.textRuns) || element.textColor;
      element.fontSize = firstRunFontSize(element.textRuns) || element.fontSize;
      element.bold = element.textRuns.length > 0 && element.textRuns.every((run) => run.bold);
    }
  }
}
function applyRunTypography(runs, extractedRuns, theme, fallbackFontFace) {
  if (!runs.length) {
    return runs;
  }
  return runs.map((run, index) => {
    const extracted = extractedRuns[index] ?? extractedRuns.find((candidate) => candidate.text === run.text);
    const properties = extracted?.properties ?? {};
    return {
      ...run,
      color: resolveRunColor(properties, theme) || run.color,
      fontFace: resolveRunFontFace(properties, theme) || fallbackFontFace || run.fontFace,
      fontSize: resolveRunFontSize(properties) || run.fontSize
    };
  });
}
function extractRunProperties(runProperties) {
  const properties = { ...runProperties?.attributes ?? {} };
  const typeface = extractRunTypeface(runProperties);
  const color = extractRunColor(runProperties);
  if (typeface) {
    properties.fontFace = typeface;
  }
  if (color.value) {
    properties.fontColor = color.value;
  }
  if (color.scheme) {
    properties.fontSchemeColor = color.scheme;
  }
  return properties;
}
function flattenExtractedTextRuns(text) {
  return (text?.paragraphs ?? []).flatMap((paragraph) => paragraph.runs ?? []);
}
function bestFontFace(runs, theme) {
  for (const run of runs) {
    const fontFace = resolveRunFontFace(run.properties ?? {}, theme);
    if (fontFace) {
      return fontFace;
    }
  }
  return theme.bodyFont;
}
function firstRunColor(runs) {
  return runs.find((run) => !!run.color)?.color;
}
function firstRunFontSize(runs) {
  return runs.find((run) => run.fontSize > 0)?.fontSize;
}
function resolveRunFontFace(properties, theme) {
  const rawFontFace = properties.fontFace || properties.typeface;
  if (!rawFontFace) {
    return theme.bodyFont;
  }
  if (rawFontFace === "+mn-lt" || rawFontFace === "+mn-ea" || rawFontFace === "+mn-cs") {
    return theme.bodyFont;
  }
  if (rawFontFace === "+mj-lt" || rawFontFace === "+mj-ea" || rawFontFace === "+mj-cs") {
    return theme.headingFont;
  }
  return rawFontFace;
}
function resolveRunColor(properties, theme) {
  if (properties.fontColor) {
    return cleanHex(properties.fontColor);
  }
  if (properties.fontSchemeColor) {
    const scheme = mapSchemeColorKey2(properties.fontSchemeColor);
    return cleanHex(theme.colors[scheme] || theme.colors[properties.fontSchemeColor] || schemeColorFallback(scheme));
  }
  return void 0;
}
function resolveRunFontSize(properties) {
  const size = Number(properties.sz);
  return Number.isFinite(size) && size > 0 ? size / 100 : void 0;
}
function extractRunTypeface(runProperties) {
  const latin = child(runProperties, "a:latin") ?? child(runProperties, "a:ea") ?? child(runProperties, "a:cs");
  return latin?.attributes?.typeface;
}
function extractRunColor(runProperties) {
  return extractFillColorValue(child(runProperties, "a:solidFill"));
}
function extractFillColorValue(fillNode) {
  const colorNode = cloneColorNode(fillNode);
  if (!colorNode) {
    return {};
  }
  if (colorNode.tag === "a:srgbClr") {
    return { value: colorNode.attributes?.val };
  }
  if (colorNode.tag === "a:sysClr") {
    return { value: colorNode.attributes?.lastClr || colorNode.attributes?.val };
  }
  if (colorNode.tag === "a:schemeClr") {
    return { scheme: colorNode.attributes?.val };
  }
  return {};
}
function extractThemeTypography(supportParts) {
  const rawXml = supportParts?.["ppt/theme/theme1.xml"]?.rawXml;
  const fallback = {
    bodyFont: "Arial",
    headingFont: "Arial",
    colors: defaultThemeColors()
  };
  if (!rawXml) {
    return fallback;
  }
  return {
    bodyFont: extractThemeFont(rawXml, "minorFont") || fallback.bodyFont,
    headingFont: extractThemeFont(rawXml, "majorFont") || fallback.headingFont,
    colors: extractThemeColors2(rawXml)
  };
}
function extractThemeFont(rawXml, fontKind) {
  const match = rawXml.match(new RegExp(`<a:${fontKind}>[\\s\\S]*?<a:latin[^>]*typeface="([^"]*)"`));
  const typeface = match?.[1]?.trim();
  return typeface || void 0;
}
function extractThemeColors2(rawXml) {
  const colors = defaultThemeColors();
  for (const key of Object.keys(colors)) {
    const match = rawXml.match(
      new RegExp(
        `<a:${key}>[\\s\\S]*?(?:<a:srgbClr val="([0-9A-Fa-f]{6})"\\/?>(?:[\\s\\S]*?)<\\/a:srgbClr>|<a:srgbClr val="([0-9A-Fa-f]{6})"\\s*\\/?>|<a:sysClr[^>]*lastClr="([0-9A-Fa-f]{6})"\\s*\\/?>)[\\s\\S]*?<\\/a:${key}>`
      )
    );
    const color = match?.[1] || match?.[2] || match?.[3];
    if (color) {
      colors[key] = color.toUpperCase();
    }
  }
  return colors;
}
function defaultThemeColors() {
  return {
    dk1: "070154",
    lt1: "FFFFFF",
    dk2: "0047FF",
    lt2: "F6EB20",
    accent1: "F900D3",
    accent2: "50658E",
    accent3: "CED7E6",
    accent4: "E8EEF8",
    accent5: "00E8FA",
    accent6: "00A3FF",
    hlink: "0563C1",
    folHlink: "954F72"
  };
}
function mapSchemeColorKey2(value) {
  const aliases = {
    bg1: "lt1",
    tx1: "dk1",
    bg2: "lt2",
    tx2: "dk2"
  };
  return aliases[value] || value;
}
function extractBackgroundColor(root) {
  const background = findDescendant(root, "p:bg");
  const solidFill = findDescendant(background, "a:solidFill");
  const color = extractFillColorValue(solidFill);
  if (color.value) {
    return cleanHex(color.value);
  }
  if (color.scheme) {
    return cleanHex(schemeColorFallback(mapSchemeColorKey2(color.scheme)));
  }
  const backgroundRef = findDescendant(background, "p:bgRef");
  const refColor = cloneColorNode(backgroundRef);
  if (refColor?.tag === "a:srgbClr") {
    return cleanHex(refColor.attributes?.val);
  }
  if (refColor?.tag === "a:sysClr") {
    return cleanHex(refColor.attributes?.lastClr || refColor.attributes?.val);
  }
  if (refColor?.tag === "a:schemeClr") {
    return cleanHex(schemeColorFallback(mapSchemeColorKey2(refColor.attributes?.val ?? "")));
  }
  return void 0;
}
function cloneColorNode(fillNode) {
  return cloneNode((fillNode?.children ?? []).find((candidate) => isColorTag2(candidate.tag)));
}
function cloneNode(node) {
  if (!node) {
    return void 0;
  }
  return {
    tag: node.tag,
    attributes: node.attributes ? { ...node.attributes } : void 0,
    text: node.text,
    children: node.children?.map((entry) => cloneNode(entry)).filter((entry) => !!entry)
  };
}
function isColorTag2(tag) {
  return tag === "a:srgbClr" || tag === "a:sysClr" || tag === "a:schemeClr";
}
function isDarkHex(value) {
  const normalized = value.replace(/[^0-9A-Fa-f]/g, "").slice(0, 6);
  if (normalized.length !== 6) {
    return false;
  }
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return red * 0.299 + green * 0.587 + blue * 0.114 < 145;
}
function schemeColorFallback(value) {
  const fallback = {
    dk1: "000000",
    dk2: "1F2937",
    bg1: "FFFFFF",
    bg2: "F3F4F6",
    lt1: "FFFFFF",
    lt2: "F3F4F6",
    tx1: "111827",
    tx2: "374151",
    accent1: "0B075B",
    accent2: "F97316",
    accent3: "22C55E",
    accent4: "FACC15",
    accent5: "2563EB",
    accent6: "9333EA"
  };
  return value ? fallback[value] : void 0;
}

// server/src/lib/import/PowerpointTableExtractor.ts
function extractTableElements(node, matrix, pathLabel, baseIndex) {
  const table = findDescendant(node, "a:tbl");
  if (!table) {
    return [];
  }
  const nonVisual = extractNonVisual(node);
  const frame = extractElementTransform(node, matrix);
  const rows = children(table, "a:tr");
  const gridColumns = children(child(table, "a:tblGrid"), "a:gridCol");
  const columnCount = Math.max(
    gridColumns.length,
    ...rows.map((row) => children(row, "a:tc").reduce((sum2, cell) => sum2 + positiveInt(cell.attributes?.gridSpan, 1), 0)),
    1
  );
  const columnWidths = resolveTablePartSizes(
    gridColumns.map((column) => Number(column.attributes?.w) || 0),
    columnCount,
    frame.widthPx
  );
  const rowHeights = resolveTablePartSizes(
    rows.map((row) => Number(row.attributes?.h) || 0),
    Math.max(rows.length, 1),
    frame.heightPx,
    tableAutoRowWeights(rows, columnWidths)
  );
  const totalColumnWidth = positiveNumber(sum(columnWidths), 1);
  const totalRowHeight = positiveNumber(sum(rowHeights), 1);
  const elements = [];
  const fallbackLine = tableDefaultLine(table);
  rows.forEach((row, rowIndex) => {
    let columnIndex = 0;
    for (const cell of children(row, "a:tc")) {
      const gridSpan = Math.min(positiveInt(cell.attributes?.gridSpan, 1), columnCount - columnIndex);
      const rowSpan = Math.min(positiveInt(cell.attributes?.rowSpan, 1), rows.length - rowIndex);
      if (cell.attributes?.hMerge === "1" || cell.attributes?.vMerge === "1") {
        columnIndex += gridSpan;
        continue;
      }
      const cellWidth = frame.widthPx * sum(columnWidths.slice(columnIndex, columnIndex + gridSpan)) / totalColumnWidth;
      const cellHeight = frame.heightPx * sum(rowHeights.slice(rowIndex, rowIndex + rowSpan)) / totalRowHeight;
      const cellX = frame.xPx + frame.widthPx * sum(columnWidths.slice(0, columnIndex)) / totalColumnWidth;
      const cellY = frame.yPx + frame.heightPx * sum(rowHeights.slice(0, rowIndex)) / totalRowHeight;
      const idBase = nonVisual.id ? nonVisual.id * 1e3 : (baseIndex + 1) * 1e3;
      elements.push({
        path: `${pathLabel}#table[${baseIndex + 1}].row[${rowIndex + 1}].cell[${columnIndex + 1}]`,
        zIndex: baseIndex + elements.length / 1e3,
        tag: "a:tc",
        kind: "shape",
        nonVisual: {
          id: idBase + rowIndex * 100 + columnIndex + 1,
          name: `${nonVisual.name || "Table"} Cell ${rowIndex + 1}-${columnIndex + 1}`,
          hidden: nonVisual.hidden
        },
        transform: {
          xPx: round(cellX),
          yPx: round(cellY),
          widthPx: round(cellWidth),
          heightPx: round(cellHeight),
          rotation: frame.rotation,
          xInches: round(cellX / PX_PER_INCH, 4),
          yInches: round(cellY / PX_PER_INCH, 4),
          widthInches: round(cellWidth / PX_PER_INCH, 4),
          heightInches: round(cellHeight / PX_PER_INCH, 4)
        },
        presetGeometry: {
          preset: "rect"
        },
        relationshipIds: [],
        xmlAst: cell,
        text: extractText(child(cell, "a:txBody")),
        shapeProperties: tableCellShapeProperties(cell, fallbackLine),
        style: tableCellTextStyle(cell)
      });
      columnIndex += gridSpan;
    }
  });
  return elements;
}
function tableCellShapeProperties(cell, fallbackLine) {
  const tcPr = child(cell, "a:tcPr");
  const fill = cloneNode(child(tcPr, "a:solidFill"));
  const line = tableCellLineNode(tcPr) ?? cloneNode(fallbackLine);
  const shapeProperties = {
    tag: "p:spPr",
    children: []
  };
  if (fill) {
    shapeProperties.children?.push(fill);
  } else {
    shapeProperties.children?.push({ tag: "a:noFill", children: [] });
  }
  if (line) {
    shapeProperties.children?.push(line);
  }
  return shapeProperties;
}
function tableCellLineNode(tcPr) {
  const border = ["a:lnB", "a:lnT", "a:lnL", "a:lnR"].map((tag) => child(tcPr, tag)).find((line) => line && !hasChild2(line, "a:noFill"));
  if (!border) {
    return void 0;
  }
  return {
    ...cloneNode(border),
    tag: "a:ln"
  };
}
function tableDefaultLine(table) {
  const visibleLine = descendants(table, "a:tcPr").flatMap((tcPr) => ["a:lnB", "a:lnT", "a:lnL", "a:lnR"].map((tag) => child(tcPr, tag))).find((line) => line && !hasChild2(line, "a:noFill"));
  if (!visibleLine) {
    return void 0;
  }
  return {
    ...cloneNode(visibleLine),
    tag: "a:ln"
  };
}
function tableCellTextStyle(cell) {
  const txBody = child(cell, "a:txBody");
  const runColor = descendants(txBody, "a:rPr").map((runProperties) => cloneColorNode(child(runProperties, "a:solidFill"))).find((colorNode) => !!colorNode);
  const fillColor = tableCellFillColor(child(cell, "a:tcPr"));
  const fallbackColor = fillColor && isDarkHex(fillColor) ? "FFFFFF" : "111827";
  return {
    tag: "p:style",
    children: [
      {
        tag: "a:fontRef",
        children: [runColor ?? { tag: "a:srgbClr", attributes: { val: fallbackColor }, children: [] }]
      }
    ]
  };
}
function tableCellFillColor(tcPr) {
  const colorNode = cloneColorNode(child(tcPr, "a:solidFill"));
  if (!colorNode) {
    return void 0;
  }
  if (colorNode.tag === "a:srgbClr") {
    return colorNode.attributes?.val;
  }
  if (colorNode.tag === "a:sysClr") {
    return colorNode.attributes?.lastClr || colorNode.attributes?.val;
  }
  if (colorNode.tag === "a:schemeClr") {
    return schemeColorFallback(colorNode.attributes?.val);
  }
  return void 0;
}
function resolveTablePartSizes(values, count, totalSizePx, autoWeights = []) {
  const sourceValues = Array.from({ length: count }, (_, index) => values[index] ?? 0);
  const explicitSizes = sourceValues.map((value) => value > 0 ? value / EMU_PER_INCH * PX_PER_INCH : 0);
  const missingIndexes = explicitSizes.map((value, index) => value > 0 ? -1 : index).filter((index) => index >= 0);
  const targetSize = Math.max(totalSizePx, 0);
  if (!missingIndexes.length) {
    return scaleTableParts(explicitSizes, targetSize);
  }
  const explicitTotal = explicitSizes.reduce((total, value) => total + value, 0);
  const remainingSize = targetSize - explicitTotal;
  const resolved = [...explicitSizes];
  if (remainingSize > 0) {
    const missingWeightTotal = missingIndexes.reduce(
      (total, index) => total + positiveNumber(autoWeights[index], 1),
      0
    );
    for (const index of missingIndexes) {
      resolved[index] = remainingSize * positiveNumber(autoWeights[index], 1) / missingWeightTotal;
    }
    return resolved;
  }
  const explicitPerWeight = explicitSizes.map((value, index) => value / positiveNumber(autoWeights[index], 1)).filter((value) => value > 0).sort((left, right) => left - right);
  const typicalSizePerWeight = explicitPerWeight[Math.floor(explicitPerWeight.length / 2)] || targetSize / Math.max(count, 1) || 1;
  for (const index of missingIndexes) {
    resolved[index] = typicalSizePerWeight * positiveNumber(autoWeights[index], 1);
  }
  return scaleTableParts(resolved, targetSize);
}
function scaleTableParts(values, totalSizePx) {
  const currentTotal = values.reduce((total, value) => total + value, 0);
  if (currentTotal <= 0) {
    return values.map(() => totalSizePx / Math.max(values.length, 1));
  }
  return values.map((value) => value * totalSizePx / currentTotal);
}
function tableAutoRowWeights(rows, columnWidths) {
  return rows.map((row) => {
    let columnIndex = 0;
    let rowWeight = 1;
    for (const cell of children(row, "a:tc")) {
      const gridSpan = Math.min(
        positiveInt(cell.attributes?.gridSpan, 1),
        Math.max(columnWidths.length - columnIndex, 1)
      );
      const cellWidth = columnWidths.slice(columnIndex, columnIndex + gridSpan).reduce((total, width) => total + width, 0);
      if (cell.attributes?.hMerge !== "1" && cell.attributes?.vMerge !== "1") {
        const lineCount = estimateTableCellLineCount(cell, cellWidth);
        const rowSpan = positiveInt(cell.attributes?.rowSpan, 1);
        rowWeight = Math.max(rowWeight, (1 + Math.max(lineCount - 1, 0) * 0.5) / rowSpan);
      }
      columnIndex += gridSpan;
    }
    return rowWeight;
  });
}
function estimateTableCellLineCount(cell, cellWidthPx) {
  const textBody = extractText(child(cell, "a:txBody"));
  const logicalLines = (textBody?.plainText ?? "").split("\n");
  const fontSizePoints = tableCellFontSizePoints(cell);
  const tcPr = child(cell, "a:tcPr");
  const leftInset = tableCellInsetPx(tcPr?.attributes?.marL);
  const rightInset = tableCellInsetPx(tcPr?.attributes?.marR);
  const availableWidth = Math.max(cellWidthPx - leftInset - rightInset, fontSizePoints);
  const averageCharacterWidth = Math.max(fontSizePoints * (PX_PER_INCH / 72) * 0.46, 1);
  const lineCapacity = Math.max(Math.floor(availableWidth / averageCharacterWidth), 1);
  return Math.max(
    logicalLines.reduce(
      (total, line) => total + Math.max(Math.ceil(Math.max(line.trim().length, 1) / lineCapacity), 1),
      0
    ),
    1
  );
}
function tableCellFontSizePoints(cell) {
  const textBody = child(cell, "a:txBody");
  const sizeNode = [...descendants(textBody, "a:rPr"), ...descendants(textBody, "a:defRPr"), ...descendants(textBody, "a:endParaRPr")].find((node) => Number(node.attributes?.sz) > 0);
  const size = Number(sizeNode?.attributes?.sz);
  return Number.isFinite(size) && size > 0 ? size / 100 : 12;
}
function tableCellInsetPx(value) {
  const emu = Number(value);
  return Number.isFinite(emu) && emu >= 0 ? emu / EMU_PER_INCH * PX_PER_INCH : PX_PER_INCH * 0.1;
}

// server/src/lib/import/PowerpointImporter.ts
var DEFAULT_OUTPUT_SUFFIX = ".canvas.json";
async function importPowerPoint(options) {
  if (!options.inputPath.trim()) {
    throw new Error("inputPath is required.");
  }
  if (options.slide !== void 0 && (!Number.isInteger(options.slide) || options.slide < 1)) {
    throw new Error("slide must be a positive whole slide number.");
  }
  const workingDirectory = path6.resolve(options.workingDirectory ?? process.cwd());
  const inputPath = path6.resolve(workingDirectory, options.inputPath);
  const outputPath = resolveJsonOutputPath(inputPath, options.outputPath, workingDirectory);
  const outputDir = path6.dirname(outputPath);
  const zip = await JSZip2.loadAsync(await readFile(inputPath));
  const presentationXml = await readZipText(zip, "ppt/presentation.xml");
  const presentationRels = parseRelationships(
    await readZipText(zip, "ppt/_rels/presentation.xml.rels"),
    "ppt"
  );
  const slideSize = extractSlideSize(presentationXml);
  const slidePaths = extractSlidePaths(presentationXml, presentationRels);
  if (!slidePaths.length) {
    throw new Error("No slides were found in the PowerPoint deck.");
  }
  const selectedSlides = options.slide ? slidePaths.slice(options.slide - 1, options.slide) : slidePaths;
  if (options.slide && selectedSlides.length === 0) {
    throw new Error(`Slide ${options.slide} does not exist. The deck has ${slidePaths.length} slide(s).`);
  }
  await mkdir2(outputDir, { recursive: true });
  const warnings = [];
  const normalizedSlides = [];
  let deckTitle = path6.basename(inputPath, path6.extname(inputPath));
  for (const slidePath of selectedSlides) {
    const slideNumber = slidePaths.indexOf(slidePath) + 1;
    const extracted = await extractSlide(zip, inputPath, slidePath, slideNumber, slideSize);
    const { presentation, issues } = normalizePresentationSpec(extracted, {
      baseDir: outputDir
    });
    const errors = issues.filter((issue) => issue.level === "error");
    if (!presentation || errors.length) {
      const formatted = issues.map((issue) => `${issue.level.toUpperCase()} ${issue.path}: ${issue.message}`).join("\n");
      throw new Error(`Slide ${slideNumber} could not be normalized.
${formatted}`);
    }
    warnings.push(
      ...issues.filter((issue) => issue.level === "warning").map((issue) => `slide ${slideNumber}: ${issue.path}: ${issue.message}`)
    );
    applyExtractedTypography(presentation, extracted);
    normalizedSlides.push(...presentation.slides);
    if (normalizedSlides.length === 1) {
      deckTitle = presentation.meta.title || deckTitle;
    }
  }
  const compact = await compactPresentation(
    {
      meta: {
        title: deckTitle,
        width: slideSize.widthPx,
        height: slideSize.heightPx,
        preserveElementOrder: true,
        showBranding: false,
        sourceType: "native-presentation"
      },
      slides: normalizedSlides
    },
    outputPath,
    { embedAssets: options.embedAssets }
  );
  const roundTrip = normalizePresentationSpec(compact, { baseDir: outputDir });
  const roundTripErrors = roundTrip.issues.filter((issue) => issue.level === "error");
  if (!roundTrip.presentation || roundTripErrors.length) {
    throw new Error(
      `Generated JSON failed the TemplateCanvas contract:
${roundTripErrors.map((issue) => `${issue.path}: ${issue.message}`).join("\n")}`
    );
  }
  await writeFile2(outputPath, `${JSON.stringify(compact, null, 2)}
`, "utf8");
  return {
    inputPath,
    outputPath,
    jsonSpec: compact,
    warnings,
    sourceSlideCount: slidePaths.length,
    importedSlideCount: normalizedSlides.length
  };
}
function resolveJsonOutputPath(inputPath, outputArg, workingDirectory) {
  if (!outputArg) {
    return path6.join(
      path6.dirname(inputPath),
      `${path6.basename(inputPath, path6.extname(inputPath))}${DEFAULT_OUTPUT_SUFFIX}`
    );
  }
  const resolved = path6.resolve(workingDirectory, outputArg);
  if (path6.extname(resolved).toLowerCase() === ".json") {
    return resolved;
  }
  return path6.join(
    resolved,
    `${path6.basename(inputPath, path6.extname(inputPath))}${DEFAULT_OUTPUT_SUFFIX}`
  );
}
async function extractSlide(zip, sourcePptx, slidePath, slideNumber, slideSize) {
  const slideXml = await readZipText(zip, slidePath);
  const relationshipsPath = relationshipPathFor(slidePath);
  const rawRelationshipsXml = await maybeReadZipText(zip, relationshipsPath);
  const relationships = rawRelationshipsXml ? parseRelationships(rawRelationshipsXml, path6.posix.dirname(slidePath)) : [];
  const slideAst = parseXml(slideXml);
  const inherited = await extractInheritedSlideParts(zip, relationships, slideSize);
  const showMasterShapes = findDescendant(slideAst, "p:sld")?.attributes?.showMasterSp !== "0";
  const slideBackgroundElement = extractBackgroundImageElement(
    slideAst,
    slidePath,
    "Slide",
    -2500,
    slideSize
  );
  const shapeTree = findDescendant(slideAst, "p:spTree");
  const slideElements = shapeTree ? extractShapeTreeElements(
    shapeTree,
    identityTransform(),
    slidePath,
    inherited.placeholderSources
  ) : [];
  const baseElements = [
    ...showMasterShapes ? inherited.masterElements : [],
    ...inherited.layoutElements,
    ...slideBackgroundElement ? [slideBackgroundElement] : []
  ];
  const elements = [
    ...baseElements,
    ...slideElements.map((element) => ({
      ...element,
      zIndex: coerceNumber(element.zIndex, 0) + baseElements.length
    }))
  ];
  const allRelationships = [...inherited.relationships, ...relationships];
  return {
    sourcePptx,
    slideNumber,
    slidePath,
    relationshipsPath,
    relationships: allRelationships,
    rawRelationshipsXml,
    relationshipIds: Array.from(new Set(elements.flatMap((element) => element.relationshipIds ?? []))),
    slideSize: {
      cx: slideSize.cx,
      cy: slideSize.cy,
      widthInches: round(slideSize.cx / EMU_PER_INCH, 4),
      heightInches: round(slideSize.cy / EMU_PER_INCH, 4),
      widthPx: slideSize.widthPx,
      heightPx: slideSize.heightPx
    },
    shapeTree: {
      elements
    },
    supportParts: await collectSupportParts(zip, allRelationships),
    backgroundColor: extractBackgroundColor(slideAst) || inherited.backgroundColor,
    rawXml: slideXml,
    summary: {
      totalDrawableElements: elements.length,
      textElementCount: elements.filter((element) => !!paragraphText2(element.text)).length
    }
  };
}
async function extractInheritedSlideParts(zip, slideRelationships, slideSize) {
  const layoutRelationship = slideRelationships.find(
    (relationship) => relationship.Type?.includes("/slideLayout")
  );
  const layout = layoutRelationship?.resolvedTarget ? await extractRelatedDrawablePart(zip, layoutRelationship.resolvedTarget, "layout", -2e3, slideSize) : emptyDrawablePart();
  const masterRelationship = layout.rawRelationships.find(
    (relationship) => relationship.Type?.includes("/slideMaster")
  );
  const master = masterRelationship?.resolvedTarget ? await extractRelatedDrawablePart(zip, masterRelationship.resolvedTarget, "master", -3e3, slideSize) : emptyDrawablePart();
  return {
    masterElements: layout.showMasterShapes ? master.elements : [],
    layoutElements: layout.elements,
    relationships: [...master.relationships, ...layout.relationships],
    backgroundColor: layout.backgroundColor || master.backgroundColor,
    placeholderSources: {
      layout: layout.placeholderNodes,
      master: master.placeholderNodes
    }
  };
}
async function extractRelatedDrawablePart(zip, partPath, label, zOffset, slideSize) {
  const rawXml = await maybeReadZipText(zip, partPath);
  if (!rawXml) {
    return emptyDrawablePart();
  }
  const relationshipsPath = relationshipPathFor(partPath);
  const rawRelationshipsXml = await maybeReadZipText(zip, relationshipsPath);
  const relationships = rawRelationshipsXml ? parseRelationships(rawRelationshipsXml, path6.posix.dirname(partPath)) : [];
  const scopedRelationships = relationships.map((relationship) => ({
    ...relationship,
    Id: scopedRelationshipId(partPath, relationship.Id)
  }));
  const partAst = parseXml(rawXml);
  const backgroundElement = extractBackgroundImageElement(
    partAst,
    `${partPath}#${label}`,
    `${label[0]?.toUpperCase() ?? ""}${label.slice(1)}`,
    zOffset - 1e3,
    slideSize,
    partPath
  );
  const shapeTree = findDescendant(partAst, "p:spTree");
  const placeholderNodes = shapeTree ? descendants(shapeTree, "p:sp").filter((node) => !!extractNonVisual(node).placeholder) : [];
  const drawableElements = shapeTree ? extractShapeTreeElements(shapeTree, identityTransform(), `${partPath}#${label}`).map((element) => ({
    ...element,
    relationshipIds: element.relationshipIds?.map(
      (relationshipId) => scopedRelationshipId(partPath, relationshipId)
    ),
    zIndex: zOffset + coerceNumber(element.zIndex, 0)
  })) : [];
  const elements = [
    ...backgroundElement ? [backgroundElement] : [],
    ...drawableElements
  ].filter((element) => shouldKeepInheritedElement(element, scopedRelationships, slideSize));
  return {
    elements,
    relationships: scopedRelationships,
    rawRelationships: relationships,
    backgroundColor: extractBackgroundColor(partAst),
    placeholderNodes,
    showMasterShapes: findDescendant(partAst, "p:sldLayout")?.attributes?.showMasterSp !== "0"
  };
}
function extractBackgroundImageElement(root, pathLabel, label, zIndex, slideSize, relationshipScope) {
  const background = findDescendant(root, "p:bg");
  const blipFill = findDescendant(background, "a:blipFill");
  const blip = findDescendant(blipFill, "a:blip");
  const relationshipId = blip?.attributes?.["r:embed"] || blip?.attributes?.["r:link"];
  if (!relationshipId) {
    return void 0;
  }
  const scopedId = relationshipScope ? scopedRelationshipId(relationshipScope, relationshipId) : relationshipId;
  const id = 9e5 + Math.abs(Math.trunc(zIndex));
  return {
    path: `${pathLabel}#background-image`,
    zIndex,
    tag: "p:bg",
    kind: "graphicFrame",
    nonVisual: {
      id,
      name: `${label} Background Image`
    },
    transform: {
      xPx: 0,
      yPx: 0,
      widthPx: slideSize.widthPx,
      heightPx: slideSize.heightPx,
      rotation: 0,
      xInches: 0,
      yInches: 0,
      widthInches: round(slideSize.widthPx / PX_PER_INCH, 4),
      heightInches: round(slideSize.heightPx / PX_PER_INCH, 4)
    },
    relationshipIds: [scopedId],
    xmlAst: background
  };
}
function emptyDrawablePart() {
  return {
    elements: [],
    relationships: [],
    rawRelationships: [],
    backgroundColor: void 0,
    placeholderNodes: [],
    showMasterShapes: true
  };
}
function scopedRelationshipId(partPath, relationshipId) {
  return `${partPath}:${relationshipId}`;
}
function shouldKeepInheritedElement(element, relationships, slideSize) {
  const nonVisual = element.nonVisual;
  if (nonVisual?.placeholder) {
    return false;
  }
  const text = paragraphText2(element.text).replace(/\s+/g, " ").trim().toLowerCase();
  if (text.includes("click to edit master") || text.includes("edit master text styles") || text.includes("master title style")) {
    return false;
  }
  if (element.kind === "graphicFrame") {
    return (element.relationshipIds ?? []).every((relationshipId) => {
      const relationship = relationships.find((entry) => entry.Id === relationshipId);
      const extension = (relationship?.resolvedTarget || relationship?.Target || "").split(".").pop()?.toLowerCase();
      return extension !== "emf" && extension !== "wmf";
    });
  }
  if (slideSize && isCompletelyOutsideSlide(element, slideSize)) {
    return false;
  }
  return true;
}
function isCompletelyOutsideSlide(element, slideSize) {
  const transform = element.transform;
  const x = coerceNumber(transform?.xPx, 0);
  const y = coerceNumber(transform?.yPx, 0);
  const width = coerceNumber(transform?.widthPx, 0);
  const height = coerceNumber(transform?.heightPx, 0);
  const tolerance = 1;
  return x + width < -tolerance || y + height < -tolerance || x > slideSize.widthPx + tolerance || y > slideSize.heightPx + tolerance;
}
function extractShapeTreeElements(parent, matrix, pathLabel, placeholderIndex) {
  const elements = [];
  for (const node of parent.children ?? []) {
    if (node.tag === "p:grpSp") {
      const groupMatrix = composeTransform(matrix, groupTransform(node));
      elements.push(...extractShapeTreeElements(node, groupMatrix, pathLabel, placeholderIndex));
      continue;
    }
    if (!["p:sp", "p:cxnSp", "p:pic", "p:graphicFrame"].includes(node.tag)) {
      continue;
    }
    if (node.tag === "p:graphicFrame" && findDescendant(node, "a:tbl")) {
      elements.push(...extractTableElements(node, matrix, pathLabel, elements.length));
      continue;
    }
    const nonVisual = extractNonVisual(node);
    const placeholderSources = findPlaceholderSources(nonVisual.placeholder, placeholderIndex);
    const transform = extractElementTransform(node, matrix, placeholderSources);
    const shapeProperties = mergeShapeProperties(
      child(node, "p:spPr"),
      placeholderSources.map((source) => child(source, "p:spPr"))
    );
    const style = child(node, "p:style") ?? firstDefined(
      placeholderSources.map((source) => child(source, "p:style"))
    );
    const text = extractText(
      child(node, "p:txBody"),
      placeholderSources.map((source) => child(source, "p:txBody"))
    );
    const preset = child(shapeProperties, "a:prstGeom")?.attributes?.prst;
    const relationshipIds = Array.from(new Set(collectRelationshipIds(node)));
    elements.push({
      path: `${pathLabel}#${node.tag}[${elements.length + 1}]`,
      zIndex: elements.length,
      tag: node.tag,
      kind: node.tag === "p:cxnSp" ? "connector" : node.tag === "p:graphicFrame" || node.tag === "p:pic" ? "graphicFrame" : "shape",
      nonVisual,
      transform,
      presetGeometry: preset ? {
        preset,
        xmlAst: child(shapeProperties, "a:prstGeom")
      } : void 0,
      relationshipIds,
      xmlAst: node,
      text,
      shapeProperties,
      style
    });
  }
  return elements;
}
function findPlaceholderSources(placeholder, index) {
  if (!placeholder || !index) {
    return [];
  }
  return [
    findMatchingPlaceholder(index.layout, placeholder),
    findMatchingPlaceholder(index.master, placeholder)
  ].filter((node) => !!node);
}
function findMatchingPlaceholder(candidates, placeholder) {
  return candidates.find((candidate) => {
    const candidatePlaceholder = extractNonVisual(candidate).placeholder;
    if (!candidatePlaceholder) {
      return false;
    }
    if (placeholder.idx && candidatePlaceholder.idx) {
      return placeholder.idx === candidatePlaceholder.idx;
    }
    const expectedType = placeholder.type || "body";
    const candidateType = candidatePlaceholder.type || "body";
    return expectedType === candidateType;
  });
}
function mergeShapeProperties(primary, fallbacks) {
  if (!primary && !fallbacks.some(Boolean)) {
    return void 0;
  }
  const merged = cloneNode(primary) ?? { tag: "p:spPr", children: [] };
  const existingTags = new Set((merged.children ?? []).map((node) => node.tag));
  for (const fallback of fallbacks) {
    for (const fallbackChild of fallback?.children ?? []) {
      if (!existingTags.has(fallbackChild.tag)) {
        const cloned = cloneNode(fallbackChild);
        if (cloned) {
          merged.children?.push(cloned);
          existingTags.add(fallbackChild.tag);
        }
      }
    }
  }
  return merged;
}

// server/src/services/PowerPointConverter.ts
var LibraryPowerPointConverter = class {
  async convert(source) {
    validatePowerPointPackage(source);
    const workingDirectory = await mkdtemp(path7.join(tmpdir(), "tts-mermaid-import-"));
    const inputPath = path7.join(workingDirectory, "upload.pptx");
    const outputPath = path7.join(workingDirectory, "upload.canvas.json");
    try {
      await writeFile3(inputPath, source);
      const result = await runImporter(inputPath, outputPath);
      return {
        templateJson: result.jsonSpec,
        warnings: result.warnings
      };
    } finally {
      await rm(workingDirectory, { force: true, recursive: true });
    }
  }
};
async function runImporter(inputPath, outputPath) {
  try {
    return await importPowerPoint({
      embedAssets: true,
      inputPath,
      outputPath
    });
  } catch (error) {
    throw new ApiError(
      422,
      "invalid_powerpoint",
      "The uploaded file is not a supported PowerPoint OOXML presentation.",
      { cause: error }
    );
  }
}
function validatePowerPointPackage(source) {
  const endOfDirectory = findEndOfCentralDirectory(source);
  if (endOfDirectory === void 0) {
    throw invalidPowerPointError();
  }
  const diskNumber = source.readUInt16LE(endOfDirectory + 4);
  const centralDirectoryDisk = source.readUInt16LE(endOfDirectory + 6);
  const entryCount = source.readUInt16LE(endOfDirectory + 10);
  const directorySize = source.readUInt32LE(endOfDirectory + 12);
  const directoryOffset = source.readUInt32LE(endOfDirectory + 16);
  if (diskNumber !== 0 || centralDirectoryDisk !== 0 || entryCount === 65535 || directorySize === 4294967295 || directoryOffset === 4294967295 || entryCount > 1e4 || directoryOffset + directorySize > endOfDirectory) {
    throw invalidPowerPointError();
  }
  const requiredParts = /* @__PURE__ */ new Set([
    "[Content_Types].xml",
    "ppt/presentation.xml",
    "ppt/_rels/presentation.xml.rels"
  ]);
  let offset = directoryOffset;
  let uncompressedBytes = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > source.length || source.readUInt32LE(offset) !== 33639248) {
      throw invalidPowerPointError();
    }
    const entryBytes = source.readUInt32LE(offset + 24);
    const nameLength = source.readUInt16LE(offset + 28);
    const extraLength = source.readUInt16LE(offset + 30);
    const commentLength = source.readUInt16LE(offset + 32);
    const nextOffset = offset + 46 + nameLength + extraLength + commentLength;
    if (entryBytes === 4294967295 || nextOffset > source.length) {
      throw invalidPowerPointError();
    }
    uncompressedBytes += entryBytes;
    if (entryBytes > 50 * 1024 * 1024 || uncompressedBytes > 250 * 1024 * 1024) {
      throw new ApiError(
        413,
        "powerpoint_too_large",
        "The expanded PowerPoint package exceeds the processing limit."
      );
    }
    const entryName = source.toString("utf8", offset + 46, offset + 46 + nameLength);
    if (entryName.startsWith("/") || entryName.split("/").includes("..")) {
      throw invalidPowerPointError();
    }
    requiredParts.delete(entryName);
    offset = nextOffset;
  }
  if (offset !== directoryOffset + directorySize || requiredParts.size > 0) {
    throw invalidPowerPointError();
  }
}
function findEndOfCentralDirectory(source) {
  const minimumOffset = Math.max(0, source.length - 65557);
  for (let offset = source.length - 22; offset >= minimumOffset; offset -= 1) {
    if (source.readUInt32LE(offset) === 101010256) {
      return offset;
    }
  }
  return void 0;
}
function invalidPowerPointError() {
  return new ApiError(
    422,
    "invalid_powerpoint",
    "The uploaded file is not a supported PowerPoint OOXML presentation."
  );
}

// server/src/server.ts
var config = loadServerConfig();
var templates = new SqliteTemplateRepository(config.databasePath);
var exportService = new ExportPowerPointService();
var importService = new ImportTemplateService(new LibraryPowerPointConverter(), templates);
var server = createServer(createApp({
  exportService,
  healthCheck: () => templates.checkHealth(),
  importService,
  maxExportJsonBytes: config.maxExportJsonBytes,
  maxUploadBytes: config.maxUploadBytes
}));
server.listen(config.port, () => {
  console.log(`PowerPoint API listening on port ${config.port}.`);
});
var shuttingDown = false;
function shutdown() {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  const forceCloseTimer = setTimeout(() => {
    server.closeAllConnections();
  }, 1e4);
  forceCloseTimer.unref();
  server.close((error) => {
    clearTimeout(forceCloseTimer);
    templates.close();
    if (error) {
      console.error("The PowerPoint API did not shut down cleanly.");
      process.exitCode = 1;
    }
  });
  server.closeIdleConnections();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
