const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GEMINI_API_KEY, GEMINI_MODEL } = require("../config/config");

let client = null;
const MAX_TEXT_CONTEXT_CHARS = 18000;
const MAX_JSON_CONTEXT_CHARS = 12000;
const MAX_HISTORY_MESSAGES = 8;

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

function extractPageTexts(documentData) {
  const pages = Array.isArray(documentData?.pages) ? documentData.pages : [];

  return pages
    .map((page) => {
      const pageNumber = page?.page_number ?? "?";
      const text = Array.isArray(page?.blocks)
        ? page.blocks
            .map((block) => normalizeText(block?.text))
            .filter(Boolean)
            .join("\n")
        : "";

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
  const tables = Array.isArray(documentData?.tables) ? documentData.tables : [];
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

function buildHistoryContext(history) {
  const normalizedHistory = Array.isArray(history) ? history.slice(-MAX_HISTORY_MESSAGES) : [];
  if (!normalizedHistory.length) {
    return "No previous chat history.";
  }

  return normalizedHistory
    .map((entry) => `${entry.role === "assistant" ? "Assistant" : "User"}: ${normalizeText(entry.content)}`)
    .join("\n");
}

function buildPrompt(message, documentData, history, documentName = "OCR Document") {
  const documentTextContext = buildDocumentTextContext(documentData, message);
  const tablesContext = buildTablesContext(documentData);
  const imagesContext = buildImagesContext(documentData);
  const documentJson = JSON.stringify(documentData, null, 2).slice(0, MAX_JSON_CONTEXT_CHARS);
  const historyContext = buildHistoryContext(history);

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
- Prefer the extracted text over assumptions.
- When answering from the document, naturally mention page numbers in the sentence when helpful.
- If tabular data is requested, return a markdown table.
- Keep the answer clear and concise.
- Reply in a natural conversational style like a normal AI assistant.
- Do not use labels like "Source:", "Answer:", or "Evidence:".
- Do not break the response into rigid sections unless the user explicitly asks for a structured format.
- If the answer comes from the document, weave the relevant page reference naturally into the reply.
- If the answer is general knowledge, just answer normally.

Examples of good style:
- "The total amount appears to be 4,500 on page 2."
- "I could not find that in the document."
- "Machine learning is a field of AI focused on systems that learn from data."`;
}

async function generateDocumentAssistantResponse(message, documentData, history = [], documentName) {
  const model = getClient().getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      temperature: 0.2,
      topP: 0.8,
    },
  });
  const prompt = buildPrompt(message, documentData, history, documentName);
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  return text.trim();
}

module.exports = {
  generateDocumentAssistantResponse,
};
