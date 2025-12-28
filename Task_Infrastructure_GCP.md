# Technical Specification (ТЗ) for GCP Infrastructure Repository

This document outlines the requirements for a dedicated Git repository that will manage the entire Google Cloud Platform (GCP) infrastructure for the AI Cabinet project using Terraform.

---

### 1. Core Objective

To define, create, and manage all necessary GCP resources for the AI Cabinet system using the "Infrastructure as Code" (IaC) paradigm with Terraform. This repository will be the single source of truth for the project's cloud infrastructure.

---

### 2. Repository Structure (Recommended)

A modular structure is required for clarity and reusability.

```
/
├── main.tf         # Main file, orchestrates module creation
├── variables.tf    # Defines input variables (project_id, region, etc.)
├── outputs.tf      # Defines outputs (e.g., database instance names)
├── terraform.tfvars.example # Example variables file
├── .gitignore      # Ignores .tfstate, .tfvars, etc.
└── modules/
    ├── cloud-sql/
    │   └── main.tf   # Module for creating a Cloud SQL PostgreSQL instance
    └── tailscale-gateway/
        └── main.tf   # Module for creating the Tailscale gateway VM
```

---

### 3. Resources to be Created

#### 3.1. Core Application Database
-   **Resource:** `Cloud SQL for PostgreSQL`.
-   **Purpose:** The master database for `users` and `sites` tables.
-   **Instance Size (Production):** `db-n2-standard-2` or similar.
-   **Settings:**
    -   High Availability (Regional) must be **enabled**.
    -   Automatic backups must be **enabled**.
    -   **Private IP** must be enabled. Public IP must be **disabled**.
    -   The `pgvector` extension is **not** required for this instance.

#### 3.2. RAG Service Database
-   **Resource:** `Cloud SQL for PostgreSQL`.
-   **Purpose:** The dedicated database for the RAG service, storing `chat_messages` and `knowledge_documents`.
-   **Instance Size (Production):** `db-n2-standard-4` or larger, optimized for CPU and RAM.
-   **Settings:**
    -   High Availability (Regional) must be **enabled**.
    -   **`pgvector` extension must be enabled** via database flags.
    -   **Private IP** must be enabled. Public IP must be **disabled**.

#### 3.3. Tailscale Gateway VM
-   **Resource:** `Compute Engine VM`.
-   **Purpose:** To act as a secure gateway, providing access to the Cloud SQL instances from the private Tailscale network.
-   **Instance Size:** `e2-micro` (or other cost-effective equivalent).
-   **Settings:**
    -   The VM must be deployed in the same VPC as the Cloud SQL instances.
    -   It must **not** have a public IP address.
    -   A **startup script** must be used to:
        1.  Install Tailscale.
        2.  Authenticate and connect to the Tailscale network using an auth key.
        3.  Install the Google Cloud SQL Auth Proxy.

---

### 4. Networking and Security

-   **VPC:** All resources must be deployed within a single VPC network.
-   **Access:** All access to the databases from application services (n8n, RAG service) must be routed through the **Tailscale Gateway VM** and the **Cloud SQL Auth Proxy**. Direct connections to the database's private IP should be configured within the proxy.
-   **Firewall Rules:** Firewall rules should be configured to allow necessary internal traffic while restricting all external access.

---

### 5. Configuration and Secrets Management

-   **Project ID & Region:** These should be defined as variables in `variables.tf` and provided via a `terraform.tfvars` file.
-   **`terraform.tfvars`:** This file will contain all sensitive data (GCP project ID, Tailscale auth key) and **must be included in `.gitignore`**.
-   **Service Account:** Terraform will require a GCP Service Account with appropriate permissions (`Cloud SQL Admin`, `Compute Admin`, etc.) to manage the resources. The credentials for this service account should be configured securely on the machine where Terraform commands are executed.

---

### 6. Deployment Workflow

1.  Clone the infrastructure repository.
2.  Create a `terraform.tfvars` file from the `terraform.tfvars.example` template and fill in the required values.
3.  Authenticate with GCP (e.g., `gcloud auth application-default login`).
4.  Run `terraform init` to initialize the workspace.
5.  Run `terraform plan` to review the planned changes.
6.  Run `terraform apply` to create or update the infrastructure.
