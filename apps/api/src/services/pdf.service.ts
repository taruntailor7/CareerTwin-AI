import PDFDocument from "pdfkit";
import type { CareerScorecard, Profile, Report, SimulationResult, SimulationScenarioResult } from "../types/domain.js";
import { deriveReportSections } from "../features/reports/report.service.js";

const COLOR = {
  accent: "#7c5cff",
  accentMid: "#a855f7",
  accent2: "#06b6d4",
  accent2Soft: "#dff8fc",
  accent3: "#f59e0b",
  accent3Soft: "#fff3dc",
  success: "#10b981",
  successSoft: "#e1f8ef",
  danger: "#f43f5e",
  dangerSoft: "#fde6ea",
  ink: "#171426",
  muted: "#6b6b80",
  surface: "#ffffff",
  surfaceSoft: "#f1eefb",
  border: "#e3ddf5",
  white: "#ffffff"
} as const;

const MARGIN = 40;

const EVIDENCE_TONES: Record<string, { label: string; color: string; soft: string }> = {
  user_input: { label: "YOU SAID", color: COLOR.accent, soft: COLOR.surfaceSoft },
  imported_profile: { label: "FROM PROFILE", color: COLOR.accent2, soft: COLOR.accent2Soft },
  market_signal: { label: "MARKET SIGNAL", color: COLOR.accent3, soft: COLOR.accent3Soft },
  inferred: { label: "AI INFERRED", color: COLOR.success, soft: COLOR.successSoft }
};

const SCENARIO_COLORS = [COLOR.accent, COLOR.accent2, COLOR.accent3, COLOR.success];

function tierColor(score: number): string {
  if (score >= 75) return COLOR.success;
  if (score >= 50) return COLOR.accent3;
  return COLOR.danger;
}

function tierLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Strong";
  if (score >= 50) return "Developing";
  return "Needs attention";
}

/** Tracks the running vertical position for the fully custom (absolute-position) layout below. */
class Cursor {
  y: number;
  constructor(y: number) {
    this.y = y;
  }
}

function contentWidth(doc: PDFKit.PDFDocument): number {
  return doc.page.width - MARGIN * 2;
}

function pageBottom(doc: PDFKit.PDFDocument): number {
  return doc.page.height - MARGIN;
}

function ensureSpace(doc: PDFKit.PDFDocument, cursor: Cursor, height: number) {
  if (cursor.y + height > pageBottom(doc)) {
    doc.addPage();
    cursor.y = MARGIN;
  }
}

/** Draws a bold section title with a small colored tag, matching the dashboard's card headers. */
function sectionHeader(doc: PDFKit.PDFDocument, cursor: Cursor, title: string, subtitle?: string) {
  ensureSpace(doc, cursor, 40);
  doc.roundedRect(MARGIN, cursor.y, 4, 16, 2).fill(COLOR.accent);
  doc
    .fillColor(COLOR.ink)
    .font("Helvetica-Bold")
    .fontSize(14)
    .text(title, MARGIN + 12, cursor.y - 1, { lineBreak: false });
  cursor.y += 20;
  if (subtitle) {
    doc.fillColor(COLOR.muted).font("Helvetica").fontSize(9).text(subtitle, MARGIN + 12, cursor.y, { width: contentWidth(doc) - 12 });
    cursor.y = Math.max(cursor.y, doc.y) + 8;
  } else {
    cursor.y += 4;
  }
}

/** A ring/donut gauge, approximated with straight sub-segments since pdfkit has no native partial-arc primitive. */
function drawRing(
  doc: PDFKit.PDFDocument,
  centerX: number,
  centerY: number,
  radius: number,
  score: number,
  options: { lineWidth?: number; color?: string; label?: string; textColor?: string; labelColor?: string; trackColor?: string } = {}
) {
  const lineWidth = options.lineWidth ?? 9;
  const color = options.color ?? tierColor(score);
  const textColor = options.textColor ?? COLOR.ink;
  const labelColor = options.labelColor ?? COLOR.muted;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const startAngle = -Math.PI / 2;
  const segments = 72;

  doc.lineWidth(lineWidth).strokeColor(options.trackColor ?? COLOR.border).lineCap("butt");
  doc.circle(centerX, centerY, radius).stroke();

  if (pct > 0) {
    const endAngle = startAngle + pct * 2 * Math.PI;
    doc.lineWidth(lineWidth).strokeColor(color).lineCap("round");
    const steps = Math.max(1, Math.round(segments * pct));
    doc.moveTo(centerX + radius * Math.cos(startAngle), centerY + radius * Math.sin(startAngle));
    for (let i = 1; i <= steps; i += 1) {
      const angle = startAngle + (i / segments) * 2 * Math.PI;
      const clampedAngle = Math.min(angle, endAngle);
      doc.lineTo(centerX + radius * Math.cos(clampedAngle), centerY + radius * Math.sin(clampedAngle));
    }
    doc.stroke();
  }

  const scoreText = String(Math.round(score));
  doc.font("Helvetica-Bold").fontSize(Math.max(11, Math.round(radius * 0.52)));
  const textWidth = doc.widthOfString(scoreText);
  doc.fillColor(textColor).text(scoreText, centerX - textWidth / 2, centerY - radius * 0.32, { lineBreak: false });
  if (options.label) {
    const maxLabelWidth = radius * 1.7;
    let labelFontSize = 7.5;
    doc.font("Helvetica").fontSize(labelFontSize);
    const label = options.label.toUpperCase();
    while (doc.widthOfString(label) > maxLabelWidth && labelFontSize > 5) {
      labelFontSize -= 0.5;
      doc.fontSize(labelFontSize);
    }
    const labelWidth = doc.widthOfString(label);
    doc.fillColor(labelColor).text(label, centerX - labelWidth / 2, centerY + radius * 0.28, { lineBreak: false });
  }
}

