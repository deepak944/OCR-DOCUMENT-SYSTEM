const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GEMINI_API_KEY, GEMINI_MODEL } = require("../config/config");

let client = null;
const MAX_TEXT_CONTEXT_CHARS = 18000;
const MAX_JSON_CONTEXT_CHARS = 12000;
const MAX_HISTORY_MESSAGES = 8;
const MAX_FALLBACK_SNIPPET_CHARS = 1200;

function getClient() {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  if (!client) {
    client = new GoogleGenerativeAI(GEMINI_API_KEY);
  }

  return client;
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueTexts(values) {
  const seen = new Set();
  return values.filter((value) => {
    const normalized = normalizeText(value);
    if (!normalized || seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
}

function extractPageTexts(documentData) {
  const pages = Array.isArray(documentData?.pages) ? documentData.pages : [];

  return pages
    .map((page) => {
      const pageNumber = page?.page_number ?? "?";
      const pageText = typeof page?.text === "string" ? page.text : "";
      const blockText = Array.isArray(page?.blocks)
        ? page.blocks
            .map((block) => normalizeText(block?.text))
            .filter(Boolean)
            .join("\n")
        : "";
      const tableText = Array.isArray(page?.tables)
        ? page.tables
            .map((table) => JSON.stringify(table))
            .filter(Boolean)
            .join("\n")
        : "";
      const text = uniqueTexts([pageText, blockText, tableText]).join("\n");

      return {
        pageNumber,
        text,
      };
    })
    .filter((page) => page.text);
}

function extractKeywords(message) {
  return Array.from(
    new Set(
      normalizeText(message)
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 3)
    )
  );
}

function scorePageForQuery(pageText, keywords) {
  if (!keywords.length) {
    return 0;
  }

  const lowered = pageText.toLowerCase();
  return keywords.reduce((score, keyword) => {
    return score + (lowered.includes(keyword) ? 1 : 0);
  }, 0);
}

function buildDocumentTextContext(documentData, message) {
  const pageTexts = extractPageTexts(documentData);
  const keywords = extractKeywords(message);

  const rankedPages = [...pageTexts].sort((left, right) => {
    const rightScore = scorePageForQuery(right.text, keywords);
    const leftScore = scorePageForQuery(left.text, keywords);
    return rightScore - leftScore;
  });

  const selectedPages = [];
  let usedChars = 0;

  for (const page of rankedPages) {
    const section = `Page ${page.pageNumber}:\n${page.text}`;
    if (usedChars + section.length > MAX_TEXT_CONTEXT_CHARS && selectedPages.length > 0) {
      break;
    }

    selectedPages.push(section);
    usedChars += section.length;
  }

  if (!selectedPages.length) {
    return "No extracted text is available for this document.";
  }

  return selectedPages.join("\n\n");
}

function buildTablesContext(documentData) {
  const topLevelTables = Array.isArray(documentData?.tables) ? documentData.tables : [];
  const pageTables = Array.isArray(documentData?.pages)
    ? documentData.pages.flatMap((page) => (Array.isArray(page?.tables) ? page.tables : []))
    : [];
  const tables = topLevelTables.length ? topLevelTables : pageTables;

  if (!tables.length) {
    return "No tables were extracted.";
  }

  const summarizedTables = tables.slice(0, 8);
  return JSON.stringify(summarizedTables, null, 2);
}

function buildImagesContext(documentData) {
  const images = Array.isArray(documentData?.images) ? documentData.images : [];
  if (!images.length) {
    return "No embedded images were extracted.";
  }

  const summarizedImages = images.slice(0, 12).map((image) => ({
    page_number: image?.page_number,
    image_index: image?.image_index,
    width: image?.width,
    height: image?.height,
    extension: image?.extension,
  }));

  return JSON.stringify(summarizedImages, null, 2);
}

function buildDocumentProfileContext(documentData, documentName) {
  const pages = Array.isArray(documentData?.pages) ? documentData.pages : [];
  const topLevelTables = Array.isArray(documentData?.tables) ? documentData.tables : [];
  const pageTables = pages.flatMap((page) => (Array.isArray(page?.tables) ? page.tables : []));
  const tables = topLevelTables.length ? topLevelTables : pageTables;
  const images = Array.isArray(documentData?.images) ? documentData.images : [];
  const pageSummaries = pages.slice(0, 30).map((page) => ({
    page_number: page?.page_number,
    text_length:
      typeof page?.text === "string"
        ? page.text.length
        : Array.isArray(page?.blocks)
          ? page.blocks.reduce((total, block) => total + String(block?.text || "").length, 0)
          : 0,
    block_count: Array.isArray(page?.blocks) ? page.blocks.length : 0,
    table_count: Array.isArray(page?.tables) ? page.tables.length : 0,
    image_count:
      typeof page?.metadata?.image_count === "number"
        ? page.metadata.image_count
        : images.filter((image) => image?.page_number === page?.page_number).length,
  }));

  return JSON.stringify(
    {
      document_name: documentName || "OCR Document",
      page_count: Number(documentData?.metadata?.page_count || pages.length || 0),
      table_count: Number(documentData?.metadata?.table_count || tables.length || 0),
      image_count: Number(documentData?.metadata?.image_count || images.length || 0),
      ocr_failed_pages: Number(documentData?.metadata?.ocr_failed_pages || 0),
      page_summaries: pageSummaries,
    },
    null,
    2
  );
}

function buildHistoryContext(history) {
  const normalizedHistory = Array.isArray(history) ? history.slice(-MAX_HISTORY_MESSAGES) : [];
  if (!normalizedHistory.length) {
    return "No previous chat history.";
  }

  return normalizedHistory
    .map((entry) => `${entry.role === "assistant" ? "Assistant" : "User"}: ${normalizeText(entry.content)}`)
    .join("\n");
}

function buildPrompt(message, documentData, history, documentName = "OCR Document", language = "en") {
  const documentProfileContext = buildDocumentProfileContext(documentData, documentName);
  const documentTextContext = buildDocumentTextContext(documentData, message);
  const tablesContext = buildTablesContext(documentData);
  const imagesContext = buildImagesContext(documentData);
  const documentJson = JSON.stringify(documentData, null, 2).slice(0, MAX_JSON_CONTEXT_CHARS);
  const historyContext = buildHistoryContext(history);

  const languageNote = language !== "en" ? `\nNote: Please respond in ${language} language if possible.` : "";

  return `You are an OCR document assistant.

Your main job is to answer from the provided uploaded document whenever the user's request is about that document.
If the user's request is clearly unrelated to the uploaded document, you may answer using general knowledge.

You can:
- Summarize documents
- Extract structured data
- Answer questions
- Translate content
- Reformat document data into tables

Conversation History:
${historyContext}

Current Uploaded Document:
${documentName}

Document Profile:
${documentProfileContext}

Document Text:
${documentTextContext}

Extracted Tables:
${tablesContext}

Extracted Images Metadata:
${imagesContext}

Document JSON Snapshot:
${documentJson}

User Request:
${message}

Rules:
- Treat the current uploaded document as the primary source of truth.
- If the user asks about the uploaded document, answer from the document only.
- If the user asks something clearly outside the uploaded document, answer helpfully using general knowledge.
- Never pretend a general-knowledge answer came from the document.
- Do not guess or invent missing document details.
- If a document-related answer is not supported by the document, say: "I could not find that in the document."
- If text is missing but tables or image metadata exist, say what was extracted instead of calling the PDF empty.
- Prefer the extracted text over assumptions.
- When discussing images, use only extracted image metadata such as count, page, size, and file type unless OCR text or tables describe the visual content.
- When answering from the document, naturally mention page numbers in the sentence when helpful.
- If tabular data is requested, return a markdown table.
- Keep the answer clear and concise.
- Reply in a natural conversational style like a normal AI assistant.
- Do not use labels like "Source:", "Answer:", or "Evidence:".
- Do not break the response into rigid sections unless the user explicitly asks for a structured format.
- If the answer comes from the document, weave the relevant page reference naturally into the reply.
- If the answer is general knowledge, just answer normally.${languageNote}

Examples of good style:
- "The total amount appears to be 4,500 on page 2."
- "I could not find that in the document."
- "Machine learning is a field of AI focused on systems that learn from data."`;
}

function getDocumentStats(documentData) {
  const pages = Array.isArray(documentData?.pages) ? documentData.pages : [];
  const topLevelTables = Array.isArray(documentData?.tables) ? documentData.tables : [];
  const pageTables = pages.flatMap((page) => (Array.isArray(page?.tables) ? page.tables : []));
  const tables = topLevelTables.length ? topLevelTables : pageTables;
  const images = Array.isArray(documentData?.images) ? documentData.images : [];

  return {
    pageCount: Number(documentData?.metadata?.page_count || pages.length || 0),
    tableCount: Number(documentData?.metadata?.table_count || tables.length || 0),
    imageCount: Number(documentData?.metadata?.image_count || images.length || 0),
    images,
    tables,
  };
}

function trimForFallback(value, maxChars = MAX_FALLBACK_SNIPPET_CHARS) {
  const text = String(value || "").trim();
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars).trim()}...`;
}

function buildFallbackTextExcerpt(documentData, message) {
  const textContext = buildDocumentTextContext(documentData, message);
  if (textContext === "No extracted text is available for this document.") {
    return "";
  }

  return trimForFallback(textContext);
}

function buildFallbackImageDetails(images) {
  if (!images.length) {
    return "No extracted embedded images are saved for this PDF.";
  }

  const imageLines = images.slice(0, 10).map((image, index) => {
    const page = image?.page_number || "?";
    const width = image?.width || "?";
    const height = image?.height || "?";
    const extension = image?.extension || "image";

    return `${index + 1}. Page ${page}, ${width}x${height}, ${extension}`;
  });

  const remaining = images.length > imageLines.length ? `\n${images.length - imageLines.length} more image(s) are saved.` : "";

  return imageLines.join("\n") + remaining;
}

function createQuotaFallbackResponse(message, documentData, documentName = "OCR Document") {
  const normalizedMessage = normalizeText(message).toLowerCase();
  const { pageCount, tableCount, imageCount, images, tables } = getDocumentStats(documentData);
  const excerpt = buildFallbackTextExcerpt(documentData, message);

  if (/\b(image|images|photo|picture|figure|diagram)\b/.test(normalizedMessage)) {
    return `For ${documentName}, I found ${imageCount} extracted image${imageCount === 1 ? "" : "s"}.\n${buildFallbackImageDetails(images)}`;
  }

  if (/\b(table|tables|excel|spreadsheet)\b/.test(normalizedMessage)) {
    const tablePreview = tables.length ? trimForFallback(JSON.stringify(tables.slice(0, 3), null, 2)) : "No extracted tables are saved for this PDF.";
    return `For ${documentName}, I found ${tableCount} extracted table${tableCount === 1 ? "" : "s"}.\n${tablePreview}`;
  }

  if (/\b(summary|summarize|about|details?|key|information|info)\b/.test(normalizedMessage)) {
    const textPart = excerpt
      ? `\n\nText available from the PDF:\n${excerpt}`
      : "\n\nNo extracted text is saved for this PDF, but table/image metadata may still be available.";

    return `${documentName} has ${pageCount} page${pageCount === 1 ? "" : "s"}, ${tableCount} extracted table${tableCount === 1 ? "" : "s"}, and ${imageCount} extracted image${imageCount === 1 ? "" : "s"}.${textPart}`;
  }

  if (excerpt) {
    return `I found this relevant saved OCR text from ${documentName}:\n${excerpt}`;
  }

  return `I could not find extracted text for ${documentName}. Saved metadata shows ${pageCount} page${pageCount === 1 ? "" : "s"}, ${tableCount} table${tableCount === 1 ? "" : "s"}, and ${imageCount} image${imageCount === 1 ? "" : "s"}.`;
}

function isQuotaExceededError(error) {
  const message = String(error?.message || "").toLowerCase();
  return error?.status === 429 || (message.includes("429") && message.includes("quota"));
}

async function generateDocumentAssistantResponse(message, documentData, history = [], documentName, language = "en") {
  const model = getClient().getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      temperature: 0.2,
      topP: 0.8,
    },
  });
  const prompt = buildPrompt(message, documentData, history, documentName, language);
  let result;

  try {
    result = await model.generateContent(prompt);
  } catch (error) {
    if (isQuotaExceededError(error)) {
      return createQuotaFallbackResponse(message, documentData, documentName);
    }

    throw error;
  }

  const response = await result.response;
  const text = response.text();

  return text.trim();
}

module.exports = {
  generateDocumentAssistantResponse,
};
