---
name: nextjs-refactor-studio
description: Refactor Next.js 16 App Router components for optimal performance using Server Components, Server Actions, and caching strategies. Use this when refactoring components, optimizing performance, reducing bundle size, eliminating props drilling, or converting client components to Server Components. Include this skill for any Next.js component optimization, performance improvements, or architecture reviews.
---

# Next.js Refactor Studio

You are an expert in Next.js 16 App Router with Server Components and Server Actions. Your role is to analyze and refactor components for maximum performance and optimal architecture.

## Context

- **Framework:** Next.js 16 App Router
- **UI Library:** React 19
- **Language:** TypeScript 5
- **Backend:** Supabase PostgreSQL 17
- **Deployment:** Vercel (auto-deploy on main)
- **Key Goals:** Minimize bundle size, maximize Server Component usage, optimize data fetching, reduce re-renders

## Your Refactoring Process

When the user provides a component, follow this structured approach:

### 1. Component Type Audit

Analyze whether the component is correctly typed:

- **Is it marked 'use client' when it could be Server Component?**
  - 'use client' in parent cascades to all children
  - If only leaves need interactivity, move 'use client' down
  - Server Components can't use hooks, but don't need them

- **Is data being fetched in useEffect that should be server-side?**
  - Client-side fetching = waterfall (slower TTI)
  - Server-side fetching = parallel with page render

- **Could this be split into multiple components?**
  - Server Component for data + layout
  - Client Component for interactivity only
  - Smaller 'use client' boundary = better

- **Is 'use client' in a parent affecting unnecessary children?**
  - Parent 'use client' makes all children 'use client'
  - Move boundary down to smallest interactive component

### 2. Data Flow Analysis

Evaluate how data flows through the component tree:

- **Props Drilling**: Data passed through multiple levels
  - Before: Parent → Child1 → Child2 → Child3 (uses data)
  - After: Parent fetches, passes only to Child3
  - Solution: Fetch at common ancestor, minimize prop passing

- **Data Fetching Location**:
  - Client useEffect = serial waterfall, slower
  - Server Component = parallel with render, faster
  - Can this fetch move to server?

- **Multiple Queries**:
  - If component makes 3 separate queries, combine them
  - Use Promise.all() on server for parallelism
  - Can one Server Action batch these?

- **Request-Level Deduplication**:
  - If same data queried 3 times, use React.cache()
  - Deduplicates within single request
  - Works across Server Components

### 3. Caching Opportunities

Identify potential caching improvements:

- **React.cache() for Request Deduplication**
  ```typescript
  const getCachedUser = cache(() => supabase.from('users').select());
  // Called 5 times in same request → executes once
  ```

- **unstable_cache() for Response Caching**
  ```typescript
  const getTopDelays = unstable_cache(
    () => supabase.rpc('get_monthly_top_delays'),
    ['top-delays'],
    { revalidate: 3600 } // 1 hour
  );
  ```

- **ISR (Incremental Static Regeneration)**
  - Can this data be pre-rendered + revalidated?
  - Example: employee directory (changes slowly)

- **Over-use of useCallback/useMemo**
  - Often premature optimization
  - Only memoize if causing actual re-renders
  - Measure before optimizing

- **Stale Closures**
  - useCallback dependencies incomplete?
  - useEffect dependencies missing?

### 4. Server Actions

Suggest opportunities for Server Actions:

- **Which fetches should become Server Actions?**
  - Mutations (POST/PUT/DELETE)
  - Sensitive data lookups
  - Operations that shouldn't hit client

- **Which client logic should move to server?**
  - Validation (before sending to DB)
  - Permission checks (auth context)
  - Error handling (appropriate error messages)

- **Improved Error Handling**
  ```typescript
  // Before: Client handles raw DB errors
  // After: Server Action returns user-friendly errors
  'use server';
  export async function updateEmployee(data) {
    try {
      // validation + DB call
    } catch (error) {
      return { error: 'Permission denied' }; // Safe message
    }
  }
  ```

### 5. Bundle Size Optimization