/** A horizontal progress bar with rounded ends, used for score cards and confidence bands. */
function drawBar(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  pct: number,
  color: string,
  options: { height?: number; trackColor?: string } = {}
) {
  const height = options.height ?? 6;
  const clamped = Math.max(0, Math.min(1, pct));
  doc.roundedRect(x, y, width, height, height / 2).fill(options.trackColor ?? COLOR.border);
  if (clamped > 0) {
    doc.roundedRect(x, y, Math.max(height, width * clamped), height, height / 2).fill(color);
  }
}

/** Wraps a row of pill-shaped chips, auto-flowing onto new lines/pages as needed. */
function drawChips(
  doc: PDFKit.PDFDocument,
  cursor: Cursor,
  items: string[],
  options: { bg?: string; textColor?: string; fontSize?: number } = {}
) {
  if (!items.length) return;
  const bg = options.bg ?? COLOR.surfaceSoft;
  const textColor = options.textColor ?? COLOR.ink;
  const fontSize = options.fontSize ?? 9;
  const paddingX = 8;
  const chipHeight = fontSize + 10;
  const gap = 6;
  const maxX = MARGIN + contentWidth(doc);

  doc.font("Helvetica").fontSize(fontSize);
  let x = MARGIN;
  ensureSpace(doc, cursor, chipHeight + 4);
  items.forEach((rawItem) => {
    const item = rawItem.length > 60 ? `${rawItem.slice(0, 57)}...` : rawItem;
    const chipWidth = doc.widthOfString(item) + paddingX * 2;
    if (x + chipWidth > maxX) {
      x = MARGIN;
      cursor.y += chipHeight + gap;
      ensureSpace(doc, cursor, chipHeight + 4);
    }
    doc.roundedRect(x, cursor.y, chipWidth, chipHeight, chipHeight / 2).fill(bg);
    doc.fillColor(textColor).text(item, x + paddingX, cursor.y + (chipHeight - fontSize) / 2 - 1, { lineBreak: false });
    x += chipWidth + gap;
  });
  cursor.y += chipHeight + 10;
}

/** A checklist/action-plan row with a small numbered or dot badge. */
function drawListRow(
  doc: PDFKit.PDFDocument,
  cursor: Cursor,
  text: string,
  options: { badge?: string; badgeColor?: string; dotColor?: string } = {}
) {
  const width = contentWidth(doc);
  const textX = MARGIN + 28;
  const textWidth = width - 28;
  doc.font("Helvetica").fontSize(10);
  const textHeight = doc.heightOfString(text, { width: textWidth });
  const rowHeight = Math.max(22, textHeight + 6);
  ensureSpace(doc, cursor, rowHeight);

  if (options.badge !== undefined) {
    const badgeColor = options.badgeColor ?? COLOR.accent;
    doc.circle(MARGIN + 9, cursor.y + 9, 9).fill(badgeColor);
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(COLOR.white);
    const badgeWidth = doc.widthOfString(options.badge);
    doc.text(options.badge, MARGIN + 9 - badgeWidth / 2, cursor.y + 4.5, { lineBreak: false });
  } else {
    doc.circle(MARGIN + 9, cursor.y + 9, 3.5).fill(options.dotColor ?? COLOR.accent);
  }

  doc.font("Helvetica").fontSize(10).fillColor(COLOR.ink).text(text, textX, cursor.y, { width: textWidth });
  cursor.y += rowHeight + 6;
}

