# TextTrack AI: System Design & Architecture

This document provides a comprehensive overview of the system architecture, component topologies, data flows, and the software development lifecycle (SDLC) methodology used to build the **TextTrack AI** document processing platform.

---

## 1. High-Level System Architecture

TextTrack AI is designed using a **containerized microservice architecture**. This ensures high modularity, scalability, and clean boundaries between the UI, business logic, asynchronous worker queues, and machine learning components.

```mermaid
graph TD
    User([User Web Browser]) -->|HTTPS| Frontend[React Frontend SPA <br> Vite + CSS + Lucide]
    
    subgraph Core Platform Services (Dockerized)
        Frontend -->|API Requests / REST| Backend[Node.js Express Backend]
        Backend -->|Query / Mutate| Postgres[(PostgreSQL Database <br> Sequelize ORM)]
        Backend -->|Token Validation & Auth| Firebase[Firebase Auth & Firestore]
        Backend -->|Generate Chat Responses| Gemini[Google Gemini 2.5 API <br> Search Grounding Tool]
        
        Backend -->|Push OCR Tasks| Redis[(Redis Broker & Cache)]
        Worker[Python Background Worker <br> app.worker] -->|Pull Tasks / Update Status| Redis
        Worker -->|Execute OCR Processing| AIService[Python AI Service <br> FastAPI + EasyOCR + Camelot]
    end
```

---

## 2. Technical Stack Decomposition

### Frontend Layer
*   **Vite + React (SPA):** High-performance UI framework rendering components dynamically.
*   **Framer Motion:** Micro-animations for page transitions, interactive cards, and live support slide-ins.
*   **Lucide React:** Premium unified vector iconography.
*   **Firebase Client SDK:** Manages secure Google Sign-In and verifies email auth states.

### Orchestration & Backend API Layer
*   **Node.js & Express:** Lightweight, scalable server framework executing RESTful API endpoints.
*   **Sequelize (ORM) & PostgreSQL:** Manages structured relational entities (Users, Activities, Cached Documents).
*   **Firebase Admin SDK:** Validates client authorization tokens and synchronizes session claims.
*   **Google AI SDK (`@google/generative-ai`):** Communicates with the `gemini-2.5-flash` model.

### Distributed Asynchronous Processing Layer
*   **Redis:** Message broker coordinating asynchronous OCR task processing and caching document results.
*   **Python AI Worker (`app.worker`):** Persistent listener executing heavy CPU/Memory OCR pipelines asynchronously.

### Machine Learning & OCR Engine
*   **Python FastAPI:** High-performance REST wrapper serving ML models.
*   **EasyOCR:** Deep learning-based optical character recognition.
*   **Camelot / PyPDF2:** Extracts complex grid layouts and tabular structures from PDF formats.

---

## 3. Core Operation Lifecycles

### Flow A: Asynchronous PDF Upload & OCR Processing
This sequence ensures large document uploads do not block the web server thread, utilizing Redis as an asynchronous worker queue.

```mermaid
sequenceDiagram
    autonumber
    actor User as User Browser
    participant FE as React Frontend
    participant BE as Node.js Backend
    participant DB as PostgreSQL
    participant RD as Redis Queue
    participant WK as Python Worker
    participant AI as Python AI Service

    User->>FE: Upload PDF File
    FE->>BE: POST /api/documents/upload (Form Data)
    BE->>DB: Create Activity (Status: "processing")
    BE->>RD: Push Task to queue (documentId, filePath)
    BE-->>FE: Return 202 Accepted (Activity ID)
    
    Note over FE,RD: Asynchronous Processing loop begins
    WK->>RD: Poll queue and pop active task
    WK->>AI: Trigger OCR Pipeline (EasyOCR + Table Extract)
    AI-->>WK: Return Pages Text, Tables (JSON), and Image data
    WK->>DB: Update Activity (Status: "success", metadata: OCR_RESULTS)
    
    FE->>BE: Poll GET /api/activities/status/:id
    BE->>DB: Query Activity State
    DB-->>BE: Return active status (success)
    BE-->>FE: Deliver OCR Extracted Results
    FE->>User: Render text overlays, tables, and download options
```

