# Staffing Tracker API Documentation

## Table of Contents

1. [Introduction](#introduction)
2. [Base URLs](#base-urls)
3. [Authentication](#authentication)
4. [Rate Limiting](#rate-limiting)
5. [Error Handling](#error-handling)
6. [API Endpoints](#api-endpoints)
   - [Authentication](#authentication-endpoints)
   - [Projects](#projects-endpoints)
   - [Staff](#staff-endpoints)
   - [Assignments](#assignments-endpoints)
   - [Dashboard](#dashboard-endpoints)
   - [Reports](#reports-endpoints)
   - [Users](#users-endpoints)
   - [Billing](#billing-endpoints)
   - [Settings](#settings-endpoints)
7. [Interactive Documentation](#interactive-documentation)

---

## Introduction

The Staffing Tracker API is a comprehensive RESTful API for managing Kirkland & Ellis's internal project and team assignments. It provides endpoints for project management, staff management, team assignments, billing integration, and reporting.

**API Version:** 1.0.0

**Key Features:**
- Role-based access control (Admin, Editor, Viewer)
- JWT-based authentication with refresh tokens
- Comprehensive change history tracking
- Billing module integration
- Excel report generation
- Real-time dashboard statistics

---

## Base URLs

### Development
```
http://localhost:3000/api
```

### Production
```
https://staffing-tracker-production.up.railway.app/api
```

All API endpoints are prefixed with `/api`.

---

## Authentication

The API uses two authentication methods:

### 1. JWT Bearer Token (Primary)

Include the JWT access token in the Authorization header for all authenticated requests:

```http
Authorization: Bearer <your_access_token>
```

**Token Expiration:** Access tokens expire after 15 minutes.

### 2. HTTP-Only Cookie (Refresh Token)

Refresh tokens are stored in HTTP-only cookies named `refreshToken` for security. These are automatically sent with requests to refresh endpoints.

**Token Expiration:** Refresh tokens expire after 7 days.

### Authentication Flow

1. **Login** - POST `/auth/login` to receive access token and refresh token cookie
2. **Use Access Token** - Include Bearer token in all API requests
3. **Refresh Token** - POST `/auth/refresh` when access token expires
4. **Logout** - POST `/auth/logout` to invalidate current session

### User Roles

- **admin**: Full system access, can manage users and system settings
- **editor**: Can create, update, and delete projects, staff, and assignments
- **viewer**: Read-only access to all resources

---

## Rate Limiting

### Password Reset Endpoint

The password reset endpoint (`POST /auth/reset-password`) is rate limited to:
- **3 requests per 15 minutes** per IP address

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 3
X-RateLimit-Remaining: 2
X-RateLimit-Reset: 1234567890
```

When rate limit is exceeded, the API returns:
```json
{
  "error": "Too many password reset attempts. Please try again later."
}
```

---

## Error Handling

The API uses standard HTTP status codes and returns errors in a consistent JSON format:

### Error Response Format

```json
{
  "error": "Error message description",
  "details": {
    "field": "Additional error context"
  }
}
```

### HTTP Status Codes

| Status Code | Description |
|------------|-------------|
| 200 | Success |
| 201 | Created successfully |
| 400 | Bad request - Invalid input data |
| 401 | Unauthorized - Invalid or missing authentication |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not found - Resource doesn't exist |
| 429 | Too many requests - Rate limit exceeded |
| 500 | Internal server error |

### Common Error Scenarios

**401 Unauthorized**
```json
{
  "error": "Invalid credentials"
}
```

**403 Forbidden**
```json
{
  "error": "Access denied - Admin only"
}
```

**404 Not Found**
```json
{
  "error": "Project not found"
}
```

**400 Bad Request**
```json
{
  "error": "Validation failed",
  "details": {
    "name": "Project name is required",
    "status": "Status must be one of: active, inactive, completed"
  }
}
```

---

## API Endpoints

### Authentication Endpoints

#### POST /auth/login
Authenticate user and receive access token.

**Request Body:**
```json
{
  "username": "admin",
  "password": "StrongPassword123!"
}
```

**Response (200):**
```json
{
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin",
    "staffId": null,
    "lastLogin": "2025-10-14T10:30:00Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Sets Cookie:**
- `refreshToken` (HTTP-only, 7 days expiration)

---

#### POST /auth/register
Register a new user (Admin only).

**Authentication:** Required (Bearer token)

**Authorization:** Admin only

**Request Body:**
```json
{
  "username": "newuser",
  "email": "newuser@example.com",
  "role": "editor",
  "staffId": 5
}
```

**Response (201):**
```json
{
  "id": 10,
  "username": "newuser",
  "email": "newuser@example.com",
  "role": "editor",
  "staffId": 5,
  "createdAt": "2025-10-14T10:30:00Z"
}
```

**Note:** A temporary password will be generated and should be provided to the user.

---

#### GET /auth/me
Get current authenticated user information.

**Authentication:** Required (Bearer token)

**Response (200):**
```json
{
  "id": 1,
  "username": "admin",
  "email": "admin@example.com",
  "role": "admin",
  "staffId": null,
  "lastLogin": "2025-10-14T10:30:00Z",
  "lastActivity": "2025-10-14T11:45:00Z"
}
```

---

#### POST /auth/refresh
Refresh the access token using the refresh token cookie.

**Authentication:** Refresh token cookie required

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Use Case:**
```javascript
// When you receive a 401 error, refresh the token
try {
  const response = await api.get('/projects');
} catch (error) {
  if (error.response.status === 401) {
    // Refresh token
    const refreshResponse = await api.post('/auth/refresh');
    // Retry original request with new token
    const retryResponse = await api.get('/projects', {
      headers: { Authorization: `Bearer ${refreshResponse.data.accessToken}` }
    });
  }
}
```

---

#### POST /auth/logout
Logout from current session (invalidates refresh token).

**Authentication:** Refresh token cookie required

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

---

#### POST /auth/logout-all
Logout from all sessions (invalidates all refresh tokens for the user).

**Authentication:** Required (Bearer token)

**Response (200):**
```json
{
  "message": "Logged out from all sessions successfully"
}
```

---

#### POST /auth/reset-password
Reset a user's password (Admin only).

**Authentication:** Required (Bearer token)

**Authorization:** Admin only

**Rate Limited:** 3 requests per 15 minutes

**Request Body:**
```json
{
  "userId": 5
}
```

**Response (200):**
```json
{
  "message": "Password reset successfully",
  "temporaryPassword": "TempPass123!"
}
```

---

### Projects Endpoints

#### GET /projects
Get all projects with optional filtering.

**Authentication:** Required (Bearer token)

**Query Parameters:**
- `status` (optional): Filter by project status
- `category` (optional): Filter by project category
- `search` (optional): Search projects by name

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/projects?status=active&category=M%26A" \
  -H "Authorization: Bearer <token>"
```

**Response (200):**
```json
[
  {
    "id": 1,
    "name": "Project Alpha",
    "category": "M&A",
    "status": "active",
    "priority": "high",
    "notes": "High priority acquisition",
    "sector": "Technology",
    "side": "Buy-side",
    "elStatus": "Pending",
    "timetable": "Q4 2025",
    "filingDate": "2025-11-01",
    "listingDate": null,
    "lastConfirmedAt": "2025-10-13T15:30:00Z",
    "createdAt": "2025-09-01T10:00:00Z",
    "updatedAt": "2025-10-13T15:30:00Z"
  }
]
```

---

#### GET /projects/categories
Get list of all available project categories.

**Authentication:** Required (Bearer token)

**Response (200):**
```json
[
  "M&A",
  "Capital Markets",
  "Restructuring",
  "Litigation",
  "General Corporate"
]
```

---

#### GET /projects/needing-attention
Get projects that require review or update.

**Authentication:** Required (Bearer token)

**Description:** Returns projects that haven't been confirmed in the last 7 days or have pending updates.

**Response (200):**
```json
[
  {
    "id": 3,
    "name": "Project Beta",
    "category": "Capital Markets",
    "status": "active",
    "lastConfirmedAt": "2025-10-01T10:00:00Z",
    "daysSinceConfirmation": 13
  }
]
```

---

#### GET /projects/:id
Get detailed information about a specific project.

**Authentication:** Required (Bearer token)

**Path Parameters:**
- `id` (required): Project ID

**Response (200):**
```json
{
  "id": 1,
  "name": "Project Alpha",
  "category": "M&A",
  "status": "active",
  "priority": "high",
  "notes": "High priority acquisition",
  "sector": "Technology",
  "side": "Buy-side",
  "elStatus": "Pending",
  "timetable": "Q4 2025",
  "filingDate": "2025-11-01",
  "listingDate": null,
  "lastConfirmedAt": "2025-10-13T15:30:00Z",
  "createdAt": "2025-09-01T10:00:00Z",
  "updatedAt": "2025-10-13T15:30:00Z",
  "assignments": [
    {
      "id": 1,
      "staffId": 5,
      "staffName": "John Doe",
      "position": "Senior Associate",
      "jurisdiction": "US",
      "startDate": "2025-09-01",
      "endDate": null
    }
  ],
  "bcAttorneys": [
    {
      "staffId": 10,
      "name": "Jane Smith",
      "position": "B&C Working Attorney"
    }
  ]
}
```

---

#### GET /projects/:id/change-history
Get complete change history for a project.

**Authentication:** Required (Bearer token)

**Path Parameters:**
- `id` (required): Project ID

**Response (200):**
```json
[
  {
    "id": 100,
    "projectId": 1,
    "changedBy": "admin",
    "changeType": "update",
    "changes": {
      "status": {
        "from": "pending",
        "to": "active"
      },
      "priority": {
        "from": "medium",
        "to": "high"
      }
    },
    "changedAt": "2025-10-13T15:30:00Z"
  }
]
```

---

#### POST /projects
Create a new project.

**Authentication:** Required (Bearer token)

**Authorization:** Admin or Editor

**Request Body:**
```json
{
  "name": "Project Gamma",
  "category": "M&A",
  "status": "active",
  "priority": "medium",
  "notes": "New acquisition project",
  "sector": "Healthcare",
  "side": "Sell-side",
  "elStatus": "In Progress",
  "timetable": "Q1 2026",
  "filingDate": "2026-01-15",
  "listingDate": null
}
```

**Response (201):**
```json
{
  "id": 15,
  "name": "Project Gamma",
  "category": "M&A",
  "status": "active",
  "priority": "medium",
  "notes": "New acquisition project",
  "sector": "Healthcare",
  "side": "Sell-side",
  "elStatus": "In Progress",
  "timetable": "Q1 2026",
  "filingDate": "2026-01-15",
  "listingDate": null,
  "createdAt": "2025-10-14T12:00:00Z",
  "updatedAt": "2025-10-14T12:00:00Z"
}
```

---

#### POST /projects/:id/confirm
Confirm/review a project status.

**Authentication:** Required (Bearer token)

**Path Parameters:**
- `id` (required): Project ID

**Description:** Updates the `lastConfirmedAt` timestamp to mark the project as reviewed.

**Response (200):**
```json
{
  "message": "Project confirmed successfully",
  "lastConfirmedAt": "2025-10-14T12:30:00Z"
}
```

---

#### PUT /projects/:id
Update an existing project.

**Authentication:** Required (Bearer token)

**Authorization:** Admin or Editor

**Path Parameters:**
- `id` (required): Project ID

**Request Body:** (all fields optional)
```json
{
  "name": "Project Alpha - Updated",
  "status": "completed",
  "priority": "low",
  "notes": "Project successfully completed"
}
```

**Response (200):**
```json
{
  "id": 1,
  "name": "Project Alpha - Updated",
  "category": "M&A",
  "status": "completed",
  "priority": "low",
  "notes": "Project successfully completed",
  "updatedAt": "2025-10-14T13:00:00Z"
}
```

---

#### DELETE /projects/:id
Delete a project.

**Authentication:** Required (Bearer token)

**Authorization:** Admin only

**Path Parameters:**
- `id` (required): Project ID

**Response (200):**
```json
{
  "message": "Project deleted successfully"
}
```

**Note:** This will also delete all associated assignments and change history.

---

#### POST /projects/:id/bc-attorneys
Add a B&C attorney to a project.

**Authentication:** Required (Bearer token)

**Authorization:** Admin or Editor

**Path Parameters:**
- `id` (required): Project ID

**Request Body:**
```json
{
  "staffId": 10
}
```

**Response (201):**
```json
{
  "projectId": 1,
  "staffId": 10,
  "staffName": "Jane Smith",
  "position": "B&C Working Attorney"
}
```

---

#### DELETE /projects/:id/bc-attorneys/:staffId
Remove a B&C attorney from a project.

**Authentication:** Required (Bearer token)

**Authorization:** Admin or Editor

**Path Parameters:**
- `id` (required): Project ID
- `staffId` (required): Staff ID

**Response (200):**
```json
{
  "message": "B&C attorney removed successfully"
}
```

---

### Staff Endpoints

#### GET /staff
Get all staff members.

**Authentication:** Required (Bearer token)

**Response (200):**
```json
[
  {
    "id": 1,
    "name": "John Doe",
    "email": "john.doe@kirkland.com",
    "position": "Senior Associate",
    "department": "Corporate",
    "status": "active",
    "notes": null,
    "createdAt": "2025-01-01T10:00:00Z",
    "updatedAt": "2025-10-01T15:30:00Z"
  }
]
```

---

#### GET /staff/:id
Get detailed information about a specific staff member.

**Authentication:** Required (Bearer token)

**Path Parameters:**
- `id` (required): Staff ID

**Response (200):**
```json
{
  "id": 1,
  "name": "John Doe",
  "email": "john.doe@kirkland.com",
  "position": "Senior Associate",
  "department": "Corporate",
  "status": "active",
  "notes": null,
  "createdAt": "2025-01-01T10:00:00Z",
  "updatedAt": "2025-10-01T15:30:00Z",
  "assignments": [
    {
      "id": 1,
      "projectId": 1,
      "projectName": "Project Alpha",
      "jurisdiction": "US",
      "startDate": "2025-09-01",
      "endDate": null
    }
  ]
}
```

---

#### GET /staff/:id/workload
Get staff member's workload information.

**Authentication:** Required (Bearer token)

**Path Parameters:**
- `id` (required): Staff ID

**Response (200):**
```json
{
  "staffId": 1,
  "staffName": "John Doe",
  "currentProjects": [
    {
      "projectId": 1,
      "projectName": "Project Alpha",
      "category": "M&A",
      "status": "active",
      "jurisdiction": "US",
      "startDate": "2025-09-01"
    }
  ],
  "totalProjects": 1,
  "utilizationPercentage": 45.5
}
```

---

#### GET /staff/:id/change-history
Get complete change history for a staff member.

**Authentication:** Required (Bearer token)

**Path Parameters:**
- `id` (required): Staff ID

**Response (200):**
```json
[
  {
    "id": 200,
    "staffId": 1,
    "changedBy": "admin",
    "changeType": "update",
    "changes": {
      "position": {
        "from": "Associate",
        "to": "Senior Associate"
      }
    },
    "changedAt": "2025-10-01T10:00:00Z"
  }
]
```

---

#### POST /staff
Create a new staff member.

**Authentication:** Required (Bearer token)

**Authorization:** Admin or Editor

**Request Body:**
```json
{
  "name": "Jane Smith",
  "email": "jane.smith@kirkland.com",
  "position": "Associate",
  "department": "M&A",
  "status": "active",
  "notes": "New hire"
}
```

**Response (201):**
```json
{
  "id": 20,
  "name": "Jane Smith",
  "email": "jane.smith@kirkland.com",
  "position": "Associate",
  "department": "M&A",
  "status": "active",
  "notes": "New hire",
  "createdAt": "2025-10-14T12:00:00Z",
  "updatedAt": "2025-10-14T12:00:00Z"
}
```

---

#### PUT /staff/:id
Update an existing staff member.

**Authentication:** Required (Bearer token)

**Authorization:** Admin or Editor

**Path Parameters:**
- `id` (required): Staff ID

**Request Body:** (all fields optional)
```json
{
  "position": "Senior Associate",
  "status": "active",
  "notes": "Promoted to Senior Associate"
}
```

**Response (200):**
```json
{
  "id": 1,
  "name": "John Doe",
  "position": "Senior Associate",
  "status": "active",
  "notes": "Promoted to Senior Associate",
  "updatedAt": "2025-10-14T13:00:00Z"
}
```

---

#### DELETE /staff/:id
Delete a staff member.

**Authentication:** Required (Bearer token)

**Authorization:** Admin only

**Path Parameters:**
- `id` (required): Staff ID

**Response (200):**
```json
{
  "message": "Staff member deleted successfully"
}
```

**Note:** This will also delete all associated assignments.

---

### Assignments Endpoints

#### GET /assignments
Get all project-staff assignments.

**Authentication:** Required (Bearer token)

**Response (200):**
```json
[
  {
    "id": 1,
    "projectId": 1,
    "projectName": "Project Alpha",
    "staffId": 5,
    "staffName": "John Doe",
    "jurisdiction": "US",
    "startDate": "2025-09-01",
    "endDate": null,
    "notes": null,
    "createdAt": "2025-09-01T10:00:00Z",
    "updatedAt": "2025-09-01T10:00:00Z"
  }
]
```

---

#### GET /assignments/:id
Get detailed information about a specific assignment.

**Authentication:** Required (Bearer token)

**Path Parameters:**
- `id` (required): Assignment ID

**Response (200):**
```json
{
  "id": 1,
  "projectId": 1,
  "projectName": "Project Alpha",
  "projectCategory": "M&A",
  "staffId": 5,
  "staffName": "John Doe",
  "staffPosition": "Senior Associate",
  "jurisdiction": "US",
  "startDate": "2025-09-01",
  "endDate": null,
  "notes": null,
  "createdAt": "2025-09-01T10:00:00Z",
  "updatedAt": "2025-09-01T10:00:00Z"
}
```

---

#### POST /assignments
Create a new assignment.

**Authentication:** Required (Bearer token)

**Authorization:** Admin or Editor

**Request Body:**
```json
{
  "projectId": 1,
  "staffId": 5,
  "jurisdiction": "US",
  "startDate": "2025-10-15",
  "endDate": null,
  "notes": "Lead associate on the project"
}
```

**Response (201):**
```json
{
  "id": 50,
  "projectId": 1,
  "staffId": 5,
  "jurisdiction": "US",
  "startDate": "2025-10-15",
  "endDate": null,
  "notes": "Lead associate on the project",
  "createdAt": "2025-10-14T12:00:00Z",
  "updatedAt": "2025-10-14T12:00:00Z"
}
```

---

#### POST /assignments/bulk
Create multiple assignments at once.

**Authentication:** Required (Bearer token)

**Authorization:** Admin or Editor

**Request Body:**
```json
{
  "assignments": [
    {
      "projectId": 1,
      "staffId": 5,
      "jurisdiction": "US",
      "startDate": "2025-10-15"
    },
    {
      "projectId": 1,
      "staffId": 6,
      "jurisdiction": "UK",
      "startDate": "2025-10-15"
    }
  ]
}
```

**Response (201):**
```json
[
  {
    "id": 51,
    "projectId": 1,
    "staffId": 5,
    "jurisdiction": "US",
    "startDate": "2025-10-15",
    "createdAt": "2025-10-14T12:00:00Z"
  },
  {
    "id": 52,
    "projectId": 1,
    "staffId": 6,
    "jurisdiction": "UK",
    "startDate": "2025-10-15",
    "createdAt": "2025-10-14T12:00:00Z"
  }
]
```

---

#### PUT /assignments/:id
Update an existing assignment.

**Authentication:** Required (Bearer token)

**Authorization:** Admin or Editor

**Path Parameters:**
- `id` (required): Assignment ID

**Request Body:** (all fields optional)
```json
{
  "jurisdiction": "EU",
  "endDate": "2025-12-31",
  "notes": "Project completed"
}
```

**Response (200):**
```json
{
  "id": 1,
  "projectId": 1,
  "staffId": 5,
  "jurisdiction": "EU",
  "endDate": "2025-12-31",
  "notes": "Project completed",
  "updatedAt": "2025-10-14T13:00:00Z"
}
```

---

#### DELETE /assignments/:id
Delete an assignment.

**Authentication:** Required (Bearer token)

**Authorization:** Admin or Editor

**Path Parameters:**
- `id` (required): Assignment ID

**Response (200):**
```json
{
  "message": "Assignment deleted successfully"
}
```

---

### Dashboard Endpoints

#### GET /dashboard/summary
Get high-level dashboard statistics.

**Authentication:** Required (Bearer token)

**Response (200):**
```json
{
  "totalProjects": 45,
  "activeProjects": 32,
  "totalStaff": 120,
  "activeStaff": 115,
  "totalAssignments": 156,
  "projectsNeedingAttention": 8
}
```

---

#### GET /dashboard/workload-report
Get staff workload distribution.

**Authentication:** Required (Bearer token)

**Response (200):**
```json
{
  "staffWorkloads": [
    {
      "staffId": 1,
      "staffName": "John Doe",
      "position": "Senior Associate",
      "activeProjects": 3,
      "utilizationPercentage": 75.0
    },
    {
      "staffId": 2,
      "staffName": "Jane Smith",
      "position": "Associate",
      "activeProjects": 2,
      "utilizationPercentage": 50.0
    }
  ],
  "averageUtilization": 62.5
}
```

---

#### GET /dashboard/activity-log
Get recent system activity.

**Authentication:** Required (Bearer token)

**Response (200):**
```json
[
  {
    "id": 500,
    "action": "create",
    "entityType": "project",
    "entityId": 15,
    "entityName": "Project Gamma",
    "performedBy": "admin",
    "timestamp": "2025-10-14T12:00:00Z"
  },
  {
    "id": 501,
    "action": "update",
    "entityType": "staff",
    "entityId": 5,
    "entityName": "John Doe",
    "performedBy": "editor1",
    "timestamp": "2025-10-14T11:30:00Z"
  }
]
```

---

#### GET /dashboard/change-history
Get detailed change history across all entities.

**Authentication:** Required (Bearer token)

**Response (200):**
```json
[
  {
    "id": 100,
    "entityType": "project",
    "entityId": 1,
    "entityName": "Project Alpha",
    "changedBy": "admin",
    "changeType": "update",
    "changes": {
      "status": {
        "from": "pending",
        "to": "active"
      }
    },
    "changedAt": "2025-10-14T10:00:00Z"
  }
]
```

---

### Reports Endpoints

#### GET /reports/staffing
Get staffing report data in JSON format.

**Authentication:** Required (Bearer token)

**Response (200):**
```json
{
  "staff": [
    {
      "id": 1,
      "name": "John Doe",
      "position": "Senior Associate",
      "activeProjects": 3,
      "projects": [
        {
          "projectId": 1,
          "projectName": "Project Alpha",
          "category": "M&A",
          "jurisdiction": "US"
        }
      ]
    }
  ],
  "projects": [
    {
      "id": 1,
      "name": "Project Alpha",
      "category": "M&A",
      "status": "active",
      "teamSize": 5
    }
  ],
  "summary": {
    "totalStaff": 120,
    "totalProjects": 45,
    "totalAssignments": 156
  }
}
```

---

#### GET /reports/staffing.xlsx
Download staffing report in Excel format.

**Authentication:** Required (Bearer token)

**Response (200):**
- Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Binary Excel file download

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/reports/staffing.xlsx" \
  -H "Authorization: Bearer <token>" \
  --output staffing-report.xlsx
```

**Excel File Contains:**
- Sheet 1: Staff list with project assignments
- Sheet 2: Project list with team members
- Sheet 3: Summary statistics

---

#### GET /project-reports
Get project report data in JSON format.

**Authentication:** Required (Bearer token)

**Response (200):**
```json
[
  {
    "projectId": 1,
    "projectName": "Project Alpha",
    "category": "M&A",
    "status": "active",
    "sector": "Technology",
    "side": "Buy-side",
    "teamMembers": [
      {
        "staffId": 5,
        "staffName": "John Doe",
        "position": "Senior Associate",
        "jurisdiction": "US"
      }
    ],
    "bcAttorneys": [
      {
        "staffId": 10,
        "staffName": "Jane Smith"
      }
    ]
  }
]
```

---

#### GET /project-reports/excel
Download project report in Excel format.

**Authentication:** Required (Bearer token)

**Response (200):**
- Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Binary Excel file download

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/project-reports/excel" \
  -H "Authorization: Bearer <token>" \
  --output project-report.xlsx
```

---

### Users Endpoints

**Note:** All user management endpoints require admin privileges.

#### GET /users
List all system users.

**Authentication:** Required (Bearer token)

**Authorization:** Admin only

**Response (200):**
```json
[
  {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin",
    "staffId": null,
    "lastLogin": "2025-10-14T10:00:00Z",
    "lastActivity": "2025-10-14T12:00:00Z",
    "createdAt": "2025-01-01T00:00:00Z"
  }
]
```

---

#### POST /users
Create a new user.

**Authentication:** Required (Bearer token)

**Authorization:** Admin only

**Request Body:**
```json
{
  "username": "newuser",
  "email": "newuser@example.com",
  "role": "editor",
  "staffId": 5
}
```

**Response (201):**
```json
{
  "id": 10,
  "username": "newuser",
  "email": "newuser@example.com",
  "role": "editor",
  "staffId": 5,
  "temporaryPassword": "TempPass123!",
  "createdAt": "2025-10-14T12:00:00Z"
}
```

---

#### PATCH /users/:id
Update user information.

**Authentication:** Required (Bearer token)

**Authorization:** Admin only

**Path Parameters:**
- `id` (required): User ID

**Request Body:** (all fields optional)
```json
{
  "username": "updateduser",
  "email": "updated@example.com",
  "role": "admin",
  "staffId": 10
}
```

**Response (200):**
```json
{
  "id": 10,
  "username": "updateduser",
  "email": "updated@example.com",
  "role": "admin",
  "staffId": 10,
  "updatedAt": "2025-10-14T13:00:00Z"
}
```

---

#### POST /users/:id/reset-password
Reset a user's password.

**Authentication:** Required (Bearer token)

**Authorization:** Admin only

**Path Parameters:**
- `id` (required): User ID

**Response (200):**
```json
{
  "message": "Password reset successfully",
  "temporaryPassword": "NewTempPass456!"
}
```

---

#### DELETE /users/:id
Delete a user.

**Authentication:** Required (Bearer token)

**Authorization:** Admin only

**Path Parameters:**
- `id` (required): User ID

**Response (200):**
```json
{
  "message": "User deleted successfully"
}
```

---

### Billing Endpoints

**Note:** Billing module must be enabled in settings. Access is controlled by billing access settings.

#### GET /billing/projects
Get paginated billing matters and collections.

**Authentication:** Required (Bearer token)

**Authorization:** Billing access required (Admin or B&C Attorney based on settings)

**Query Parameters (optional):**
- `page` – Page number (default: 1)
- `limit` – Results per page (default: 100, max: 250)
- `search` – Case-insensitive search across project name, client name, and CM numbers
- `bcAttorney` – Filter by B&C attorney name (matches mapped or attorney_in_charge)

**Response (200):**
```json
{
  "data": [
    {
      "project_id": 1010101001,
      "project_name": "Matter 12345 - Client A Acquisition",
      "client_name": "Client A",
      "attorney_in_charge": "Jane Partner",
      "cm_numbers": "12345, 67890",
      "billing_usd": 500000.0,
      "collection_usd": 450000.0,
      "billing_credit_usd": 0.0,
      "ubt_usd": 50000.0,
      "total_milestones": 12,
      "completed_milestones": 8,
      "staffing_project_id": 42,
      "staffing_project_name": "Client A Staffing Project",
      "financials_last_updated_at": "2025-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 100,
    "total": 325,
    "totalPages": 4
  }
}
```

---

#### GET /billing/projects/:id
Get detailed information about a billing matter.

**Authentication:** Required (Bearer token)

**Authorization:** Billing access required

**Path Parameters:**
- `id` (required): Billing project ID

**Response (200):**
```json
{
  "id": 1,
  "name": "Matter 12345 - Client A Acquisition",
  "clientName": "Client A",
  "matterNumber": "12345",
  "totalBilled": 500000.00,
  "totalCollected": 450000.00,
  "outstandingAR": 50000.00,
  "status": "active",
  "engagements": [
    {
      "id": 1,
      "engagementNumber": "ENG-001",
      "description": "M&A Advisory",
      "feeType": "Fixed Fee",
      "totalFee": 500000.00
    }
  ],
  "linkedProjects": [
    {
      "projectId": 1,
      "projectName": "Project Alpha"
    }
  ]
}
```

---

#### GET /billing/projects/:id/engagement/:engagementId
Get detailed information about a specific engagement.

**Authentication:** Required (Bearer token)

**Authorization:** Billing access required

**Path Parameters:**
- `id` (required): Billing project ID
- `engagementId` (required): Engagement ID

**Response (200):**
```json
{
  "id": 1,
  "billingProjectId": 1,
  "engagementNumber": "ENG-001",
  "description": "M&A Advisory",
  "feeType": "Fixed Fee",
  "totalFee": 500000.00,
  "feeArrangement": {
    "notes": "3-milestone payment structure"
  },
  "milestones": [
    {
      "id": 1,
      "description": "Milestone 1 - Due Diligence",
      "amount": 150000.00,
      "dueDate": "2025-09-30",
      "status": "completed"
    },
    {
      "id": 2,
      "description": "Milestone 2 - Transaction Closing",
      "amount": 200000.00,
      "dueDate": "2025-11-30",
      "status": "pending"
    }
  ]
}
```

---

#### GET /billing/projects/:id/cm/:cmId/engagements
Get all engagements for a specific client matter.

**Authentication:** Required (Bearer token)

**Authorization:** Billing access required

**Path Parameters:**
- `id` (required): Billing project ID
- `cmId` (required): Client matter ID

**Response (200):**
```json
[
  {
    "id": 1,
    "engagementNumber": "ENG-001",
    "description": "M&A Advisory",
    "feeType": "Fixed Fee",
    "totalFee": 500000.00
  }
]
```

---

#### GET /billing/projects/:id/activity
Get change history for a billing project.

**Authentication:** Required (Bearer token)

**Authorization:** Billing access required

**Path Parameters:**
- `id` (required): Billing project ID

**Response (200):**
```json
[
  {
    "id": 100,
    "billingProjectId": 1,
    "changedBy": "admin",
    "changeType": "update",
    "changes": {
      "totalCollected": {
        "from": 400000.00,
        "to": 450000.00
      }
    },
    "changedAt": "2025-10-14T10:00:00Z"
  }
]
```

---

#### PATCH /billing/projects/:id/financials
Update billing project financials.

**Authentication:** Required (Bearer token)

**Authorization:** Admin only

**Path Parameters:**
- `id` (required): Billing project ID

**Request Body:**
```json
{
  "totalBilled": 550000.00,
  "totalCollected": 500000.00,
  "outstandingAR": 50000.00
}
```

**Response (200):**
```json
{
  "id": 1,
  "totalBilled": 550000.00,
  "totalCollected": 500000.00,
  "outstandingAR": 50000.00,
  "updatedAt": "2025-10-14T13:00:00Z"
}
```

---

#### PATCH /billing/engagements/:engagementId/fee-arrangement
Update engagement fee arrangement.

**Authentication:** Required (Bearer token)

**Authorization:** Admin only

**Path Parameters:**
- `engagementId` (required): Engagement ID

**Request Body:**
```json
{
  "feeType": "Contingent",
  "totalFee": 600000.00,
  "notes": "Success fee structure"
}
```

**Response (200):**
```json
{
  "id": 1,
  "feeType": "Contingent",
  "totalFee": 600000.00,
  "notes": "Success fee structure",
  "updatedAt": "2025-10-14T13:00:00Z"
}
```

---

#### POST /billing/engagements/:engagementId/milestones
Create a fee milestone.

**Authentication:** Required (Bearer token)

**Authorization:** Admin only

**Path Parameters:**
- `engagementId` (required): Engagement ID

**Request Body:**
```json
{
  "description": "Milestone 3 - Post-Closing",
  "amount": 150000.00,
  "dueDate": "2026-01-31",
  "status": "pending"
}
```

**Response (201):**
```json
{
  "id": 3,
  "engagementId": 1,
  "description": "Milestone 3 - Post-Closing",
  "amount": 150000.00,
  "dueDate": "2026-01-31",
  "status": "pending",
  "createdAt": "2025-10-14T12:00:00Z"
}
```

---

#### PATCH /billing/milestones
Bulk update fee milestones.

**Authentication:** Required (Bearer token)

**Authorization:** Admin only

**Request Body:**
```json
{
  "milestones": [
    {
      "id": 1,
      "status": "completed"
    },
    {
      "id": 2,
      "dueDate": "2025-12-15"
    }
  ]
}
```

**Response (200):**
```json
{
  "updated": 2,
  "milestones": [
    {
      "id": 1,
      "status": "completed"
    },
    {
      "id": 2,
      "dueDate": "2025-12-15"
    }
  ]
}
```

---

#### DELETE /billing/milestones/:milestoneId
Delete a fee milestone.

**Authentication:** Required (Bearer token)

**Authorization:** Admin only

**Path Parameters:**
- `milestoneId` (required): Milestone ID

**Response (200):**
```json
{
  "message": "Milestone deleted successfully"
}
```

---

#### GET /billing/mapping/suggestions
Get suggested mappings between billing matters and staffing projects.

**Authentication:** Required (Bearer token)

**Authorization:** Admin only

**Description:** Uses fuzzy matching to suggest potential links between billing and staffing projects.

**Response (200):**
```json
[
  {
    "billingProjectId": 1,
    "billingProjectName": "Matter 12345 - Client A Acquisition",
    "staffingProjectId": 1,
    "staffingProjectName": "Project Alpha - Client A",
    "matchScore": 0.95
  }
]
```

---

#### POST /billing/mapping/link
Link a billing matter to a staffing project.

**Authentication:** Required (Bearer token)

**Authorization:** Admin only

**Request Body:**
```json
{
  "billingProjectId": 1,
  "staffingProjectId": 1
}
```

**Response (201):**
```json
{
  "id": 10,
  "billingProjectId": 1,
  "staffingProjectId": 1,
  "createdAt": "2025-10-14T12:00:00Z"
}
```

---

#### DELETE /billing/mapping/unlink/:linkId
Unlink billing matter from staffing project.

**Authentication:** Required (Bearer token)

**Authorization:** Admin only

**Path Parameters:**
- `linkId` (required): Link ID

**Response (200):**
```json
{
  "message": "Projects unlinked successfully"
}
```

---

#### GET /billing/bc-attorneys/unmapped
Get B&C attorneys from billing data not yet mapped to staff records.

**Authentication:** Required (Bearer token)

**Authorization:** Admin only

**Response (200):**
```json
[
  {
    "id": 5,
    "name": "John Smith",
    "billingCode": "JS001"
  }
]
```

---

#### POST /billing/bc-attorneys/map
Map a B&C attorney from billing system to staff record.

**Authentication:** Required (Bearer token)

**Authorization:** Admin only

**Request Body:**
```json
{
  "bcAttorneyId": 5,
  "staffId": 10
}
```

**Response (201):**
```json
{
  "bcAttorneyId": 5,
  "staffId": 10,
  "mappedAt": "2025-10-14T12:00:00Z"
}
```

---

#### GET /billing/settings/access
Get billing module access settings.

**Authentication:** Required (Bearer token)

**Authorization:** Admin only

**Response (200):**
```json
{
  "billing_module_enabled": true,
  "access_level": "admin_and_bc_attorney"
}
```

**Access Levels:**
- `admin_only`: Only administrators can access billing module
- `admin_and_bc_attorney`: Administrators and B&C Working Attorneys can access

---

#### PATCH /billing/settings/access
Update billing module access settings.

**Authentication:** Required (Bearer token)

**Authorization:** Admin only

**Request Body:**
```json
{
  "billing_module_enabled": true,
  "access_level": "admin_and_bc_attorney"
}
```

**Response (200):**
```json
{
  "billing_module_enabled": true,
  "access_level": "admin_and_bc_attorney",
  "updatedAt": "2025-10-14T13:00:00Z"
}
```

---

### Settings Endpoints

#### GET /email-settings
Get email notification settings.

**Authentication:** Required (Bearer token)

**Response (200):**
```json
{
  "id": 1,
  "enabled": true,
  "reminderFrequency": "weekly",
  "recipients": [
    "admin@example.com",
    "manager@example.com"
  ],
  "updatedAt": "2025-10-01T10:00:00Z"
}
```

---

#### PATCH /email-settings
Update email notification settings.

**Authentication:** Required (Bearer token)

**Authorization:** Admin only

**Request Body:**
```json
{
  "enabled": true,
  "reminderFrequency": "daily",
  "recipients": [
    "admin@example.com",
    "manager@example.com",
    "supervisor@example.com"
  ]
}
```

**Response (200):**
```json
{
  "id": 1,
  "enabled": true,
  "reminderFrequency": "daily",
  "recipients": [
    "admin@example.com",
    "manager@example.com",
    "supervisor@example.com"
  ],
  "updatedAt": "2025-10-14T13:00:00Z"
}
```

---

## Interactive Documentation

For interactive API documentation with the ability to test endpoints directly in your browser, visit:

### Development
```
http://localhost:3000/api-docs
```

### Production
```
https://staffing-tracker-production.up.railway.app/api-docs
```

The interactive Swagger UI provides:
- Complete API reference with all endpoints
- Request/response schemas
- Try-it-out functionality to test endpoints
- Authentication configuration interface
- Example requests and responses
- Schema definitions for all data models

---

## Code Examples

### JavaScript/TypeScript (Fetch API)

```javascript
// Login
const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    username: 'admin',
    password: 'password123'
  }),
  credentials: 'include' // Important for refresh token cookie
});

const { user, accessToken } = await loginResponse.json();

// Use access token for authenticated requests
const projectsResponse = await fetch('http://localhost:3000/api/projects', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

const projects = await projectsResponse.json();

// Refresh token when access token expires
const refreshResponse = await fetch('http://localhost:3000/api/auth/refresh', {
  method: 'POST',
  credentials: 'include' // Sends refresh token cookie
});

const { accessToken: newAccessToken } = await refreshResponse.json();
```

### JavaScript/TypeScript (Axios)

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  withCredentials: true // Include cookies
});

// Add token to requests
let accessToken = '';

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;

      try {
        const { data } = await api.post('/auth/refresh');
        accessToken = data.accessToken;
        error.config.headers.Authorization = `Bearer ${accessToken}`;
        return api(error.config);
      } catch (refreshError) {
        // Redirect to login
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

// Login
const { data } = await api.post('/auth/login', {
  username: 'admin',
  password: 'password123'
});
accessToken = data.accessToken;

// Get projects
const projects = await api.get('/projects');
```

### cURL

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}' \
  -c cookies.txt

# Get projects with token
curl -X GET http://localhost:3000/api/projects \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Refresh token
curl -X POST http://localhost:3000/api/auth/refresh \
  -b cookies.txt \
  -c cookies.txt

# Download Excel report
curl -X GET http://localhost:3000/api/reports/staffing.xlsx \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  --output staffing-report.xlsx
```

### Python (Requests)

```python
import requests

BASE_URL = 'http://localhost:3000/api'

# Login
response = requests.post(f'{BASE_URL}/auth/login', json={
    'username': 'admin',
    'password': 'password123'
})
data = response.json()
access_token = data['accessToken']

# Get projects
headers = {'Authorization': f'Bearer {access_token}'}
projects_response = requests.get(f'{BASE_URL}/projects', headers=headers)
projects = projects_response.json()

# Refresh token
refresh_response = requests.post(
    f'{BASE_URL}/auth/refresh',
    cookies=response.cookies
)
new_token = refresh_response.json()['accessToken']

# Download Excel report
report_response = requests.get(
    f'{BASE_URL}/reports/staffing.xlsx',
    headers=headers
)
with open('staffing-report.xlsx', 'wb') as f:
    f.write(report_response.content)
```

---

## Best Practices

### Security

1. **Store tokens securely**
   - Never store access tokens in localStorage
   - Use memory storage or secure token management libraries
   - Refresh tokens are automatically stored in HTTP-only cookies

2. **Handle token refresh**
   - Implement automatic token refresh on 401 errors
   - Use interceptors to retry failed requests after refresh

3. **Logout on session end**
   - Always call `/auth/logout` when user logs out
   - Use `/auth/logout-all` if user wants to invalidate all sessions

### Error Handling

1. **Check response status codes**
   - Always check for 401 (refresh token)
   - Handle 403 errors (insufficient permissions)
   - Display user-friendly error messages

2. **Validate input before sending**
   - Check required fields
   - Validate email formats and data types
   - Handle validation errors from API

### Performance

1. **Use pagination when available**
   - Request only the data you need
   - Implement infinite scroll or pagination UI

2. **Cache frequently accessed data**
   - Cache project categories
   - Cache staff lists
   - Invalidate cache on updates

3. **Batch operations**
   - Use bulk endpoints (e.g., `/assignments/bulk`)
   - Reduce number of API calls

---

## Support

For API support, please contact:
- **Email:** support@example.com
- **Swagger UI:** http://localhost:3000/api-docs

---

## Changelog

### Version 1.0.0 (2025-10-14)
- Initial API release
- Authentication with JWT and refresh tokens
- Full CRUD operations for projects, staff, and assignments
- Dashboard and reporting endpoints
- Billing module integration
- Change history tracking
- Excel export functionality
