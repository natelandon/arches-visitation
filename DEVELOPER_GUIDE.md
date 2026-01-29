# Developer Quick Reference - Code Patterns & Standards

A quick guide to coding standards and patterns used in this project.

---

## 📦 Project Structure

```
frontend/
├── src/
│   ├── components/          # React components
│   │   ├── Dashboard.tsx    # Main container
│   │   ├── Header.tsx       # Navigation header
│   │   ├── TimeSeriesChart.tsx
│   │   ├── MonthlyHeatmap.tsx
│   │   ├── MonthlyRank3D.tsx
│   │   ├── DataEntry.tsx
│   │   └── ChartExplanation.tsx
│   ├── store/              # Zustand state stores
│   │   ├── dataStore.ts
│   │   └── themeStore.ts
│   ├── types/              # TypeScript definitions
│   │   └── index.ts
│   ├── utils/              # Utility functions (TO CREATE)
│   │   └── formatting.ts   # Shared formatters
│   ├── config/             # Configuration (TO CREATE)
│   │   └── api.ts          # API endpoint config
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── vite.config.js
├── tsconfig.json
└── playwright.config.ts
```

---

## 🎨 Component Patterns

### 1. Functional Component with Hooks

```typescript
import { useState, useEffect, useMemo } from 'react'
import { useDataStore } from '../store/dataStore'

interface ComponentProps {
  title: string
  data: any[]
}

export default function MyComponent({ title, data }: ComponentProps): JSX.Element {
  const [state, setState] = useState<string>('initial')
  const storeData = useDataStore((state) => state.visitation)

  // Expensive calculation - use useMemo
  const processedData = useMemo(() => {
    return data.filter(item => item.active).sort((a, b) => b.value - a.value)
  }, [data])

  // Side effects - use useEffect with dependencies
  useEffect(() => {
    console.log('Component mounted or deps changed')
    
    return () => {
      console.log('Cleanup on unmount')
    }
  }, [processedData])

  const handleClick = () => {
    setState('new value')
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      <button onClick={handleClick}>Click me</button>
    </div>
  )
}
```

### 2. Container Component with Lazy Loading

```typescript
import { lazy, Suspense } from 'react'

// Lazy load heavy components
const HeavyChart = lazy(() => import('./HeavyChart'))
const HeavyForm = lazy(() => import('./HeavyForm'))

// Loading fallback
const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full" />
  </div>
)

export default function Container(): JSX.Element {
  return (
    <div>
      <Suspense fallback={<LoadingSpinner />}>
        <HeavyChart />
      </Suspense>
      
      <Suspense fallback={<LoadingSpinner />}>
        <HeavyForm />
      </Suspense>
    </div>
  )
}
```

### 3. Form Component with Validation

```typescript
import { useState, FormEvent, ChangeEvent } from 'react'

interface FormData {
  name: string
  email: string
  message: string
}

export default function FormComponent(): JSX.Element {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    message: '',
  })
  const [errors, setErrors] = useState<Partial<FormData>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }
    if (!formData.email.includes('@')) {
      newErrors.email = 'Valid email is required'
    }
    if (formData.message.length < 10) {
      newErrors.message = 'Message must be at least 10 characters'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // Clear error when user starts typing
    if (errors[name as keyof FormData]) {
      setErrors(prev => ({ ...prev, [name]: undefined }))
    }
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (!validateForm()) return
    
    setIsSubmitting(true)
    try {
      // API call here
      console.log('Submitting:', formData)
    } catch (error) {
      console.error('Submission failed:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          value={formData.name}
          onChange={handleChange}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'name-error' : undefined}
          className="w-full px-3 py-2 border rounded-md"
        />
        {errors.name && (
          <p id="name-error" className="mt-1 text-sm text-red-600">
            {errors.name}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="px-4 py-2 bg-accent text-accent-foreground rounded disabled:opacity-50"
      >
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  )
}
```

---

## 🏪 State Management Patterns

### Using Zustand Store

```typescript
// store/myStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface MyState {
  count: number
  items: string[]
  
  // Actions
  increment: () => void
  decrement: () => void
  addItem: (item: string) => void
  removeItem: (id: number) => void
}

export const useMyStore = create<MyState>()(
  persist(
    (set) => ({
      count: 0,
      items: [],
      
      increment: () => set((state) => ({ count: state.count + 1 })),
      decrement: () => set((state) => ({ count: state.count - 1 })),
      
      addItem: (item: string) =>
        set((state) => ({ items: [...state.items, item] })),
      
      removeItem: (id: number) =>
        set((state) => ({
          items: state.items.filter((_, i) => i !== id),
        })),
    }),
    {
      name: 'my-store', // persist to localStorage
    },
  ),
)

// Usage in component
import { useMyStore } from '../store/myStore'

export function MyComponent() {
  const count = useMyStore((state) => state.count)
  const increment = useMyStore((state) => state.increment)
  
  // ✅ Good: Subscribe to specific parts of state
  return <button onClick={increment}>{count}</button>
}

// ❌ Avoid: Subscribing to entire state
// const store = useMyStore()
```

---

## 🛠️ Utility Functions & Helpers

### Location: `src/utils/formatting.ts`

```typescript
// Number formatting with K/M notation
export const formatNumber = (num: number): string => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toLocaleString()
}

// Date formatting
export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

// Usage in components
import { formatNumber } from '../utils/formatting'

export function Stats() {
  const visitors = 1500000
  return <div>{formatNumber(visitors)}</div> // Renders: 1.5M
}
```

### Location: `src/config/api.ts`

