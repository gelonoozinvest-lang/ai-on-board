# Technical Specification (ТЗ) for Core Application Database Service

This document outlines the requirements for the primary database of the AI Cabinet system, which holds all master data.

---

### 1. Core Objective

To establish and maintain the primary, authoritative database for the AI Cabinet system. This database is the **single source of truth** for core business entities: `sites` and `users`. It is a distinct and separate component from the RAG service's database and the internal n8n database.

---

### 2. Architecture & Technology Stack

-   **Database:** **PostgreSQL** (version 14+ recommended).
-   **Schema Management:** **Alembic**. All schema changes must be managed through Alembic migrations, based on the models defined in the main project's `models.py` file.
-   **Networking:** **Tailscale**. The database server must be part of the project's Tailscale network. All connections to this database from other services (like n8n or future admin panels) **must** occur exclusively over the private Tailscale network. The database port (e.g., 5432) should **not** be exposed to the public internet.

---

### 3. Responsibilities (What This Database Stores)

This database is exclusively responsible for storing and managing the following core entities:

-   **`sites` Table:** Contains all configuration data for each customer-facing site, including domains, AI prompts, branding, and HubSpot integration details. This is the master record for site settings.
-   **`users` Table:** Contains the master list of all registered users. The `user_id` in this table is the primary identifier that links a user across all services.

---

### 4. Non-Responsibilities (What This Database Does NOT Store)

To ensure a clean separation of concerns, this database **must not** be used for:

-   **Chat History:** All conversation logs (`chat_messages`) are the responsibility of the **RAG Service's Database**.
-   **Vector Embeddings:** All vectorized data for knowledge retrieval (`knowledge_documents`) is the responsibility of the **RAG Service's Database**.
-   **n8n Internal Data:** This database must not be used for n8n's internal operations (workflows, credentials, execution logs).

---

### 5. Interaction with Other Services

-   **n8n Workflow:** The n8n workflow will be configured with credentials to connect directly to this PostgreSQL database via its **Tailscale IP address or MagicDNS name**. It will perform `SELECT` queries on the `sites` table to fetch configuration (e.g., `ai_prompt`) at the beginning of a workflow execution.
-   **Admin Panel (Future):** Any future administrative interface for managing users or sites will perform `CREATE`, `UPDATE`, and `DELETE` operations directly on the tables in this database, also over the Tailscale network.

---

### 6. Database Schema

The following tables must be created and managed in this database via Alembic migrations.

#### Table: `sites`
The master record for all site configurations.

| Column             | Type        | Description                               |
| ------------------ | ----------- | ----------------------------------------- |
| `site_id`          | `string`    | **Primary Key.** Unique identifier for the site. |
| `domain`           | `string`    | The domain name associated with the site. |
| `ai_script_id`     | `string`    | ID for a specific AI script or version.   |
| `ai_prompt`        | `text`      | The system prompt for the AI model.       |
| `brand_name`       | `string`    | The brand name for the site.              |
| `language`         | `string`    | Language for the AI (e.g., 'en', 'de').   |
| `hubspot_pipeline` | `string`    | Target HubSpot pipeline ID.               |
| `hubspot_stage`    | `string`    | Target HubSpot stage ID.                  |
| `created_at`       | `timestamp` | Timestamp of creation.                    |

#### Table: `users`
The master record for all users in the system.

| Column       | Type        | Description                               |
| ------------ | ----------- | ----------------------------------------- |
| `user_id`    | `string`    | **Primary Key.** User ID from Zitadel (`sub`). |
| `email`      | `string`    | User's email address.                     |
| `first_seen` | `timestamp` | When the user was first created.          |
| `last_seen`  | `timestamp` | When the user was last active.            |
