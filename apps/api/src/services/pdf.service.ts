import PDFDocument from "pdfkit";
import type { CareerScorecard, Profile, Report, SimulationResult } from "../types/domain.js";
import { deriveReportSections } from "../features/reports/report.service.js";

const ACCENT = "#7c5cff";
const MUTED = "#6b6b80";
const INK = "#171426";

function sectionHeading(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(0.6);
  doc.fillColor(ACCENT).fontSize(14).font("Helvetica-Bold").text(title.toUpperCase());
  doc.moveTo(doc.x, doc.y + 2).lineTo(doc.page.width - doc.page.margins.right, doc.y + 2).strokeColor(ACCENT).stroke();
  doc.moveDown(0.5);
  doc.fillColor(INK).font("Helvetica").fontSize(10.5);
}

function bulletList(doc: PDFKit.PDFDocument, items: string[]) {
  items.forEach((item) => {
    doc.fillColor(INK).fontSize(10.5).text(`•  ${item}`, { indent: 4 });
  });
}

export function buildReportPdfStream(params: {
  report: Report;
  profile: Profile;
  simulation: SimulationResult;
  scorecard: CareerScorecard | null;
}): PDFKit.PDFDocument {
  const { report, profile, simulation, scorecard } = params;
  const { bestScenario, strengths, risks } = deriveReportSections(profile, simulation);
  const doc = new PDFDocument({ margin: 48, size: "A4" });

  doc.fillColor(ACCENT).fontSize(22).font("Helvetica-Bold").text("CareerTwin AI");
  doc.fillColor(MUTED).fontSize(11).font("Helvetica").text(report.title);
  doc.moveDown(0.3);
  doc.fillColor(MUTED).fontSize(9).text(`Generated ${new Date(report.createdAt).toLocaleDateString()} • Audience: ${report.audience}`);
  doc.moveDown(1);

  sectionHeading(doc, "Executive Summary");
  doc.text(report.summary, { align: "left" });

  sectionHeading(doc, "Career Overview");
  doc.text(
    `${profile.fullName} — ${profile.currentRole}${profile.currentCompany ? ` at ${profile.currentCompany}` : ""}, ${profile.yearsExperience} years experience.`
  );
  doc.moveDown(0.2);
  doc.text(`Goals: ${profile.goals.join(", ") || "Not specified"}`);
  doc.text(`Target roles: ${profile.preferredRoles.join(", ") || "Not specified"}`);
  doc.text(`Risk tolerance: ${profile.riskTolerance}`);

  sectionHeading(doc, "Profile Snapshot");
  doc.text(`Technical skills: ${profile.technicalSkills.join(", ") || "None listed"}`);
  doc.text(`Soft skills: ${profile.softSkills.join(", ") || "None listed"}`);
  doc.text(`Education: ${profile.education.join(", ") || "None listed"}`);
  doc.text(`Certifications: ${profile.certifications.join(", ") || "None listed"}`);
  doc.text(`Projects: ${profile.projects.join(", ") || "None listed"}`);

  if (scorecard) {
    sectionHeading(doc, "Career Scores");
    doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(12).text(`Overall Score: ${scorecard.overallScore}/100`);
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(10.5).fillColor(INK);
    scorecard.categories.forEach((category) => {
      doc.font("Helvetica-Bold").text(`${category.key}: ${category.score}/100`, { continued: false });
      doc.font("Helvetica").fillColor(MUTED).text(category.explanation);
      doc.fillColor(INK).moveDown(0.2);
    });
  }

  if (bestScenario) {
    sectionHeading(doc, "Best-Fit Scenario");
    doc.font("Helvetica-Bold").fontSize(11).fillColor(ACCENT).text(bestScenario.name);
    doc
      .font("Helvetica")
      .fontSize(10.5)
      .fillColor(INK)
      .text(`${bestScenario.successProbability}% modeled success • Salary projection: ${bestScenario.salaryProjection} • Timeline: ${bestScenario.timelineToGoal}`);
  }

  sectionHeading(doc, "Strengths");
  bulletList(doc, strengths);

  sectionHeading(doc, "Risks");
  bulletList(doc, risks);

  sectionHeading(doc, "Planning Assumptions");
  bulletList(doc, simulation.assumptions);

  sectionHeading(doc, "Career Recommendations & Action Plan");
  bulletList(doc, simulation.actionPlan);

  sectionHeading(doc, "Future Timeline");
  bulletList(doc, simulation.timeline);

  sectionHeading(doc, "Scenario Comparison");
  simulation.scenarios.forEach((scenario) => {
    doc.font("Helvetica-Bold").fontSize(11).fillColor(ACCENT).text(scenario.name);
    doc.font("Helvetica").fontSize(10).fillColor(INK);
    doc.text(`Success probability: ${scenario.successProbability}% • Salary projection: ${scenario.salaryProjection}`);
    doc.text(`Timeline to goal: ${scenario.timelineToGoal}`);
    if (scenario.skillGapAnalysis.length) doc.text(`Skill gaps: ${scenario.skillGapAnalysis.join(", ")}`);
    if (scenario.requiredCertifications.length) doc.text(`Suggested certifications: ${scenario.requiredCertifications.join(", ")}`);
    doc.moveDown(0.4);
  });

  sectionHeading(doc, "Final Rating & Confidence");
  doc.text(
    `Confidence band: ${simulation.confidenceBand.min.toFixed(2)} - ${simulation.confidenceBand.max.toFixed(2)}. ${simulation.confidenceNarrative}`
  );

  sectionHeading(doc, "Evidence Ledger");
  simulation.evidenceRefs.forEach((evidence) => {
    doc.font("Helvetica-Bold").fontSize(9).fillColor(ACCENT).text(`[${evidence.type.replace("_", " ")}]`, { continued: true });
    doc.font("Helvetica").fontSize(10.5).fillColor(INK).text(` ${evidence.detail}`);
  });

  sectionHeading(doc, "Next Steps Checklist");
  bulletList(
    doc,
    simulation.actionPlan.map((item) => `[ ] ${item}`)
  );

  doc.end();
  return doc;
}
