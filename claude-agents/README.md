# LoxiLB-UI Claude Agents

Multi-agent system for efficient React/TypeScript frontend development with specialized domain experts.

## Quick Start

### Available Commands

```bash
# Full feature development
/loxilb-ui:feature "real-time network monitoring"

# Component development
/loxilb-ui:component "create AlertSummaryCard"

# React architecture and hooks
/loxilb-ui:react "optimize dashboard re-renders"

# API integration
/loxilb-ui:api "add topology endpoint connector"

# Performance optimization
/loxilb-ui:optimize "dashboard performance"

# Page development
/loxilb-ui:page "advanced metrics dashboard"
```

## Agent System Overview

### The 6 Specialized Agents

| Agent | Purpose | Primary Files |
|-------|---------|---------------|
| **React-Arch** | Architecture, hooks, performance | `src/hooks/`, `src/utils/` |
| **Component-Builder** | UI components, MUI | `src/components/`, `src/pages/` |
| **API-Integration** | REST APIs, React Query | `src/connector/`, `src/hooks/query/` |
| **State-Management** | Recoil, forms, cache | `src/atoms.tsx`, `src/hooks/*Hook.ts` |
| **Style-System** | MUI theming, CSS | `src/theme.ts`, `**/*.css` |
| **Test** | Testing, quality | `**/*.test.tsx` |

### Orchestrator

The **loxilb-ui-orchestrator** coordinates multiple agents for complex tasks:
- Analyzes task requirements
- Routes to appropriate agents
- Manages dependencies and sequencing
- Ensures quality gates

## Project Structure

```
claude-agents/
├── agents/                  # Agent definitions
│   ├── loxilb-ui-orchestrator.md
│   ├── agent-react-arch.md
│   ├── agent-component-builder.md  (to be created)
│   ├── agent-api-integration.md    (to be created)
│   ├── agent-state-management.md   (to be created)
│   ├── agent-style-system.md       (to be created)
│   └── agent-test.md               (to be created)
│
└── commands/                # Command shortcuts
    ├── feature.md          # Multi-agent feature
    ├── component.md        # Component development
    ├── react.md            # React architecture
    ├── api.md              # API integration
    ├── optimize.md         # Performance
    └── page.md             # Page development
```

## Workflow Examples

### Example 1: Create New Card Component

```bash
/loxilb-ui:component "Create TrafficHeatmapCard showing real-time traffic distribution"
```

**Agent Workflow**:
1. Component-Builder-Agent activates
2. Analyzes existing card patterns
3. Creates TrafficHeatmapCard.tsx
4. Implements MUI Grid layout
5. Adds responsive design
6. Ensures accessibility

### Example 2: Add New API Endpoint

```bash
/loxilb-ui:api "Add advanced metrics endpoint for real-time performance data"
```

**Agent Workflow**:
1. API-Integration-Agent activates
2. Creates `src/connector/instance/advancedMetrics.ts`
3. Implements GET_INST API calls
4. Creates React Query hook in `src/hooks/query/advancedMetricsHooks.ts`
5. Adds type definitions
6. Sets up cache strategies

### Example 3: Full Feature Development

```bash
/loxilb-ui:feature "Add dark mode support with theme switcher"
```

**Multi-Agent Workflow**:
```
1. React-Arch-Agent:
   - Design theme switching architecture
   - Plan state management approach

2. State-Management-Agent:
   - Create theme atom in src/atoms.tsx
   - Setup localStorage persistence

3. Style-System-Agent:
   - Create dark theme in src/theme.ts
   - Update MUI palette
   - Add CSS variables

4. Component-Builder-Agent:
   - Create ThemeSwitcher component
   - Update Layout with switcher
   - Ensure all components support dark mode

5. Test-Agent:
   - Test theme switching
   - Validate localStorage persistence
   - Accessibility testing
```

### Example 4: Performance Optimization

```bash
/loxilb-ui:optimize "Dashboard page has too many re-renders"
```

**Multi-Agent Workflow**:
```
1. React-Arch-Agent:
   - Profile component tree
   - Identify unnecessary re-renders
   - Analyze hook dependencies

2. React-Arch-Agent:
   - Apply React.memo to cards
   - Optimize useEffect dependencies
   - Add useMemo for calculations

3. Component-Builder-Agent:
   - Refactor card components
   - Extract stable child components

4. State-Management-Agent:
   - Optimize Recoil selectors
   - Configure React Query staleTime

5. Test-Agent:
   - Performance benchmarks
   - Validate improvements
```