---

### Flow B: Dual-Mode Gemini AI Assistant
To prevent rate-limit crashes and deliver highly precise context, the chat engine operates in two distinct operational modes.

```mermaid
sequenceDiagram
    autonumber
    actor User as User Browser
    participant FE as React Frontend
    participant BE as Node.js Backend
    participant Gemini as Google Gemini 2.5 API
    
    rect rgb(240, 248, 255)
        Note over User,Gemini: Mode 1: General Chat (Web Search Grounding)
        User->>FE: Ask a general query (e.g. "Google stock price today")
        FE->>BE: POST /api/ai/chat (payload: message, documentData: {})
        BE->>Gemini: generateContent (model: gemini-2.5-flash, tools: googleSearch)
        Gemini->>Gemini: Execute Google Search on query
        Gemini-->>BE: Return search-grounded answer
        BE-->>FE: Deliver real-time updated response
    end

    rect rgb(255, 240, 245)
        Note over User,Gemini: Mode 2: Document Chat (Strict Document Scoping)
        User->>FE: Ask a query about document (e.g. "Summarize page 2")
        FE->>BE: POST /api/ai/chat (payload: message, documentData: {PDF_TEXT})
        BE->>Gemini: generateContent (Strict instructions: "Only answer from context")
        Gemini-->>BE: Return document-scoped answer
        BE-->>FE: Deliver localized OCR document analysis
    end
```

---

### Flow C: Real-Time Live Support Chat (Firestore)
Support requests bypass the Express server entirely, using Firebase Firestore to deliver instant live chat.

```mermaid
sequenceDiagram
    autonumber
    actor User as User Browser
    participant FE as React Frontend
    participant FS as Google Firestore DB
    actor Support as Support Representative

    User->>FE: Open Support Chat window
    FE->>FS: onSnapshot listener subscribed on /support_chats/{user.uid}/messages
    User->>FE: Types a support request & click Send
    FE->>FS: addDoc (Message payload, createdAt)
    FS-->>Support: Broadcasts change in real-time
    Support->>FS: addDoc (Operator reply)
    FS-->>FE: onSnapshot triggers re-render
    FE->>User: Displays Operator's reply instantly with animation
```

---

## 4. Software Development Life Cycle (SDLC) Methodology

This project was built using the **Iterative and Incremental Agile Development Model**. 

```mermaid
stateDiagram-v2
    [*] --> Requirements: Analyze User Feedback
    Requirements --> Design: Define Architecture / Tech Stack
    Design --> Development: Code Components / APIs
    Development --> Verification: Local Testing & Validation
    Verification --> Deployment: Push to Git / Cloud
    Deployment --> [*]: Increment Released
```

### Why Agile Iterative Model?
Because the platform scales dynamically, building the application in full "Waterfall" fashion was not feasible. Instead, we worked in **continuous rapid cycles**:

1.  **Iteration 1 (Core Foundation):** Integrated raw OCR engines, Node.js API structures, and basic layout rendering.
2.  **Iteration 2 (Auth Security):** Migrated local authentication to Firebase to support verified emails and secure Google Auth.
3.  **Iteration 3 (Asynchronous Scaling):** Integrated Redis message brokers and Python Celery workers to handle large PDF timeouts seamlessly.
4.  **Iteration 4 (Export Capabilities):** Added multi-format download capabilities, including Excel tabular exports, Word exports, and custom premium AutoCAD DXF vectors.
5.  **Iteration 5 (Conversational AI Integration):** Engineered the dual-mode Gemini chat engine and enabled Google Search grounding to deliver live web information.
6.  **Iteration 6 (Live Customer Channels):** Configured real-time support chat windows mapped to live Firestore databases.

**Through this Agile cycle, TextTrack AI has progressed from a simple minimum viable product into a highly scalable, enterprise-grade document processing platform.**