/** Two-tone callout card (e.g. strengths in green, risks in red) with an icon badge per row. */
function drawToneCard(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  title: string,
  items: string[],
  tone: { bg: string; accent: string; icon: "check" | "warn" }
): number {
  const paddingX = 14;
  const paddingTop = 14;
  const contentW = width - paddingX * 2;
  doc.font("Helvetica").fontSize(9.5);
  const rowHeights = items.map((item) => Math.max(16, doc.heightOfString(item, { width: contentW - 22 }) + 4));
  const bodyHeight = rowHeights.reduce((sum, h) => sum + h, 0);
  const cardHeight = paddingTop + 20 + bodyHeight + 16;

  doc.roundedRect(x, y, width, cardHeight, 10).fill(tone.bg);
  doc.fillColor(tone.accent).font("Helvetica-Bold").fontSize(10.5).text(title.toUpperCase(), x + paddingX, y + paddingTop, {
    lineBreak: false
  });

  let rowY = y + paddingTop + 22;
  items.forEach((item, index) => {
    const iconCx = x + paddingX + 6;
    const iconCy = rowY + 6;
    if (tone.icon === "check") {
      doc.circle(iconCx, iconCy, 6).fill(tone.accent);
      doc
        .strokeColor(COLOR.white)
        .lineWidth(1.3)
        .moveTo(iconCx - 3, iconCy)
        .lineTo(iconCx - 0.5, iconCy + 2.5)
        .lineTo(iconCx + 3.2, iconCy - 3)
        .stroke();
    } else {
      doc.polygon([iconCx, iconCy - 6.5], [iconCx - 6, iconCy + 5], [iconCx + 6, iconCy + 5]).fill(tone.accent);
      doc.fillColor(COLOR.white).font("Helvetica-Bold").fontSize(7.5).text("!", iconCx - 1.5, iconCy - 1.5, { lineBreak: false });
    }
    doc
      .fillColor(COLOR.ink)
      .font("Helvetica")
      .fontSize(9.5)
      .text(item, x + paddingX + 18, rowY, { width: contentW - 22 });
    rowY += rowHeights[index];
  });

  return cardHeight;
}

export function buildReportPdfStream(params: {
  report: Report;
  profile: Profile;
  simulation: SimulationResult;
  scorecard: CareerScorecard | null;
}): PDFKit.PDFDocument {
  const { report, profile, simulation, scorecard } = params;
  const { bestScenario, strengths, risks } = deriveReportSections(profile, simulation);
  const doc = new PDFDocument({ margin: MARGIN, size: "A4", bufferPages: true });
  const width = contentWidth(doc);
  const cursor = new Cursor(0);

  drawCoverBanner(doc, report, profile, bestScenario, scorecard);
  cursor.y = 168;

  drawStatStrip(doc, cursor, profile, scorecard, bestScenario);
  drawExecutiveSummary(doc, cursor, report.summary);
  drawCareerOverview(doc, cursor, profile);

  if (scorecard) {
    ensureSpace(doc, cursor, 160);
    cursor.y += 8;
    drawScorecardSection(doc, cursor, scorecard);
  }

  ensureSpace(doc, cursor, 160);
  cursor.y += 8;
  if (bestScenario) drawBestScenario(doc, cursor, bestScenario);
  drawStrengthsAndRisks(doc, cursor, width, strengths, risks);
  sectionHeader(doc, cursor, "Planning Assumptions");
  simulation.assumptions.forEach((item) => drawListRow(doc, cursor, item, { dotColor: COLOR.accent }));

  if (simulation.scenarios.length) {
    ensureSpace(doc, cursor, 160);
    cursor.y += 8;
    drawScenarioComparison(doc, cursor, simulation.scenarios);
  }

  ensureSpace(doc, cursor, 160);
  cursor.y += 8;
  sectionHeader(doc, cursor, "Recommended Action Plan", "Prioritized next steps to close your biggest gaps first.");
  simulation.actionPlan.forEach((item, index) =>
    drawListRow(doc, cursor, item, { badge: String(index + 1), badgeColor: COLOR.accent })
  );

  cursor.y += 6;
  sectionHeader(doc, cursor, "Future Timeline", "Where this path is projected to take you.");
  drawTimeline(doc, cursor, simulation.timeline);

  cursor.y += 6;
  sectionHeader(doc, cursor, "Evidence Ledger", "Every insight above is traceable back to one of these sources.");
  drawEvidenceLedger(doc, cursor, width, simulation.evidenceRefs);

  cursor.y += 6;
  drawConfidenceCard(doc, cursor, width, simulation);

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    drawFooter(doc, i - range.start + 1, range.count);
  }

  doc.end();
  return doc;
}