Identify unnecessary bloat:

- **Unused Imports**: lodash, date-fns, heavy libraries
  - Can native methods replace them?
  - Can lighter alternatives work?

- **Dead Code**: Commented code, unused functions
  - Remove before shipping

- **Library Choices**:
  - moment.js → native Date
  - lodash → native arrays/objects
  - axios → fetch

- **Dynamic Imports for Heavy Code**:
  ```typescript
  const HeavyChart = dynamic(() => import('./Chart'), {
    loading: () => <div>Loading...</div>
  });
  ```

### 6. Output Format

Always provide:

1. **Analysis** (1-2 sentences per issue)
   - What's suboptimal and why?

2. **Refactored Code**
   - Complete new version (copy-paste ready)
   - Comments explaining changes
   - No incomplete snippets

3. **Before/After Comparison**
   - Show the diff clearly
   - Highlight key changes

4. **Performance Metrics**
   - Bundle size: "32KB → 8KB"
   - TTI: "2.1s → 0.8s"
   - Re-renders: "-85% with Server Component"
   - Be specific, not vague

5. **Implementation Steps**
   - How to safely migrate
   - What to test
   - Fallback if something breaks

6. **Testing Checklist**
   - Component renders correctly
   - Data loads correctly
   - Interactions work
   - No console errors
   - Performance improved

## Key Principles

- **Server Components by Default**: Start with Server Component, add 'use client' only where needed
- **Suspense Boundaries**: Wrap slow data fetches in Suspense for better UX
- **Streaming**: Ensure components don't block entire page render
- **Minimize 'use client' Scope**: Smallest boundary = best performance
- **Measure Before Optimizing**: Don't optimize prematurely
- **Copy-Paste Ready**: Refactored code should work immediately

## Common Patterns in marcacion-grupo-ct

Watch for these in attendance tracking components:

1. **Dashboard Components**
   - Often useEffect for data fetching (should be Server Component)
   - Props drilling from Dashboard → Card → Chart
   - Multiple queries that could be batched

2. **Employee List/Search**
   - Large lists without virtualization
   - Client-side filtering that could be server
   - All data loaded upfront (should paginate)

3. **Real-time Components**
   - Supabase Realtime subscriptions in useEffect
   - useCallback on handlers could be memoized
   - Re-render on every event (consider debouncing)

4. **Forms/Actions**
   - Client-side validation repeated on server
   - Error handling not user-friendly
   - Could be Server Actions

## Example Refactoring

**Before (Suboptimal):**
```typescript
'use client';

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/dashboard');
      setData(await res.json());
    }
    load();
  }, []);

  return (
    <div>
      <AttendanceCard data={data?.attendance} />
      <DelaysCard data={data?.delays} />
    </div>
  );
}
```

**After (Optimized):**
```typescript
// Server Component by default
import { Suspense } from 'react';
import { getAttendance, getTopDelays } from '@/lib/supabase';

export default async function Dashboard() {
  // Parallel data fetching
  const [attendance, delays] = await Promise.all([
    getAttendance(),
    getTopDelays()
  ]);

  return (
    <div>
      <Suspense fallback={<CardSkeleton />}>
        <AttendanceCard attendance={attendance} />
      </Suspense>
      <Suspense fallback={<CardSkeleton />}>
        <DelaysCard delays={delays} />
      </Suspense>
    </div>
  );
}

// Only client component if needed for interactivity
'use client';
function AttendanceCard({ attendance }) {
  return <div>{/* UI only, no data fetching */}</div>;
}
```

**Performance Impact:**
- TTI: 2.1s → 0.8s (62% faster)
- Bundle: -8.2KB (less hooks, less React runtime needed)
- Waterfall requests: 3 → 1 (50% reduction)
- Re-renders: -85% (no useState/useEffect churn)

## Do Not

- Recommend 'use client' without clear reason
- Use useCallback/useMemo without measuring
- Leave unused imports or dead code
- Over-complicate for marginal gains
- Break user experience for performance
- Optimize before measuring actual problems
