# LoxiLB UI Development Documentation

A comprehensive guide for developers working on the React-based LoxiLB load balancer management dashboard.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Development Setup](#development-setup)
4. [Project Structure](#project-structure)
5. [Key Technologies & Libraries](#key-technologies--libraries)
6. [Development Guidelines](#development-guidelines)
7. [State Management](#state-management)
8. [API Integration](#api-integration)
9. [Component Architecture](#component-architecture)
10. [Styling & Theming](#styling--theming)
11. [Internationalization](#internationalization)
12. [Testing](#testing)
13. [Build & Deployment](#build--deployment)
14. [Debugging & Troubleshooting](#debugging--troubleshooting)
15. [Contributing](#contributing)

---

## Project Overview

**Project Name:** rabbit (LoxiLB UI Dashboard)

**Purpose:** A React-based web dashboard for efficiently managing LoxiLB load balancers and network services.

### Core Features
- LoxiLB load balancer status and configuration monitoring
- Real-time network service/device management and control
- Comprehensive statistics and visualization
- User-friendly UI/UX with responsive design
- Multi-language support (Korean, English, Japanese)

### Target Users
- Network administrators
- DevOps engineers
- System administrators managing LoxiLB infrastructure

---

## Architecture

### High-Level Architecture
```
┌──────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend │────│   LoxiLB API    │────│   LoxiLB Core   │
│   (rabbit)       │    │   (OAM)         │    │   Load Balancer │
└──────────────────┘    └─────────────────┘    └─────────────────┘
```

### Frontend Architecture Pattern
- **Pattern:** Feature-based architecture with component-driven development
- **State Management:** Recoil for global state, React Query for server state
- **Routing:** React Router v7 for client-side routing
- **UI Framework:** Material-UI (MUI) with Emotion for styling

---

## Development Setup

### Prerequisites
- Node.js 16+ 
- npm or yarn
- Git

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd loxilb-ui

# Install dependencies
npm install

# Create environment file
cp .env.sample .env.local
# Edit .env.local with your configuration

# Start development server
npm start
```

### Environment Variables
```env
# API Configuration
REACT_APP_API_URL=https://oam-1.loxilb.io/oam   # LoxiLB OAM API endpoint
REACT_APP_ENV=local|development|production       # Environment type
REACT_APP_PUBLIC_URL=/netlox                     # Public URL prefix

# Development
PORT=3000                                         # Development server port
```

### Available Scripts
| Command | Description |
|---------|-------------|
| `npm start` | Start development server |
| `npm run build` | Build for local environment |
| `npm run build:dev` | Build for development environment |
| `npm run build:prod` | Build for production environment |

---

## Project Structure

```
src/
├── App.tsx                 # Main application component
├── index.tsx              # Application entry point
├── atoms.tsx              # Recoil global state atoms
├── common.ts              # Utility functions and helpers
├── theme.ts               # MUI theme configuration
├── assets/                # Static assets (images, icons, animations)
│   ├── animation/
│   ├── image/
│   ├── json/
│   └── logo/
├── components/            # Reusable UI components
│   ├── animation/         # Animation components
│   ├── card/              # Card components
│   ├── element/           # Basic UI elements
│   ├── input/             # Form input components
│   ├── layout/            # Layout components
│   ├── menu/              # Navigation menu components
│   ├── modal/             # Modal dialog components
│   ├── panel/             # Panel components
│   ├── table/             # Data table components
│   └── view/              # View components
├── connector/             # API integration layer
│   ├── extracts.ts        # Data extraction utilities
│   ├── fetcher/           # HTTP client implementations
│   ├── instance/          # Instance management APIs
│   └── oam/               # OAM (Operations, Administration, Maintenance) APIs
├── hooks/                 # Custom React hooks
│   ├── alertHook.ts       # Alert handling
│   ├── inputFormHook.ts   # Form input management
│   ├── instanceHook.ts    # Instance operations
│   ├── localStorageHook.ts # Local storage management
│   ├── menuHook.ts        # Menu state management
│   ├── popupHook.ts       # Popup management
│   └── query/             # React Query hooks
├── locales/               # Internationalization resources
│   ├── en.json            # English translations
│   ├── ja.json            # Japanese translations
│   ├── ko.json            # Korean translations
│   └── i18n.ts            # i18n configuration
├── pages/                 # Page components (route handlers)
│   ├── DashboardPage.tsx  # Main dashboard
│   ├── HomePage.tsx       # Home page
│   ├── InstancePage.tsx   # Instance management
│   ├── LoginPage.tsx      # Authentication
│   ├── SystemPage.tsx     # System configuration
│   ├── network/           # Network management pages
│   ├── status/            # Status monitoring pages
│   └── traffic/           # Traffic management pages
└── types/                 # TypeScript type definitions
    ├── global.ts          # Global type definitions
    ├── menu.ts            # Menu-related types
    ├── load_balancer.ts   # Load balancer types
    ├── firewall.ts        # Firewall types
    ├── bgp_neighbor.ts    # BGP neighbor types
    └── ...                # Other domain-specific types
```

---

## Key Technologies & Libraries

### Core Framework
- **React 18:** Modern React with hooks and concurrent features
- **TypeScript 4.9+:** Type safety and enhanced developer experience
- **React Router v7:** Client-side routing

### State Management
- **Recoil:** Global application state management
- **Tanstack React Query v5:** Server state management, caching, and synchronization
- **React Hook Form:** Efficient form state management

### UI Framework & Styling
- **Material-UI (MUI) v6:** Component library
- **Emotion:** CSS-in-JS styling solution
- **MUI X Data Grid:** Advanced data table functionality
- **MUI X Charts:** Data visualization components

### Development Tools
- **React Scripts:** Build tooling and development server
- **i18next:** Internationalization framework
- **dayjs:** Date manipulation library

---

## Development Guidelines

### Code Style
- Use TypeScript for all new files
- Follow functional component patterns with hooks
- Use PascalCase for components, camelCase for functions/variables
- Use meaningful, descriptive names
- Keep components small and focused (Single Responsibility Principle)

### File Naming Conventions
- Components: `PascalCase.tsx` (e.g., `LoadBalancerPage.tsx`)
- Hooks: `camelCase.ts` with `use` prefix (e.g., `useInstanceHook.ts`)
- Types: `camelCase.ts` (e.g., `load_balancer.ts`)
- Utilities: `camelCase.ts` (e.g., `common.ts`)

### Component Guidelines
```typescript
// Good: Functional component with proper typing
interface IMyComponentProps {
  title: string;
  onSubmit: (data: FormData) => void;
}

const MyComponent: React.FC<IMyComponentProps> = ({ title, onSubmit }) => {
  // Component logic
  return <div>{title}</div>;
};

export default MyComponent;
```

### Import Organization
```typescript
//---------------------------------------------------------
// External imports
//---------------------------------------------------------
import { useState, useEffect } from 'react';
import { Button, TextField } from '@mui/material';

//---------------------------------------------------------
// Internal imports
//---------------------------------------------------------
import { useInstanceHook } from 'hooks/instanceHook';
import { ILoadBalancer } from 'types/load_balancer';
```

### Error Handling
- Use try-catch blocks for async operations
- Implement proper error boundaries for React components
- Show user-friendly error messages
- Log errors for debugging purposes

---

## State Management

### Recoil Atoms (Global State)
Located in `atoms.tsx`:

```typescript
// Authentication state
export const is_logged_in_atom = atom({
  key: 'is_logged_in',
  default: is_logged_in(),
});

// Popup state
export const is_open_popup_atom = atom<IPopupState>({
  key: 'is_open_popup',
  default: { 
    is_open: false, 
    title: '', 
    contents: '', 
    // ... other properties
  },
});

// Menu state
export const menu_states_atom = atom({
  key: 'menu_states',
  default: {},
});
```

### React Query (Server State)
- Used for API calls, caching, and server state synchronization
- Query keys follow the pattern: `['entity', 'operation', ...params]`
- Mutations handle create, update, delete operations

Example usage:
```typescript
// In a custom hook
export const useLoadBalancers = () => {
  return useQuery({
    queryKey: ['loadbalancers', 'list'],
    queryFn: () => fetchLoadBalancers(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
```

---

## API Integration

### API Layer Structure
The `connector/` directory contains the API integration layer:

- `fetcher/` - HTTP client implementations
  - `fetcher_base.ts` - Base HTTP client with authentication
  - `fetcher_oam.ts` - OAM-specific API calls
  - `fetcher_inst.ts` - Instance management APIs

### Authentication
- JWT token-based authentication
- Tokens stored in localStorage
- Automatic redirect to login on unauthorized access

### API Error Handling
```typescript
// Automatic error handling in base fetcher
export async function api_call(endpoint: string, options: RequestOptions): Promise<SimpleResponse> {
  try {
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        'Authorization': `Bearer ${get_local_storage('access_token')}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (response.status === 401) {
      forced_relocation_to_login();
      return { code: 401, data: null, message: 'Unauthorized' };
    }

    // Handle other status codes...
    
    return await response.json();
  } catch (error) {
    // Error handling logic
  }
}
```

---

## Component Architecture

### Component Hierarchy
```
App
├── Layout
│   ├── NavLayout
│   │   ├── Sidebar Menu
│   │   └── TopBar
│   └── Main Content Area
├── Router
│   ├── Public Routes (Login, 404, etc.)
│   └── Protected Routes (Dashboard, Instance, etc.)
└── Global Components
    ├── PopUp (Modal dialogs)
    └── ScrollToTop
```

### Reusable Components

#### Form Components
- Located in `components/input/`
- Use `react-hook-form` for form state management
- Support validation and error handling

#### Table Components
- Located in `components/table/`
- Built on MUI X Data Grid
- Support sorting, filtering, pagination

#### Modal Components
- Located in `components/modal/`
- Consistent modal patterns across the application
- Support different modal types (confirmation, form, info)

---

## Styling & Theming

### Theme Configuration
Located in `theme.ts`:

```typescript
export const theme_config: ThemeOptions = {
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          cursor: 'pointer',
          userSelect: 'none',
          minWidth: 0,
        },
      },
      defaultProps: {
        disableElevation: true,
      },
    },
    // Other component overrides...
  },
  // Palette, typography, etc.
};
```

### Styling Approaches
1. **MUI sx prop** for component-specific styles
2. **Emotion styled components** for reusable styled components
3. **MUI theme overrides** for global component styling

### Responsive Design
- Use MUI breakpoints: `xs`, `sm`, `md`, `lg`, `xl`
- Mobile-first approach
- Test on various screen sizes

---

## Internationalization

### Configuration
Located in `locales/i18n.ts`:

```typescript
i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ko: { translation: ko },
      ja: { translation: ja },
    },
    lng: 'en', // Default language
    fallbackLng: 'en',
    // Other i18n options...
  });
```

### Usage in Components
```typescript
import { useTranslation } from 'react-i18next';

const MyComponent = () => {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('dashboard.title')}</h1>
      <p>{t('dashboard.description')}</p>
    </div>
  );
};
```

### Translation Files
- `en.json` - English translations
- `ko.json` - Korean translations  
- `ja.json` - Japanese translations

Use nested keys for organization:
```json
{
  "dashboard": {
    "title": "Dashboard",
    "subtitle": "Load Balancer Overview"
  },
  "loadbalancer": {
    "create": "Create Load Balancer",
    "edit": "Edit Load Balancer"
  }
}
```

---

## Testing

### Testing Strategy
- **Unit Tests:** Component testing with React Testing Library
- **Integration Tests:** API integration testing
- **E2E Tests:** End-to-end user workflows

### Testing Tools (To be implemented)
- React Testing Library
- Jest
- MSW (Mock Service Worker) for API mocking

### Test File Structure
```
src/
├── components/
│   ├── Button/
│   │   ├── Button.tsx
│   │   └── Button.test.tsx
```

---

## Build & Deployment

### Build Process
```bash
# Development build
npm run build:dev

# Production build  
npm run build:prod
```

### Environment-specific Builds
- **Local:** `.env.local` - Development with local API
- **Development:** `.env.development` - Development environment
- **Production:** `.env.production` - Production environment

### Deployment Scripts
- `deploy.ps1` - PowerShell deployment script
- `make-package.ps1` - Creates release.zip package

### Build Optimization
- Code splitting with React.lazy()
- Bundle analysis with webpack-bundle-analyzer
- Asset optimization and compression

---

## Debugging & Troubleshooting

### Common Issues

#### Authentication Issues
- Check if token exists in localStorage
- Verify API endpoint in environment variables
- Check network connectivity to OAM server

#### Build Issues
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check TypeScript errors: `npx tsc --noEmit`
- Verify environment variables are properly set

#### Runtime Errors
- Check browser console for JavaScript errors
- Verify API responses in Network tab
- Check Recoil DevTools for state issues

### Development Tools
- **React Developer Tools** - Component tree inspection
- **Recoil DevTools** - State management debugging
- **React Query DevTools** - Server state debugging

### Debugging Techniques
```typescript
// Debug API calls
console.log('API Call:', endpoint, options);

// Debug component renders
useEffect(() => {
  console.log('Component rendered with props:', props);
}, [props]);

// Debug state changes
const debugValue = useRecoilValue(someAtom);
console.log('Atom value changed:', debugValue);
```

### Code Quality Tools
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **TypeScript** - Type checking

---

## Contributing

### Development Workflow
1. Create feature branch: `git checkout -b feature/issue-number-description`
2. Make changes following coding guidelines
3. Test changes thoroughly
4. Submit pull request with clear description

### Code Review Checklist
- [ ] Code follows style guidelines
- [ ] Components are properly typed
- [ ] No console.log statements in production code
- [ ] Error handling is implemented
- [ ] Responsive design is tested
- [ ] Accessibility guidelines are followed

### Commit Message Format
Follow Conventional Commits:
```
feat: add load balancer creation form
fix: resolve authentication token expiry issue
docs: update API documentation
style: fix code formatting
refactor: restructure component hierarchy
test: add unit tests for LoadBalancer component
```

### TODO Markers
Search for `!!!` in codebase to find temporary implementation notes and TODOs.

---

## Additional Resources

### External Documentation
- [React Documentation](https://react.dev/)
- [Material-UI Documentation](https://mui.com/)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Recoil Documentation](https://recoiljs.org/)
- [LoxiLB Official Documentation](https://loxilb.io/)

### Internal Resources
- API Documentation (OAM endpoints)
- Network infrastructure documentation
- Deployment procedures

---

*This documentation serves as a comprehensive guide for developers working on the LoxiLB UI project. Keep it updated as the project evolves.*