function drawCoverBanner(
  doc: PDFKit.PDFDocument,
  report: Report,
  profile: Profile,
  bestScenario: SimulationScenarioResult | null,
  scorecard: CareerScorecard | null
) {
  const bannerHeight = 150;
  const gradient = doc.linearGradient(0, 0, doc.page.width, bannerHeight);
  gradient.stop(0, COLOR.accent).stop(0.55, COLOR.accentMid).stop(1, COLOR.accent2);
  doc.rect(0, 0, doc.page.width, bannerHeight).fill(gradient);

  doc.fillColor(COLOR.white).font("Helvetica-Bold").fontSize(11).text("CAREERTWIN AI", MARGIN, 28, { lineBreak: false });
  doc
    .fillColor("rgba(255,255,255,0.85)")
    .font("Helvetica")
    .fontSize(9)
    .text("AI Career Intelligence Report", MARGIN, 44, { lineBreak: false });
  doc
    .fillColor(COLOR.white)
    .font("Helvetica-Bold")
    .fontSize(22)
    .text(report.title, MARGIN, 64, { width: doc.page.width - MARGIN * 2 - 130 });
  doc
    .fillColor("rgba(255,255,255,0.8)")
    .font("Helvetica")
    .fontSize(9)
    .text(
      `${profile.fullName} · Generated ${new Date(report.createdAt).toLocaleDateString()} · Audience: ${report.audience}`,
      MARGIN,
      Math.max(doc.y + 4, 100),
      { lineBreak: false }
    );

  if (scorecard) {
    drawRing(doc, doc.page.width - MARGIN - 40, 75, 32, scorecard.overallScore, {
      lineWidth: 7,
      color: COLOR.white,
      trackColor: "rgba(255,255,255,0.35)",
      textColor: COLOR.white,
      labelColor: "rgba(255,255,255,0.85)",
      label: "Score"
    });
  } else if (bestScenario) {
    drawRing(doc, doc.page.width - MARGIN - 40, 75, 32, bestScenario.successProbability, {
      lineWidth: 7,
      color: COLOR.white,
      trackColor: "rgba(255,255,255,0.35)",
      textColor: COLOR.white,
      labelColor: "rgba(255,255,255,0.85)",
      label: "Best-fit path"
    });
  }
}

function drawStatStrip(
  doc: PDFKit.PDFDocument,
  cursor: Cursor,
  profile: Profile,
  scorecard: CareerScorecard | null,
  bestScenario: SimulationScenarioResult | null
) {
  const width = contentWidth(doc);
  const gap = 10;
  const cardWidth = (width - gap * 3) / 4;
  const cardHeight = 56;
  const stats: Array<{ label: string; value: string }> = [
    { label: "Overall Score", value: scorecard ? `${scorecard.overallScore}/100` : "Not scored" },
    { label: "Experience", value: `${profile.yearsExperience} yrs` },
    { label: "Best-Fit Path", value: bestScenario?.name ?? "Not simulated" },
    { label: "Modeled Success", value: bestScenario ? `${bestScenario.successProbability}%` : "—" }
  ];

  stats.forEach((stat, index) => {
    const x = MARGIN + index * (cardWidth + gap);
    const valueWidth = cardWidth - 20;
    doc.roundedRect(x, cursor.y, cardWidth, cardHeight, 8).fillAndStroke(COLOR.surfaceSoft, COLOR.border);
    doc.fillColor(COLOR.muted).font("Helvetica").fontSize(7.5).text(stat.label.toUpperCase(), x + 10, cursor.y + 10, {
      width: valueWidth,
      lineBreak: false
    });

    // Long scenario names (e.g. "Best-Fit Path") need to shrink to fit a single line rather than
    // wrap into the fixed-height card and get clipped mid-word. PDFKit only truncates with an
    // ellipsis when `height` caps it to one line — `lineBreak: false` alone does not prevent wrap.
    doc.font("Helvetica-Bold");
    let valueFontSize = 11.5;
    doc.fontSize(valueFontSize);
    while (doc.widthOfString(stat.value) > valueWidth && valueFontSize > 8) {
      valueFontSize -= 0.5;
      doc.fontSize(valueFontSize);
    }
    const lineHeight = doc.currentLineHeight(true);
    doc.fillColor(COLOR.ink).text(stat.value, x + 10, cursor.y + 30 - valueFontSize / 2, {
      width: valueWidth,
      height: lineHeight,
      ellipsis: true
    });
  });

  cursor.y += cardHeight + 18;
}

function drawExecutiveSummary(doc: PDFKit.PDFDocument, cursor: Cursor, summary: string) {
  const width = contentWidth(doc);
  const innerWidth = width - 32;
  doc.font("Helvetica").fontSize(10.5);
  const textHeight = doc.heightOfString(summary, { width: innerWidth });
  const boxHeight = textHeight + 44;
  ensureSpace(doc, cursor, boxHeight);

  doc.roundedRect(MARGIN, cursor.y, width, boxHeight, 10).fill(COLOR.surfaceSoft);
  doc.roundedRect(MARGIN, cursor.y, 4, boxHeight, 2).fill(COLOR.accent);
  doc
    .fillColor(COLOR.accent)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text("EXECUTIVE SUMMARY", MARGIN + 16, cursor.y + 14, { lineBreak: false });
  doc.fillColor(COLOR.ink).font("Helvetica").fontSize(10.5).text(summary, MARGIN + 16, cursor.y + 28, { width: innerWidth });

  cursor.y += boxHeight + 18;
}

