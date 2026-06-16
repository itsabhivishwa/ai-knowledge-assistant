# 🤖 FloCard AI Intelligence Core & Gateway Engine

An enterprise-grade, high-security Knowledge Base Engine and RAG (Retrieval-Augmented Generation) Chat Platform built with Next.js 14, Tailwind CSS, and NextAuth.js. Featuring full role-based access nodes, real-time context streaming, and custom telemetry diagnostic layers.

![Production Shield](https://img.shields.io/badge/Security-OAuth_2.0-blue?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js_14-v14-black?style=for-the-badge&logo=next.js)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=for-the-badge&logo=tailwind-css)

---

## ⚡ Core Architecture Features

### 🛡️ Secure Authorization Gateway
* **Multi-Tenant OAuth Nodes:** Deep integration with corporate identity platforms (Google Cloud Identity Workspace, Microsoft Entra ID / Azure AD, and LinkedIn Developer API Hub).
* **Bespoke Redirection Pipeline:** Completely overrides default NextAuth UI layers using custom route managers to trap handshake rejection signals natively inside a premium glassmorphic interface.

### 💬 Fluid Workspace & Interactive Layout
* **Gemini-Inspired Chat Interface:** Smooth responsive layout supporting interactive streaming, inline chat history renames, conversational session pinning, and granular text snippet copy metrics.
* **Auto-Reactive Scrolling Nodes:** Fully synchronized UI engines that leverage DOM anchors to enforce immediate structural auto-scrolls down to active text streams or historic conversational baselines.

### 🔒 Admin Upload Gate & RAG Core
* **Role-Based Dropzone Protection:** Fully blurred interactive drag-and-drop file layout with visual key-lock encasements (🔒) restricting file indexing specifically to verified domain administrators.
* **Telemetry Diagnostics Dashboard:** A curved layout sliding sidebar providing low-level cosmographical logs (Cosine vector scores, response proxy rates, and active data session buffers).

---

## 🛠️ Tech Stack Matrix

* **Frontend:** Next.js (App Router), React 18, Tailwind CSS, TypeScript, Lucide Icons
* **Authentication Pipeline:** NextAuth.js (Session Context Wrappers, JWT handlers)
* **Backend Vector Node:** Python FastAPI Stack (Port `8000` context matching stream cluster)

---

## 🚀 Environment Blueprint Setup

Create a `.env.local` file in the root directory of your project and assign the mapped API constants:

\`\`\`env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_32_character_openssl_crypt_secret

# Google Platform Node
GOOGLE_CLIENT_ID=your_google_app_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret

# Microsoft Entra ID Node
AZURE_AD_CLIENT_ID=your_azure_active_directory_guid_id
AZURE_AD_CLIENT_SECRET=your_azure_application_secret_value
AZURE_AD_TENANT_ID=common

# LinkedIn Node
LINKEDIN_CLIENT_ID=your_linkedin_developer_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_app_client_secret

# System Permissions
NEXT_PUBLIC_ADMIN_EMAILS=your_verified_admin_email@gmail.com
\`\`\`

---

## ⚙️ Local Deployment Commands

Initialize the application stack in a local node network:

\`\`\`bash
# Install dependencies
npm install

# Port optimization kill sequence (optional for zombie threads)
npx kill-port 3000

# Execute the development environment
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) inside a clean browser workspace environment to activate the pipeline handshake.