import * as cheerio from "cheerio";
import { logger } from "../lib/logger.js";

export interface PortfolioAnalysis {
  url: string;
  isHttps: boolean;
  responseTimeMs: number;
  title: string | null;
  metaDescription: string | null;
  hasViewportMeta: boolean;
  hasOpenGraph: boolean;
  wordCount: number;
  imageCount: number;
  imagesWithAlt: number;
  hasContactSignal: boolean;
  projectSectionCount: number;
  score: number;
}

const CONTACT_SIGNALS = ["contact", "email", "mailto:", "get in touch", "reach out"];

export async function analyzePortfolio(portfolioUrl: string): Promise<PortfolioAnalysis | null> {
  try {
    const startedAt = Date.now();
    const response = await fetch(portfolioUrl, {
      headers: { "User-Agent": "careertwin-ai-portfolio-analyzer" },
      redirect: "follow"
    });
    const responseTimeMs = Date.now() - startedAt;
    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $("title").first().text().trim() || null;
    const metaDescription = $('meta[name="description"]').attr("content")?.trim() || null;
    const hasViewportMeta = $('meta[name="viewport"]').length > 0;
    const hasOpenGraph = $('meta[property^="og:"]').length > 0;
    const bodyText = $("body").text().replace(/\s+/g, " ").trim();
    const wordCount = bodyText ? bodyText.split(" ").length : 0;
    const images = $("img");
    const imageCount = images.length;
    const imagesWithAlt = images.filter((_, el) => Boolean($(el).attr("alt")?.trim())).length;
    const lowerHtml = html.toLowerCase();
    const hasContactSignal = CONTACT_SIGNALS.some((signal) => lowerHtml.includes(signal));
    const projectSectionCount = $('[class*="project" i], [id*="project" i], section, article').length;

    const score = Math.round(
      Math.max(
        30,
        Math.min(
          97,
          38 +
            (hasViewportMeta ? 10 : 0) +
            (metaDescription ? 8 : 0) +
            (hasOpenGraph ? 6 : 0) +
            (title ? 6 : 0) +
            Math.min(15, Math.round(wordCount / 150)) +
            (imageCount > 0 ? Math.min(10, Math.round((imagesWithAlt / imageCount) * 10)) : 5) +
            (hasContactSignal ? 8 : 0) +
            (portfolioUrl.startsWith("https://") ? 5 : 0)
        )
      )
    );

    return {
      url: portfolioUrl,
      isHttps: portfolioUrl.startsWith("https://"),
      responseTimeMs,
      title,
      metaDescription,
      hasViewportMeta,
      hasOpenGraph,
      wordCount,
      imageCount,
      imagesWithAlt,
      hasContactSignal,
      projectSectionCount,
      score
    };
  } catch (error) {
    logger.warn({ error, portfolioUrl }, "Portfolio analysis fetch failed");
    return null;
  }
}