function drawCareerOverview(doc: PDFKit.PDFDocument, cursor: Cursor, profile: Profile) {
  sectionHeader(doc, cursor, "Career Overview");
  const width = contentWidth(doc);

  doc
    .fillColor(COLOR.ink)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text(`${profile.fullName} — ${profile.currentRole}${profile.currentCompany ? ` at ${profile.currentCompany}` : ""}`, MARGIN, cursor.y, {
      width
    });
  cursor.y = doc.y + 2;
  doc
    .fillColor(COLOR.muted)
    .font("Helvetica")
    .fontSize(9.5)
    .text(`${profile.yearsExperience} years experience · Risk tolerance: ${profile.riskTolerance}`, MARGIN, cursor.y, { width });
  cursor.y = doc.y + 12;

  doc.fillColor(COLOR.muted).font("Helvetica-Bold").fontSize(8.5).text("GOALS", MARGIN, cursor.y, { lineBreak: false });
  cursor.y += 13;
  drawChips(doc, cursor, profile.goals.length ? profile.goals : ["Not specified"], { bg: COLOR.surfaceSoft, textColor: COLOR.accent });

  doc.fillColor(COLOR.muted).font("Helvetica-Bold").fontSize(8.5).text("TARGET ROLES", MARGIN, cursor.y, { lineBreak: false });
  cursor.y += 13;
  drawChips(doc, cursor, profile.preferredRoles.length ? profile.preferredRoles : ["Not specified"], {
    bg: COLOR.accent2Soft,
    textColor: COLOR.accent2
  });

  doc.fillColor(COLOR.muted).font("Helvetica-Bold").fontSize(8.5).text("TECHNICAL SKILLS", MARGIN, cursor.y, { lineBreak: false });
  cursor.y += 13;
  drawChips(doc, cursor, profile.technicalSkills.length ? profile.technicalSkills : ["None listed"]);

  if (profile.certifications.length) {
    doc.fillColor(COLOR.muted).font("Helvetica-Bold").fontSize(8.5).text("CERTIFICATIONS", MARGIN, cursor.y, { lineBreak: false });
    cursor.y += 13;
    drawChips(doc, cursor, profile.certifications, { bg: COLOR.accent3Soft, textColor: COLOR.accent3 });
  }

  if (profile.projects.length) {
    doc.fillColor(COLOR.muted).font("Helvetica-Bold").fontSize(8.5).text("PROJECTS", MARGIN, cursor.y, { lineBreak: false });
    cursor.y += 13;
    drawChips(doc, cursor, profile.projects, { bg: COLOR.successSoft, textColor: COLOR.success });
  }
}

function drawScorecardSection(doc: PDFKit.PDFDocument, cursor: Cursor, scorecard: CareerScorecard) {
  sectionHeader(doc, cursor, "Career Scorecard", "How each part of your professional presence is scoring right now.");
  const width = contentWidth(doc);

  const heroHeight = 92;
  ensureSpace(doc, cursor, heroHeight);
  doc.roundedRect(MARGIN, cursor.y, width, heroHeight, 10).fillAndStroke(COLOR.surfaceSoft, COLOR.border);
  drawRing(doc, MARGIN + 52, cursor.y + heroHeight / 2, 36, scorecard.overallScore, { color: tierColor(scorecard.overallScore) });
  doc
    .fillColor(COLOR.ink)
    .font("Helvetica-Bold")
    .fontSize(13)
    .text(tierLabel(scorecard.overallScore), MARGIN + 110, cursor.y + 24, { lineBreak: false });
  doc
    .fillColor(COLOR.muted)
    .font("Helvetica")
    .fontSize(9.5)
    .text(
      "Your overall career score blends resume quality, ATS readiness, professional branding, and project depth into a single, comparable number.",
      MARGIN + 110,
      cursor.y + 42,
      { width: width - 130 }
    );
  cursor.y += heroHeight + 16;

  const gap = 12;
  const cardWidth = (width - gap) / 2;
  const cardHeight = 112;
  scorecard.categories.forEach((category, index) => {
    const column = index % 2;
    const x = MARGIN + column * (cardWidth + gap);
    if (column === 0) ensureSpace(doc, cursor, cardHeight + gap);
    const y = cursor.y;
    const color = tierColor(category.score);

    doc.roundedRect(x, y, cardWidth, cardHeight, 10).fillAndStroke(COLOR.surface, COLOR.border);
    doc.fillColor(COLOR.ink).font("Helvetica-Bold").fontSize(10.5).text(category.key, x + 14, y + 12, {
      width: cardWidth - 80,
      lineBreak: false
    });
    doc.fillColor(color).font("Helvetica-Bold").fontSize(14).text(`${category.score}`, x + cardWidth - 56, y + 8, {
      width: 42,
      align: "right",
      lineBreak: false
    });
    doc.fillColor(COLOR.muted).font("Helvetica").fontSize(7.5).text("/100", x + cardWidth - 56, y + 22, {
      width: 42,
      align: "right",
      lineBreak: false
    });
    drawBar(doc, x + 14, y + 32, cardWidth - 28, category.score / 100, color);
    doc.fillColor(COLOR.muted).font("Helvetica").fontSize(8).text(category.explanation, x + 14, y + 42, {
      width: cardWidth - 28,
      height: 26,
      ellipsis: true
    });
    doc.fillColor(COLOR.ink).font("Helvetica-Bold").fontSize(7.5).text("TO IMPROVE:", x + 14, y + 72, { lineBreak: false });
    doc.fillColor(COLOR.muted).font("Helvetica").fontSize(7.8).text(category.improvementSteps[0] ?? "Keep refining this area.", x + 14, y + 83, {
      width: cardWidth - 28,
      height: 24,
      ellipsis: true
    });

    if (column === 1) cursor.y += cardHeight + gap;
  });
  if (scorecard.categories.length % 2 === 1) cursor.y += cardHeight + gap;
}

