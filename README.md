# rabbit: LoxiLB Load Balancer Management Dashboard

A React-based web dashboard for efficiently managing LoxiLB load balancers and network services.

---

## 1. Project Overview

- **Project Name:** rabbit
- **Description:** A dashboard web application for LoxiLB load balancer and network service management
- **Core Features:**
  - LoxiLB load balancer status and configuration monitoring
  - Real-time network service/device management and control
  - Comprehensive statistics and visualization
  - User-friendly UI/UX

---

## 2. Tech Stack

- **Main Frameworks/Libraries:**
  - React 18
  - TypeScript
  - MUI (Material UI)
  - Emotion (styled, react)
  - Tanstack React Query
  - Recoil
  - react-hook-form
  - dayjs, i18next, etc.
- **Styling Tools:**
  - Emotion, MUI
- **State Management & Others:**
  - Recoil, React Query, i18next (internationalization)

---

## 3. Project Structure

```root
src/
├── App.tsx
├── atoms.tsx
├── common.ts
├── components/      # UI components
├── connector/       # API/network integration
├── extracts.ts
├── hooks/           # Custom hooks
├── index.tsx
├── locales/         # Internationalization resources
├── pages/           # Route-based pages
├── theme.ts
├── types/           # Type definitions
└── ...
```

---

## 4. Getting Started

```bash
git clone <YOUR_REPO_URL>
cd rabbit
npm i
npm start
```

---

## 5. Available Scripts

| Command           | Description                |
| ----------------- | -------------------------- |
| `npm build`       | Local environment build    |
| `npm build:dev`   | Development environment build |
| `npm build:prod`  | Production environment build |
| `npm start`       | Run development server     |

---

## 5-1. Code Style and Linting/Formatting Tools

- **Formatter:** Prettier (VSCode extension: esbenp.prettier-vscode)
  - Auto-formatting on save in VSCode (`editor.formatOnSave: true`)
  - Prettier is set as default formatter in `.vscode/settings.json`

---

## 6. Environment Variables (.env)

- Refer to `.env.sample` file
- Environment-specific files: `.env.local`, `.env.dev`, `.env.prod`, etc.
- Key examples and descriptions:

```env
REACT_APP_API_URL=https://oam-1.loxilb.io/oam   # API server address
REACT_APP_ENV=local|production                  # Environment type
REACT_APP_PUBLIC_URL=/netlox                    # Public URL prefix
PORT=3000                                       # Development server port
```

---

## 7. Development Guide

- **Naming Convention:** Components use PascalCase, hooks use 'use' prefix
- **Commit Messages:** Conventional Commits recommended (e.g., feat: ~, fix: ~, docs: ~)
- **Branch Strategy:** main / dev / feature/issue-number-description (e.g., feature/123-add-login)
- **Implementation Notes:** Search for `!!!` (three exclamation marks) to find temporary code lines that need implementation

---

## 8. Deployment Information

- **Deployment Platform:** Test server (internal network)
- **Deployment URL:** To be updated
- **Deployment Method:** Manual/automatic deployment via deploy.ps1 (PowerShell script)
- **Deployment Process:**
  1. Run `deploy.ps1` (refer to parameters if needed)
  2. Build for each environment and upload to server
  3. For direct package code deployment, run 'make-package.ps1' to generate release.zip file

---

## 9. Testing Information

- **Testing Tools:** (To be introduced, e.g., React Testing Library, Vitest, etc.)
- **Running Tests:** (When tools are introduced, run with `npm test`, etc.)

---

## 10. Additional Information

- **License:** (To be specified, e.g., MIT)
- **Contributing Guide:** (Add if needed, e.g., PR rules, code review, etc.)
- **References:** LoxiLB official documentation, internal network policies, etc.

---

> This document was created to help understand and collaborate on the rabbit (LoxiLB Dashboard) project.
