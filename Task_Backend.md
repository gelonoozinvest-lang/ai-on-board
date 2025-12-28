# Technical Specification (ТЗ) for AI Cabinet - Backend (n8n)

This document outlines the backend tasks to be implemented on the n8n platform, which serves as the API for the AI Cabinet system.

---

### 1. Core Objective

To create a secure n8n workflow that acts as a backend API. This API will receive messages from a user, process them using an AI model, interact with a PostgreSQL database (Supabase) and HubSpot CRM, and return a response to the user.

---

### 2. API Endpoint (n8n Webhook)

-   **Trigger:** The workflow must be triggered by an n8n **Webhook** node.
-   **Method:** The webhook should be configured to accept `POST` requests.
-   **Input from Frontend:** The webhook will receive a JSON body with the following structure:
    ```json
    {
      "message": "User's message text",
      "site_id": "The ID of the site, e.g., 'default_site'"
    }
    ```
-   **Deployment:** The webhook URL will be exposed to the internet securely via a **Cloudflare Tunnel**.

---

### 3. Authentication (Zitadel JWT Validation)

This is a critical security requirement. The API must not process any request that is not properly authenticated.

-   **Requirement:** Every incoming request to the webhook must include an `Authorization: Bearer <accessToken>` header.
-   **Implementation:**
    1.  Immediately after the Webhook node, add a step to extract the `accessToken` from the header.
    2.  **Validate the Token:** The workflow must validate the JWT `accessToken`. This involves:
        -   Fetching the public keys (JWKS) from the Zitadel `jwks_uri` endpoint (`https://<your-zitadel-domain>/oauth/v2/keys`).
        -   Verifying the token's signature against these keys.
        -   Checking the token's expiration (`exp`) and issuer (`iss`).
    3.  **On Success:** If the token is valid, extract the `sub` claim. This is the unique `user_id`.
    4.  **On Failure:** If the token is missing or invalid, the workflow must immediately stop and return an `HTTP 401 Unauthorized` error.

---

### 4. Database Logic (PostgreSQL / Supabase)

The workflow needs to read from and write to the PostgreSQL database.

-   **Connection:** Configure a connection to the Supabase database using the provided credentials.
-   **Tasks:**
    1.  **Fetch Site Configuration:** Using the `site_id` from the webhook input, query the `sites` table to retrieve the configuration for the current site, especially the `ai_prompt`.
    2.  **Fetch Chat History:** Before calling the AI, retrieve the last 5-10 messages for the current `user_id` and `site_id` from the `chat_messages` table to provide context to the AI.
    3.  **Save User Message:** Insert the user's incoming message into the `chat_messages` table (`role: 'user'`).
    4.  **Save AI Response:** After the AI generates a response, insert it into the `chat_messages` table (`role: 'ai'`).

---

### 5. AI Logic (OpenAI / Anthropic)

-   **Connection:** Configure the appropriate node (e.g., OpenAI node) with the necessary API keys.
-   **Implementation:**
    1.  **Construct the Prompt:** Create a prompt for the AI model. This prompt must include:
        -   The system prompt (`ai_prompt`) fetched from the `sites` table.
        -   The recent chat history fetched from the database.
        -   The user's latest message.
    2.  **Call the AI API:** Send the constructed prompt to the AI model.
    3.  **Process the Response:** Receive the text response from the AI.

---

### 6. HubSpot CRM Logic

-   **Connection:** Configure the HubSpot node with the necessary API credentials.
-   **Tasks:**
    1.  **Check/Create Contact:**
        -   Use the `user_id` (from the token) to check if a contact with a matching `ucloud_user_id` already exists in HubSpot.
        -   If not, create a new contact.
        -   If it exists, update it.
    2.  **Update Contact Properties:** Populate the custom properties on the HubSpot contact record as defined in the main `Task.md`:
        -   `ucloud_user_id`
        -   `ucloud_site_id`
        -   `ucloud_status` (e.g., set to 'engaged' on first message)
        -   `ucloud_first_message` / `ucloud_last_message`

---

### 7. Final Output

-   **On Success:** The workflow should end by sending a `200 OK` response back to the frontend. The body of the response should be a JSON object containing the AI's reply:
    ```json
    {
      "reply": "The full text of the AI's response."
    }
    ```
-   **On Error:** The workflow should handle errors gracefully and return appropriate HTTP status codes (e.g., 401, 500).

---

### Appendix: Database Schema

The following tables are expected to exist in the PostgreSQL database.

#### Table: `sites`
Stores configuration for each site.

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

#### Table: `chat_messages`
Stores the history of all conversations.

| Column      | Type        | Description                               |
| ----------- | ----------- | ----------------------------------------- |
| `id`        | `uuid`      | **Primary Key.** Unique message ID.       |
| `user_id`   | `string`    | User ID from the Zitadel JWT (`sub` claim). |
| `site_id`   | `string`    | **Foreign Key** to `sites.site_id`.       |
| `role`      | `string`    | Who sent the message: 'user' or 'ai'.     |
| `message`   | `text`      | The content of the message.               |
| `timestamp` | `timestamp` | Timestamp of the message.                 |

#### Table: `users`
Optional table to store user metadata.

| Column       | Type        | Description                               |
| ------------ | ----------- | ----------------------------------------- |
| `user_id`    | `string`    | **Primary Key.** User ID from Zitadel (`sub`). |
| `email`      | `string`    | User's email address.                     |
| `first_seen` | `timestamp` | When the user was first created.          |
| `last_seen`  | `timestamp` | When the user was last active.            |