function drawBestScenario(doc: PDFKit.PDFDocument, cursor: Cursor, scenario: SimulationScenarioResult) {
  sectionHeader(doc, cursor, "Best-Fit Scenario", "The path our model rates as your strongest current option.");
  const width = contentWidth(doc);
  const textColumnWidth = width - 140;
  const ringDiameter = 34 * 2 + 24; // ring radius(34)*2 plus breathing room, so the card never clips it

  // Salary projections and (especially) metric values are AI-generated and vary a lot in length
  // — some are one word ("Moderate"), others a full clause. Measure the real wrapped height of
  // each piece of text instead of assuming a fixed card height, otherwise long content overflows
  // straight through into whatever section is drawn next (the bug this replaces).
  const nameFontSize = 13;
  doc.font("Helvetica-Bold").fontSize(nameFontSize);
  const nameHeight = doc.heightOfString(scenario.name, { width: textColumnWidth });

  const salaryText = `Salary projection: ${scenario.salaryProjection}   ·   Timeline: ${scenario.timelineToGoal}`;
  doc.font("Helvetica").fontSize(9.5);
  const salaryHeight = doc.heightOfString(salaryText, { width: textColumnWidth });

  const metricEntries = Object.entries(scenario.metrics);
  const metricGap = 10;
  const metricWidth = metricEntries.length
    ? (textColumnWidth - metricGap * (metricEntries.length - 1)) / metricEntries.length
    : textColumnWidth;
  doc.font("Helvetica-Bold").fontSize(9.5);
  const metricValueHeight = metricEntries.reduce(
    (max, [, value]) => Math.max(max, doc.heightOfString(value, { width: metricWidth })),
    0
  );

  const topPadding = 16;
  const afterNameGap = 6;
  const afterSalaryGap = 16;
  const metricLabelHeight = 10;
  const labelToValueGap = 4;
  const bottomPadding = 16;
  const contentHeight =
    topPadding +
    nameHeight +
    afterNameGap +
    salaryHeight +
    afterSalaryGap +
    (metricEntries.length ? metricLabelHeight + labelToValueGap + metricValueHeight : 0) +
    bottomPadding;
  const cardHeight = Math.max(ringDiameter, contentHeight);

  ensureSpace(doc, cursor, cardHeight);

  const gradient = doc.linearGradient(MARGIN, cursor.y, MARGIN + width, cursor.y + cardHeight);
  gradient.stop(0, COLOR.accent).stop(1, COLOR.accent2);
  doc.roundedRect(MARGIN, cursor.y, width, cardHeight, 12).fill(gradient);
  doc.roundedRect(MARGIN + 2, cursor.y + 2, width - 4, cardHeight - 4, 10).fill(COLOR.surface);

  drawRing(doc, MARGIN + 54, cursor.y + cardHeight / 2, 34, scenario.successProbability, {
    color: tierColor(scenario.successProbability),
    label: "Success"
  });

  let textY = cursor.y + topPadding;
  doc.fillColor(COLOR.ink).font("Helvetica-Bold").fontSize(nameFontSize).text(scenario.name, MARGIN + 116, textY, {
    width: textColumnWidth
  });
  textY += nameHeight + afterNameGap;

  doc.fillColor(COLOR.muted).font("Helvetica").fontSize(9.5).text(salaryText, MARGIN + 116, textY, {
    width: textColumnWidth
  });
  textY += salaryHeight + afterSalaryGap;

  metricEntries.forEach(([key, value], index) => {
    const x = MARGIN + 116 + index * (metricWidth + metricGap);
    const label = key.replace(/([A-Z])/g, " $1").trim().toUpperCase();
    doc.fillColor(COLOR.muted).font("Helvetica").fontSize(7).text(label, x, textY, {
      width: metricWidth + metricGap,
      lineBreak: false
    });
    doc.fillColor(COLOR.ink).font("Helvetica-Bold").fontSize(9.5).text(value, x, textY + metricLabelHeight + labelToValueGap, {
      width: metricWidth
    });
  });

  cursor.y += cardHeight + 18;
}