```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const API_ENDPOINTS = {
  STATS: `${API_BASE_URL}/visitation/stats`,
  TIMESERIES: `${API_BASE_URL}/visitation/timeseries`,
  ANNUAL: `${API_BASE_URL}/visitation/annual`,
  DAILY: (year: number) => `${API_BASE_URL}/visitation/daily?year=${year}`,
} as const

// Type-safe fetch wrapper
export async function apiCall<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`API Error: ${response.statusText}`)
  return response.json()
}

// Usage
import { apiCall, API_ENDPOINTS } from '../config/api'

const stats = await apiCall<Stats>(API_ENDPOINTS.STATS)
```

---

## 🎨 Tailwind CSS Best Practices

### Do's ✅
```typescript
// Use semantic Tailwind classes
<button className="px-4 py-2 bg-accent text-accent-foreground rounded hover:opacity-90">
  Click me
</button>

// Use class composition for reusability
const buttonClasses = "px-4 py-2 bg-accent text-accent-foreground rounded hover:opacity-90"

// Use theme variables
<div className="bg-background text-foreground">
```

### Don'ts ❌
```typescript
// ❌ Avoid inline styles
<button style={{ backgroundColor: '#ff0000', padding: '10px' }}>

// ❌ Avoid arbitrary values
<button className="px-[17px] py-[9px]">

// ❌ Avoid complex class concatenation
className={`p-${size} bg-${color} text-${theme}`}
```

---

## 🧪 Testing Patterns

### Unit Test Structure

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import MyComponent from './MyComponent'

describe('MyComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with default props', () => {
    render(<MyComponent />)
    expect(screen.getByText('Expected text')).toBeInTheDocument()
  })

  it('handles user interactions', async () => {
    render(<MyComponent />)
    const button = screen.getByRole('button', { name: /click/i })
    
    button.click()
    
    expect(screen.getByText('After click')).toBeInTheDocument()
  })

  it('displays error state', () => {
    render(<MyComponent error="Error message" />)
    expect(screen.getByText('Error message')).toBeInTheDocument()
  })
})
```

### E2E Test Structure (Playwright)

```typescript
import { test, expect, Page } from '@playwright/test'

let page: Page

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page: testPage }) => {
    page = testPage
    await page.goto('http://localhost:5173')
    await page.waitForLoadState('networkidle')
  })

  test('loads and displays data', async () => {
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('svg').first()).toBeVisible()
  })

  test('switches tabs', async () => {
    const heatmapTab = page.getByRole('button', { name: /heatmap/i })
    await heatmapTab.click()
    
    await expect(
      page.getByRole('heading', { name: /monthly visitation/i })
    ).toBeVisible()
  })
})
```

---

## 🔒 TypeScript Patterns

### Define Props Interface
```typescript
interface HeaderProps {
  title: string
  subtitle?: string
  onClose?: () => void
}

export function Header({ title, subtitle, onClose }: HeaderProps) {
  // ...
}
```

### Type API Responses
```typescript
interface VisitationRecord {
  id?: number
  date: string
  visitors: number
}

interface Stats {
  total_visitors: number
  years_covered: number
  peak_month: string
}

async function fetchStats(): Promise<Stats> {
  const response = await fetch(API_ENDPOINTS.STATS)
  return response.json()
}
```

### Use Enums for Constants
```typescript
enum ViewMode {
  Absolute = 'absolute',
  Relative = 'relative',
}

const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Absolute)
```

---

## ♿ Accessibility Checklist

When building interactive components:

- [ ] Semantic HTML (`<button>`, `<label>`, `<header>`)
- [ ] ARIA attributes (`aria-label`, `aria-selected`, `role`)
- [ ] Keyboard navigation (Tab, Enter, Escape)
- [ ] Focus management (`tabIndex`, `focus()`)
- [ ] Color contrast (WCAG AA minimum)
- [ ] Form labels (`<label htmlFor="id">`)
- [ ] Error messaging (`aria-invalid`, `aria-describedby`)
- [ ] Loading states (`aria-live="polite"`)

Example:
```typescript
<button
  onClick={handleClick}
  aria-label="Close dialog"
  aria-pressed={isOpen}
  className="focus:ring-2 focus:ring-accent outline-none"
>
  ×
</button>
```

---

## 🚀 Performance Tips

### Use useMemo for Expensive Calculations
```typescript
const sorted = useMemo(() => {
  return data.sort((a, b) => b.value - a.value)
}, [data])
```

### Lazy Load Heavy Components
```typescript
const HeavyComponent = lazy(() => import('./Heavy'))

<Suspense fallback={<Loading />}>
  <HeavyComponent />
</Suspense>
```

### Avoid Inline Functions in render
```typescript
// ❌ Bad: New function created on every render
<button onClick={() => handleClick(item)}>

// ✅ Good: Use useCallback or extract function
const handleClick = useCallback((item) => {
  // ...
}, [])
```

---

## 📚 Common Commands

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm run preview         # Preview production build

# Testing
npm run test            # Run unit tests
npm run test:ui         # Run tests in browser
npm run test:e2e        # Run E2E tests
npm run test:e2e:ui     # Run E2E in browser

# Code Quality
npm run lint            # Check linting
npm run format          # Format code (if configured)

# Analysis
npm run build:analyze   # Analyze bundle (after setup)
```

---

## 🔗 Resources

- [React Docs](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Zustand Docs](https://github.com/pmndrs/zustand)
- [Tailwind CSS](https://tailwindcss.com)
- [Vite Guide](https://vitejs.dev/guide/)
- [Web Accessibility](https://www.w3.org/WAI/tutorials/)

