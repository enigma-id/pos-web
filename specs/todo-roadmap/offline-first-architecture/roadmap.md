# Roadmap: Offline-First POS System

## Overview
Status: In Progress
Complexity: Medium
Timeline: 2-3 weeks

## Kanban Board

| Todo | In Progress | Review | Done |
|------|-------------|--------|------|
| ... | Task 1.2-1.5, 2.1-6.5 | ... | Task 1.1 |

## Epic Breakdown

### Epic 1: Network Status & Detection
- Task 1.2: Create offline services directory
- Task 1.3: Create network status hook
- Task 1.4: Create OfflineBanner component
- Task 1.5: Add banner to layout

### Epic 2: IndexedDB Queue Infrastructure
- Task 2.1: Initialize IndexedDB database
- Task 2.2: Queue CRUD operations
- Task 2.3: Idempotency helpers
- Task 2.4: Metadata helpers

### Epic 3: Enhanced BaseQuery Integration
- Task 3.1: Modify baseQuery
- Task 3.2: Capture auth token
- Task 3.3: Handle offline response

### Epic 4: Sync Manager
- Task 4.1: Create SyncManager service
- Task 4.2: Implement retry logic
- Task 4.3: Sync completion handling
- Task 4.4: App init sync check

### Epic 5: UI Polish & Edge Cases
- Task 5.1: Create SyncIndicator badge
- Task 5.2: Create pending items drawer
- Task 5.3: Handle token expiry
- Task 5.4: Queue warning
- Task 5.5: Session close warning

### Epic 6: Testing & Cleanup
- Task 6.1-6.5: Comprehensive testing and cleanup