function drawStrengthsAndRisks(doc: PDFKit.PDFDocument, cursor: Cursor, width: number, strengths: string[], risks: string[]) {
  sectionHeader(doc, cursor, "Strengths & Risks");
  const gap = 12;
  const columnWidth = (width - gap) / 2;

  doc.font("Helvetica").fontSize(9.5);
  const estimate = (items: string[]) =>
    46 + items.reduce((sum, item) => sum + Math.max(16, doc.heightOfString(item, { width: columnWidth - 44 }) + 4), 0);
  ensureSpace(doc, cursor, Math.max(estimate(strengths), estimate(risks)));

  const startY = cursor.y;
  const leftHeight = drawToneCard(doc, MARGIN, startY, columnWidth, `Strengths (${strengths.length})`, strengths, {
    bg: COLOR.successSoft,
    accent: COLOR.success,
    icon: "check"
  });
  const rightHeight = drawToneCard(doc, MARGIN + columnWidth + gap, startY, columnWidth, `Risks (${risks.length})`, risks, {
    bg: COLOR.dangerSoft,
    accent: COLOR.danger,
    icon: "warn"
  });

  cursor.y = startY + Math.max(leftHeight, rightHeight) + 18;
}

function drawScenarioComparison(doc: PDFKit.PDFDocument, cursor: Cursor, scenarios: SimulationScenarioResult[]) {
  sectionHeader(doc, cursor, "Scenario Comparison", "How your possible paths stack up against one another.");
  const width = contentWidth(doc);
  const labelWidth = 140;
  const barAreaX = MARGIN + labelWidth;
  const barAreaWidth = width - labelWidth - 40;

  scenarios.forEach((scenario, index) => {
    ensureSpace(doc, cursor, 22);
    const color = SCENARIO_COLORS[index % SCENARIO_COLORS.length];
    doc.fillColor(COLOR.ink).font("Helvetica-Bold").fontSize(9).text(scenario.name, MARGIN, cursor.y + 3, {
      width: labelWidth - 8,
      height: 14,
      ellipsis: true
    });
    drawBar(doc, barAreaX, cursor.y + 5, barAreaWidth, scenario.successProbability / 100, color, { height: 10 });
    doc.fillColor(COLOR.ink).font("Helvetica-Bold").fontSize(9).text(`${scenario.successProbability}%`, barAreaX + barAreaWidth + 6, cursor.y + 3, {
      lineBreak: false
    });
    cursor.y += 24;
  });
  cursor.y += 8;

  scenarios.forEach((scenario, index) => {
    const color = SCENARIO_COLORS[index % SCENARIO_COLORS.length];
    ensureSpace(doc, cursor, 60);
    doc.roundedRect(MARGIN, cursor.y, 4, 16, 2).fill(color);
    doc.fillColor(COLOR.ink).font("Helvetica-Bold").fontSize(10.5).text(scenario.name, MARGIN + 12, cursor.y - 1, { lineBreak: false });
    cursor.y += 18;
    doc
      .fillColor(COLOR.muted)
      .font("Helvetica")
      .fontSize(9)
      .text(`Salary projection: ${scenario.salaryProjection}   ·   Timeline: ${scenario.timelineToGoal}`, MARGIN, cursor.y, {
        width
      });
    cursor.y = doc.y + 6;
    if (scenario.skillGapAnalysis.length) {
      drawChips(
        doc,
        cursor,
        scenario.skillGapAnalysis.map((item) => `Gap: ${item}`),
        { bg: COLOR.dangerSoft, textColor: COLOR.danger, fontSize: 8 }
      );
    }
    if (scenario.requiredCertifications.length) {
      drawChips(doc, cursor, scenario.requiredCertifications, { bg: COLOR.accent2Soft, textColor: COLOR.accent2, fontSize: 8 });
    }
    cursor.y += 6;
  });
}

