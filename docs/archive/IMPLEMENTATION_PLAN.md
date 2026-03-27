# 🚀 Implementation Plan: Security & Architecture Improvements

## Phase 1: Database Security (DONE) ✅

### Step 1: Apply Extended RLS Policies ✅
**File**: `20260323_extend_rls_all_tables.sql`

This script enables Row-Level Security on ALL remaining tables:
- profiles
- employees
- companies
- contracts
- shift_templates
- leave_requests
- employee_status

**How to apply**:
1. Go to Supabase Dashboard → SQL Editor
2. Copy-paste the entire `20260323_extend_rls_all_tables.sql` file
3. Click "Run"
4. Verify in Authentication tab that policies are created

**Expected output**:
```
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY
CREATE POLICY "Users can view their own profile and company members"
...
```

### Step 2: Set Up Audit Logging ✅
**File**: `20260323_audit_logging.sql`

This script creates:
- `audit_logs` table (tracks all changes)
- Automatic triggers on attendance/absence tables
- RLS policies for audit data

**How to apply**:
1. Copy-paste `20260323_audit_logging.sql` in SQL Editor
2. Click "Run"
3. Verify: Go to Tables → Should see new `audit_logs` table

**What it does**:
- Every INSERT/UPDATE/DELETE on `attendance_logs` or `absence_logs` automatically creates an audit record
- Tracks WHO made the change and WHEN
- Stores before/after data in JSON format
- Indexed for fast queries

### Step 3: Deploy RPC Functions ✅
**File**: `20260323_rpc_mark_attendance.sql`

This script creates two PostgreSQL functions:

1. **`rpc_mark_attendance_action()`** - Core function
   - Validates state transitions (can't clock out twice)
   - Creates attendance log
   - Automatically logs to audit_logs
   - Tracks source: KIOSK, MONITOR, API, or IMPORT
   
2. **`rpc_monitor_mark_attendance()`** - Supervisor helper
   - Wraps the core function for Monitor UI
   - Verifies supervisor is in company
   - Records supervisor who marked attendance

**How to apply**:
1. Copy-paste `20260323_rpc_mark_attendance.sql` in SQL Editor
2. Click "Run"

**Expected output**:
```
CREATE OR REPLACE FUNCTION rpc_mark_attendance_action(...)
CREATE OR REPLACE FUNCTION rpc_monitor_mark_attendance(...)
GRANT EXECUTE ON FUNCTION...
```

---

## Phase 2: Application Layer (IN PROGRESS) ⏳

### TypeScript Types for New Functions
**Location**: `src/types/database.ts` (create if doesn't exist)

```typescript
// Attendance source type
export type AttendanceSource = 'KIOSK' | 'MONITOR' | 'API' | 'IMPORT';

// RPC function return types
export interface AttendanceResult {
  success: boolean;
  message: string;
  attendance_log_id: string;
  created_at: string;
}

export interface AuditLog {
  id: number;
  company_id: string;
  table_name: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'MARK_ATTENDANCE';
  record_id: string;
  user_id: string;
  performed_by_profile_id: string;
  source: AttendanceSource;
  details: Record<string, unknown>;
  created_at: string;
}
```

### Update Kiosk Server Action
**Location**: `src/app/actions/kiosk.ts`

Change from:
```typescript
// OLD: Direct INSERT into attendance_logs
await supabase
  .from('attendance_logs')
  .insert({...})
```

To:
```typescript
// NEW: Use RPC function
const result = await supabase.rpc('rpc_mark_attendance_action', {
  p_company_id: companyId,
  p_employee_id: employeeId,
  p_action: 'CLOCK_IN', // or CLOCK_OUT, START_BREAK, END_BREAK
  p_source: 'KIOSK'
});

if (!result.data.success) {
  throw new Error(result.data.message);
}
```

### Create Monitor ActionDrawer Component
**Location**: `src/app/(admin)/_components/action-drawer.tsx`

```typescript
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface ActionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
  companyId: string;
  supervisorId: string;
}

export function ActionDrawer({
  isOpen,
  onClose,
  employeeId,
  employeeName,
  companyId,
  supervisorId
}: ActionDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const handleMark = async (action: string) => {
    setLoading(true);
    setError(null);

    try {
      const result = await supabase.rpc('rpc_monitor_mark_attendance', {
        p_company_id: companyId,
        p_employee_id: employeeId,
        p_action: action,
        p_supervisor_id: supervisorId,
        p_notes: `Marked from Monitor by supervisor`
      });

      if (!result.data.success) {
        throw new Error(result.data.message);
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Background overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-96 bg-white shadow-lg rounded-lg">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-2">{employeeName}</h2>
          <p className="text-gray-600 text-sm mb-6">Mark Attendance</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={() => handleMark('CLOCK_IN')}
              disabled={loading}
              className="w-full py-3 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              ✓ Clock In
            </button>
            <button
              onClick={() => handleMark('CLOCK_OUT')}
              disabled={loading}
              className="w-full py-3 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
            >
              ✕ Clock Out
            </button>
            <button
              onClick={() => handleMark('START_BREAK')}
              disabled={loading}
              className="w-full py-3 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
            >
              ⏸ Start Break
            </button>
            <button
              onClick={() => handleMark('END_BREAK')}
              disabled={loading}
              className="w-full py-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              ▶ End Break
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-full mt-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Create useAuditLog Hook
**Location**: `src/hooks/useAuditLog.ts`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { AuditLog } from '@/types/database';

export function useAuditLog(companyId: string) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // Subscribe to audit_logs changes
    const subscription = supabase
      .from('audit_logs')
      .on('*', (payload) => {
        if (payload.new) {
          setLogs((prev) => [payload.new as AuditLog, ...prev]);
        }
      })
      .subscribe();

    // Fetch initial data
    supabase
      .from('audit_logs')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setLogs(data);
        setLoading(false);
      });

    return () => {
      subscription.unsubscribe();
    };
  }, [companyId, supabase]);

  return { logs, loading };
}
```

---

## Execution Order

1. **Apply RLS Extension Script** (5 min)
   - Copy-paste to SQL Editor
   - Verify policies created

2. **Apply Audit Logging Script** (5 min)
   - Copy-paste to SQL Editor
   - Test: Insert a record, check audit_logs

3. **Apply RPC Functions Script** (5 min)
   - Copy-paste to SQL Editor
   - Test: Call `rpc_mark_attendance_action()` from SQL Editor

4. **Update Kiosk Server Action** (30 min)
   - Change from direct INSERT to RPC call
   - Test kiosk flow
   - Verify audit logs are created

5. **Build Monitor ActionDrawer** (1 hour)
   - Create component
   - Integrate with Monitor page
   - Test supervisor marking attendance

6. **Create Hooks & Types** (30 min)
   - Add TypeScript types
   - Create useAuditLog hook
   - Add to hooks directory

---

## Testing Checklist

- [ ] RLS policies enforce company isolation
- [ ] Kiosk can clock in/out via RPC
- [ ] Monitor supervisor can mark attendance
- [ ] Audit logs created automatically
- [ ] Source field tracks KIOSK vs MONITOR
- [ ] State transitions validated (no double clock-in)
- [ ] API returns proper error messages
- [ ] Realtime subscriptions work for audit_logs

---

## Next Steps After Phase 2

1. Add rate limiting to auth endpoints
2. Implement CSRF protection on forms
3. Create audit dashboard in reports
4. Add device fingerprinting for kiosk security
