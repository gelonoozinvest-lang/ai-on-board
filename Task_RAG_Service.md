# Technical Specification (ТЗ) for RAG (Retrieval-Augmented Generation) Service

This document outlines the requirements for a standalone RAG microservice. This service will act as the "memory and knowledge base" for the AI Cabinet system.

---

### 1. Core Objective

To develop a Python-based microservice that provides contextual information to the main AI workflow (n8n). The service will manage two types of memory:

1.  **Long-Term Knowledge:** A vector database of instructions, documents, and other contextual information.
2.  **Short-Term Memory:** A rolling 30-day history of user conversations.

This service will replace the need for the n8n workflow to have direct access to the PostgreSQL database for chat-related tasks.

---

### 2. Architecture & Technology Stack

-   **Language:** Python 3.10+
-   **Framework:** **FastAPI** (recommended for its speed and automatic API documentation).
-   **Database:** **PostgreSQL** with the **`pgvector`** extension for vector similarity search.
-   **Key Libraries:**
    -   `sqlalchemy` (for ORM)
    -   `alembic` (for database migrations)
    -   `sentence-transformers` or `openai` (for generating text embeddings)
    -   `uvicorn` (for running the FastAPI app)

---

### 3. Key Features

#### 3.1. Document & Instruction Management (Long-Term Knowledge)

-   The service must provide an API to add, update, and delete knowledge documents.
-   When a document is added, the service must:
    1.  Split the document text into smaller, manageable chunks.
    2.  Generate a vector embedding for each chunk using a sentence-transformer model.
    3.  Store the chunk text and its corresponding vector in the database.

#### 3.2. Chat History Management (Short-Term Memory)

-   The service must provide an API to save new chat messages.
-   **Data Retention Policy:** The service must automatically delete any chat messages older than **30 days**. This should be implemented as a scheduled background task (e.g., a daily cron job).

#### 3.3. Context Retrieval

-   This is the primary function of the service. It must provide a single API endpoint that:
    1.  Accepts a user's query, `user_id`, and `site_id`.
    2.  Generates an embedding for the user's query.
    3.  Performs a vector similarity search in the database to find the most relevant knowledge chunks for that query and `site_id`.
    4.  Retrieves the last 5-10 messages from the conversation history for that `user_id` and `site_id`.
    5.  Combines the retrieved knowledge and chat history into a single, formatted string of context.
    6.  Returns this context string to the caller (the n8n workflow).

---

### 4. API Endpoints

The service must expose the following RESTful endpoints:

**`POST /documents`**
-   **Action:** Adds a new knowledge document.
-   **Body:**
    ```json
    {
      "site_id": "string",
      "source": "string (e.g., filename or URL)",
      "content": "string (full text of the document)"
    }
    ```
-   **Response:** `201 Created` with the ID of the ingested document.

**`POST /chat-messages`**
-   **Action:** Saves a new message to the conversation history.
-   **Body:**
    ```json
    {
      "user_id": "string",
      "site_id": "string",
      "role": "string ('user' or 'ai')",
      "message": "string"
    }
    ```
-   **Response:** `201 Created`.

**`POST /retrieve-context`**
-   **Action:** The main RAG endpoint. Retrieves context for a given query.
-   **Body:**
    ```json
    {
      "user_id": "string",
      "site_id": "string",
      "query": "string (the user's current message)"
    }
    ```
-   **Response:** `200 OK` with a JSON body:
    ```json
    {
      "context": "A single string containing formatted knowledge chunks and recent chat history."
    }
    ```

**`DELETE /chat-messages/cleanup`** (Protected Endpoint)
-   **Action:** Manually triggers the cleanup of chat messages older than 30 days. To be called by a scheduler.
-   **Response:** `200 OK` with a summary of the cleanup.

---

### 5. Database Schema

The service will use the following tables. Alembic should be used to manage migrations.

#### Table: `knowledge_documents`
Stores the vectorized chunks of long-term knowledge.

| Column      | Type                      | Description                               |
| ----------- | ------------------------- | ----------------------------------------- |
| `id`        | `uuid`                    | **Primary Key.**                          |
| `site_id`   | `string`                  | Scopes the knowledge to a specific site.  |
| `source`    | `string`                  | The original source of the document.      |
| `content`   | `text`                    | The raw text of the document chunk.       |
| `embedding` | `vector(dimension)`       | **pgvector type.** The embedding of the content. |
| `created_at`| `timestamp`               | Timestamp of creation.                    |

#### Table: `chat_messages`
(This can be the same table as used by the main application).

| Column      | Type        | Description                               |
| ----------- | ----------- | ----------------------------------------- |
| `id`        | `uuid`      | **Primary Key.**                          |
| `user_id`   | `string`    | User ID from the Zitadel JWT (`sub` claim). |
| `site_id`   | `string`    | **Foreign Key** to `sites.site_id`.       |
| `role`      | `string`    | 'user' or 'ai'.                           |
| `message`   | `text`      | The content of the message.               |
| `timestamp` | `timestamp` | **Crucial for the 30-day retention policy.** |