function drawTimeline(doc: PDFKit.PDFDocument, cursor: Cursor, items: string[]) {
  const dotX = MARGIN + 5;
  items.forEach((item, index) => {
    const textWidth = contentWidth(doc) - 28;
    doc.font("Helvetica").fontSize(10);
    const rowHeight = Math.max(24, doc.heightOfString(item, { width: textWidth }) + 8);
    ensureSpace(doc, cursor, rowHeight);

    if (index < items.length - 1) {
      doc
        .strokeColor(COLOR.border)
        .lineWidth(2)
        .moveTo(dotX, cursor.y + 10)
        .lineTo(dotX, cursor.y + rowHeight + 4)
        .stroke();
    }
    doc.circle(dotX, cursor.y + 6, 5).fill(SCENARIO_COLORS[index % SCENARIO_COLORS.length]);
    doc.fillColor(COLOR.ink).font("Helvetica").fontSize(10).text(item, MARGIN + 20, cursor.y, { width: textWidth });
    cursor.y += rowHeight;
  });
  cursor.y += 8;
}

function drawEvidenceLedger(doc: PDFKit.PDFDocument, cursor: Cursor, width: number, evidence: SimulationResult["evidenceRefs"]) {
  evidence.forEach((item) => {
    const tone = EVIDENCE_TONES[item.type] ?? EVIDENCE_TONES.inferred;
    doc.font("Helvetica-Bold").fontSize(7.5);
    const chipWidth = doc.widthOfString(tone.label) + 16;
    const detailX = MARGIN + chipWidth + 10;
    const detailWidth = width - chipWidth - 10;
    doc.font("Helvetica").fontSize(9.5);
    const rowHeight = Math.max(20, doc.heightOfString(item.detail, { width: detailWidth }) + 6);
    ensureSpace(doc, cursor, rowHeight);

    doc.roundedRect(MARGIN, cursor.y, chipWidth, 16, 8).fill(tone.soft);
    doc.fillColor(tone.color).font("Helvetica-Bold").fontSize(7.5).text(tone.label, MARGIN + 8, cursor.y + 4, { lineBreak: false });
    doc.fillColor(COLOR.ink).font("Helvetica").fontSize(9.5).text(item.detail, detailX, cursor.y + 1, { width: detailWidth });
    cursor.y += rowHeight + 6;
  });
}

function drawConfidenceCard(doc: PDFKit.PDFDocument, cursor: Cursor, width: number, simulation: SimulationResult) {
  doc.font("Helvetica").fontSize(9.5);
  const textHeight = doc.heightOfString(simulation.confidenceNarrative, { width: width - 32 });
  const cardHeight = textHeight + 76;
  ensureSpace(doc, cursor, cardHeight);

  doc.roundedRect(MARGIN, cursor.y, width, cardHeight, 10).fillAndStroke(COLOR.surfaceSoft, COLOR.border);
  doc.fillColor(COLOR.ink).font("Helvetica-Bold").fontSize(11).text("Final Rating & Confidence", MARGIN + 16, cursor.y + 14, {
    lineBreak: false
  });

  const barX = MARGIN + 16;
  const barY = cursor.y + 36;
  const barWidth = width - 32;
  doc.roundedRect(barX, barY, barWidth, 8, 4).fill(COLOR.border);
  const minX = barX + simulation.confidenceBand.min * barWidth;
  const maxX = barX + simulation.confidenceBand.max * barWidth;
  doc.roundedRect(minX, barY, Math.max(6, maxX - minX), 8, 4).fill(COLOR.accent);
  doc
    .fillColor(COLOR.muted)
    .font("Helvetica")
    .fontSize(8)
    .text(`Confidence band ${simulation.confidenceBand.min.toFixed(2)} – ${simulation.confidenceBand.max.toFixed(2)}`, barX, barY + 12, {
      lineBreak: false
    });
  doc
    .fillColor(COLOR.ink)
    .font("Helvetica")
    .fontSize(9.5)
    .text(simulation.confidenceNarrative, MARGIN + 16, barY + 28, { width: width - 32 });

  cursor.y += cardHeight + 12;
}

function drawFooter(doc: PDFKit.PDFDocument, pageNumber: number, pageCount: number) {
  const y = doc.page.height - 26;
  doc
    .strokeColor(COLOR.border)
    .lineWidth(0.75)
    .moveTo(MARGIN, y - 8)
    .lineTo(doc.page.width - MARGIN, y - 8)
    .stroke();
  doc.fillColor(COLOR.muted).font("Helvetica").fontSize(8).text("CareerTwin AI · Confidential career intelligence report", MARGIN, y, {
    lineBreak: false
  });
  const pageLabel = `Page ${pageNumber} of ${pageCount}`;
  const labelWidth = doc.widthOfString(pageLabel);
  doc.text(pageLabel, doc.page.width - MARGIN - labelWidth, y, { lineBreak: false });
}
