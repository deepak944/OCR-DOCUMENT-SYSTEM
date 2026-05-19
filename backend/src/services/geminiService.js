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

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "because", "as", "what", "where", "who", "whom", "how", "why", "when", 
  "which", "this", "that", "these", "those", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", 
  "do", "does", "did", "to", "for", "of", "with", "about", "against", "between", "into", "through", "during", "before", 
  "after", "above", "below", "from", "up", "down", "in", "out", "on", "off", "over", "under", "again", "further", 
  "then", "once", "here", "there", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", 
  "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "can", "will", "just", "should", "would"
]);

function extractKeywords(message) {
  return Array.from(
    new Set(
      normalizeText(message)
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 3 && !STOPWORDS.has(token))
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
  const normalizedMessage = String(message || "").trim().toLowerCase();
  
  // Clean greetings detection
  const greetings = ["hi", "hello", "hey", "hola", "greetings", "good morning", "good afternoon", "good evening", "howdy", "welcome"];
  const cleanMsg = normalizedMessage.replace(/[^a-z\s]/g, "").trim();
  const words = cleanMsg.split(/\s+/);
  const isGreeting = words.some(w => greetings.includes(w)) && words.length <= 4;

  const pageTexts = extractPageTexts(documentData);
  const keywords = extractKeywords(message);
  const totalScore = pageTexts.reduce((sum, page) => sum + scorePageForQuery(page.text, keywords), 0);
  const hasDocKeywords = /\b(document|doc|pdf|paper|file|text|ocr|page|table|image|extract|summarize|summary|context|chart|list|abstract|author|title|study|research|article|excel|dxf|cad|word|docx|xlsx|read|content|write|figures?|diagrams?|data)s?\b/i.test(message) ||
                         /\b(what does it say|how many|tell me about|info|information)\b/i.test(message);

  const isOutsideQuery = (totalScore === 0 && !hasDocKeywords && pageTexts.length > 0) || isGreeting;

  const documentProfileContext = isOutsideQuery ? "{}" : buildDocumentProfileContext(documentData, documentName);
  const documentTextContext = isOutsideQuery ? "No relevant document text matched." : buildDocumentTextContext(documentData, message);
  const tablesContext = isOutsideQuery ? "[]" : buildTablesContext(documentData);
  const imagesContext = isOutsideQuery ? "[]" : buildImagesContext(documentData);
  const documentJson = isOutsideQuery ? "{}" : JSON.stringify(documentData, null, 2).slice(0, MAX_JSON_CONTEXT_CHARS);
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
- If the user asks something clearly outside the uploaded document, answer helpfully and correctly using your own general knowledge.
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
- If the answer is general knowledge (outside query), answer completely and cleanly using your own knowledge and do not mention or refer to the document at all.${languageNote}

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
  
  // Clean greetings detection
  const greetings = ["hi", "hello", "hey", "hola", "greetings", "good morning", "good afternoon", "good evening", "howdy", "welcome"];
  const cleanMsg = normalizedMessage.replace(/[^a-z\s]/g, "").trim();
  const words = cleanMsg.split(/\s+/);
  const isGreeting = words.some(w => greetings.includes(w)) && words.length <= 4;
  
  if (isGreeting) {
    return `Hello! How can I help you today? Feel free to ask me questions about your document or anything else!`;
  }

  const { pageCount, tableCount, imageCount, images, tables } = getDocumentStats(documentData);
  const excerpt = buildFallbackTextExcerpt(documentData, message);

  // If general chat and the model call hit a rate limit, return a clean message
  if (pageCount === 0 || documentName === "General Chat") {
    return `I am currently operating in a lightweight offline fallback mode due to high AI API traffic. I'd be happy to answer your general knowledge questions normally once the limit resets in a few seconds!`;
  }

  // Score query against document to detect outside questions
  const keywords = extractKeywords(message);
  const pageTexts = extractPageTexts(documentData);
  const totalScore = pageTexts.reduce((sum, page) => sum + scorePageForQuery(page.text, keywords), 0);
  
  const hasDocKeywords = /\b(document|doc|pdf|paper|file|text|ocr|page|table|image|extract|summarize|summary|context|chart|list|abstract|author|title|study|research|article|excel|dxf|cad|word|docx|xlsx|read|content|write|figures?|diagrams?|data)s?\b/i.test(message) ||
                         /\b(what does it say|how many|tell me about|info|information)\b/i.test(message);

  // 1. Basic Metadata: Page Count
  if (/\b(page|pages|how many pages|page count|number of pages)\b/.test(normalizedMessage)) {
    return `The document **"${documentName}"** has **${pageCount} page${pageCount === 1 ? "" : "s"}** in total.`;
  }

  // 2. Basic Metadata: Tables Count
  if (/\b(table|tables|how many tables|table count|number of tables)\b/.test(normalizedMessage)) {
    return `The document **"${documentName}"** contains **${tableCount} extracted table${tableCount === 1 ? "" : "s"}**.`;
  }

  // 3. Basic Metadata: Images Count
  if (/\b(image|images|photo|photos|picture|pictures|figure|figures|diagram|diagrams|how many images)\b/.test(normalizedMessage)) {
    return `The document **"${documentName}"** has **${imageCount} extracted image${imageCount === 1 ? "" : "s"}** saved.`;
  }

  // 4. Basic Metadata: Document Name
  if (/\b(document name|file name|what is the name|title of the document)\b/.test(normalizedMessage)) {
    return `The name of the uploaded document is **"${documentName}"**.`;
  }

  // 5. General Document Summary Request
  if (/\b(summary|summarize|about|details?|key|information|info)\b/.test(normalizedMessage)) {
    const textPart = excerpt
      ? `\n\nHere is a preview of the text from Page 1:\n${excerpt}`
      : "\n\nNo text preview is currently saved for this PDF.";

    return `### Document Overview (${documentName})
- **Pages:** ${pageCount}
- **Extracted Tables:** ${tableCount}
- **Extracted Images:** ${imageCount}
${textPart}`;
  }

  // 6. If it's a general query with zero score and no document terms, answer from offline fallback
  if (totalScore === 0 && !hasDocKeywords && pageTexts.length > 0) {
    return `I am currently operating in a lightweight fallback mode due to high AI API traffic. I'd be happy to answer your general knowledge questions or chat normally once the limit resets in a few seconds!`;
  }

  // 7. If it's a specific advanced question about the document, return the excerpt neatly
  if (excerpt) {
    return `I am currently in offline mode due to rate limits, but I searched the document and found this relevant section in **"${documentName}"**:\n\n${excerpt}`;
  }

  return `I could not find relevant matching text in **"${documentName}"**. Saved document statistics: ${pageCount} pages, ${tableCount} tables, and ${imageCount} images.`;
}

function isQuotaExceededError(error) {
  const message = String(error?.message || "").toLowerCase();
  return error?.status === 429 || (message.includes("429") && message.includes("quota"));
}

async function generateDocumentAssistantResponse(message, documentData, history = [], documentName, language = "en") {
  const isGeneralChat = !documentData || Object.keys(documentData).length === 0 || !documentData.pages || documentData.pages.length === 0;
  
  const modelOptions = {
    model: GEMINI_MODEL,
    generationConfig: {
      temperature: 0.2,
      topP: 0.8,
    },
  };

  // Enable Google Search grounding dynamically for general chats to deliver real-time, updated web information
  if (isGeneralChat) {
    modelOptions.tools = [
      {
        googleSearch: {},
      },
    ];
  }

  const model = getClient().getGenerativeModel(modelOptions);
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