## Implementation Status

### ✅ Completed (All Agents Ready!)
- [x] Comprehensive analysis document
- [x] Agent architecture design
- [x] Orchestrator agent definition
- [x] React-Arch agent definition - **COMPLETE**
- [x] Component-Builder agent - **COMPLETE**
- [x] API-Integration agent - **COMPLETE**
- [x] State-Management agent - **COMPLETE**
- [x] Style-System agent - **COMPLETE**
- [x] Test agent - **COMPLETE**
- [x] All command templates - **COMPLETE**

### 🚀 Ready to Use
All 6 specialized agents are implemented and ready for use!

### 📋 Next Steps
1. Start using agents with real tasks
2. Test workflows and validate patterns
3. Gather feedback and refine
4. Expand agent capabilities as needed

## Testing the System

### Test Cases

**Test 1: Component Creation**
```bash
/loxilb-ui:component "Create a PerformanceMetricsCard that shows CPU/Memory/Network usage with sparklines"
```
Expected: Component-Builder agent creates card with MUI components and charts

**Test 2: Hook Optimization**
```bash
/loxilb-ui:react "The useMetrics hook is causing too many re-renders, optimize it"
```
Expected: React-Arch agent analyzes and optimizes hook dependencies

**Test 3: API Integration**
```bash
/loxilb-ui:api "Add connector for /config/topology endpoint with WebSocket support"
```
Expected: API-Integration agent creates connector and React Query hook

**Test 4: Full Feature**
```bash
/loxilb-ui:feature "Add export functionality to download dashboard data as CSV/JSON"
```
Expected: Multi-agent coordination (React-Arch → Component-Builder → Test)

## Best Practices

### When to Use Each Command

**Use `/loxilb-ui:feature`** when:
- Building complete features spanning multiple layers
- Need coordination across architecture, API, state, UI
- Example: "Add user preferences system"

**Use `/loxilb-ui:component`** when:
- Creating new components
- Refactoring existing components
- Enhancing component UX
- Example: "Refactor AlertCard for better mobile UX"

**Use `/loxilb-ui:react`** when:
- Designing custom hooks
- Optimizing performance
- Resolving re-render issues
- Example: "Create useWebSocket hook with reconnection"

**Use `/loxilb-ui:api`** when:
- Integrating new endpoints
- Modifying data fetching
- Optimizing API queries
- Example: "Add pagination to loadbalancer list"

**Use `/loxilb-ui:optimize`** when:
- Performance issues
- Bundle size problems
- Memory leaks
- Example: "Optimize initial page load time"

**Use `/loxilb-ui:page`** when:
- Creating new pages
- Redesigning layouts
- Page-level refactoring
- Example: "Create system health monitoring page"

## Integration with SuperClaude

These agents integrate seamlessly with the SuperClaude framework:

- **Serena MCP**: Project memory and session persistence
- **Sequential MCP**: Complex analysis and planning
- **Context7 MCP**: React/MUI documentation lookup
- **Magic MCP**: UI component generation from patterns

## Troubleshooting

### Agent Not Activating

**Problem**: Command doesn't activate expected agent

**Solution**:
1. Check command syntax: `/loxilb-ui:react` not `/loxilb:react`
2. Use explicit command from commands/ directory
3. Check file patterns match your files

### Multiple Agents Needed

**Problem**: Task requires multiple agents but only one activates

**Solution**: Use `/loxilb-ui:feature` with `--agents` flag
```bash
/loxilb-ui:feature "task" --agents react,component,api
```

### Context Lost Between Agents

**Problem**: Later agents don't have context from earlier agents

**Solution**: Agents should use Serena write_memory() and read_memory()
```typescript
// Agent 1 completes
write_memory("react_architecture_decision", "Using WebSocket with React Query")

// Agent 2 starts
const architecture = read_memory("react_architecture_decision")
```

## Contributing

To add new agents:
1. Create agent definition in `claude-agents/agents/`
2. Follow template structure from existing agents
3. Add command shortcut in `claude-agents/commands/`
4. Update this README
5. Test with real tasks

## Support

For questions or issues:
1. Check existing agent definitions in `claude-agents/agents/`
2. Review workflow examples above
3. Consult comprehensive analysis in `claudedocs/loxilb-ui-agents-analysis-and-design.md`
