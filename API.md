# Hydration Dashboard - API Documentation

This document provides comprehensive API documentation for the Hydration Dashboard web application.

## 🔗 Base URL

- **Development**: `http://localhost:3000`
- **Production**: `https://your-domain.com`

## 🔐 Authentication

All API endpoints require authentication via Firebase Auth. Include the Firebase ID token in the Authorization header:

```http
Authorization: Bearer <firebase_id_token>
```

## 📋 API Endpoints

### 1. Process Files

**Endpoint**: `POST /api/process-files`

**Description**: Processes uploaded PDF files and runs Python scripts to extract resident data.

**Request Body** (multipart/form-data):
```typescript
{
  carePlanFiles: File[];           // Care plan PDF files
  hydrationDataFiles: File[];     // Hydration data PDF files
  retirementHome: string;          // Retirement home name
}
```

**Response**:
```typescript
{
  success: boolean;
  message: string;
  residentsCount?: number;
  error?: string;
}
```

**Example Request**:
```bash
curl -X POST http://localhost:3000/api/process-files \
  -H "Authorization: Bearer <firebase_token>" \
  -F "carePlanFiles=@care_plan.pdf" \
  -F "hydrationDataFiles=@hydration_data.pdf" \
  -F "retirementHome=Sunset Manor"
```

**Example Response**:
```json
{
  "success": true,
  "message": "Files processed successfully",
  "residentsCount": 25
}
```

**Error Responses**:
```json
{
  "success": false,
  "error": "Invalid file format. Only PDF files are allowed."
}
```

---

### 2. Get Hydration Data

**Endpoint**: `POST /api/hydration-data`

**Description**: Retrieves hydration data for a specific user based on their role and retirement home.

**Request Body**:
```typescript
{
  userRole: "admin" | "home_manager";
  retirementHome?: string;         // Required for home_manager
}
```

**Response**:
```typescript
{
  residents: Resident[];
}

interface Resident {
  name: string;                   // "Smith, John"
  goal: number;                   // 1500 (mL)
  yesterday: number;              // 1350 (mL)
  day14: number;                  // 1200 (mL)
  day15: number;                  // 1300 (mL)
  day16: number;                  // 1400 (mL)
  missed3Days: "yes" | "no";      // Missed 3 consecutive days
  source: string;                // "1.pdf - Page 5"
}
```

**Example Request**:
```bash
curl -X POST http://localhost:3000/api/hydration-data \
  -H "Authorization: Bearer <firebase_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "userRole": "home_manager",
    "retirementHome": "Sunset Manor"
  }'
```

**Example Response**:
```json
{
  "residents": [
    {
      "name": "Smith, John",
      "goal": 1500,
      "yesterday": 1350,
      "day14": 1200,
      "day15": 1300,
      "day16": 1400,
      "missed3Days": "no",
      "source": "1.pdf - Page 5"
    },
    {
      "name": "Johnson, Mary",
      "goal": 2000,
      "yesterday": 1800,
      "day14": 1900,
      "day15": 1850,
      "day16": 1800,
      "missed3Days": "yes",
      "source": "2.pdf - Page 10"
    }
  ]
}
```

---

### 3. Create User

**Endpoint**: `POST /api/create-user`

**Description**: Creates a new user account with specified role and retirement home.

**Request Body**:
```typescript
{
  email: string;                  // User email
  password: string;               // User password
  role: "admin" | "home_manager";
  retirementHome?: string;        // Required for home_manager
}
```

**Response**:
```typescript
{
  success: boolean;
  message: string;
  userId?: string;
  error?: string;
}
```

**Example Request**:
```bash
curl -X POST http://localhost:3000/api/create-user \
  -H "Authorization: Bearer <firebase_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@sunsetmanor.com",
    "password": "securepassword123",
    "role": "home_manager",
    "retirementHome": "Sunset Manor"
  }'
```

**Example Response**:
```json
{
  "success": true,
  "message": "User created successfully",
  "userId": "firebase_user_id_here"
}
```

---

### 4. Delete Home Data

**Endpoint**: `POST /api/delete-home-data`

**Description**: Deletes all data for a specific retirement home.

**Request Body**:
```typescript
{
  retirementHome: string;        // Retirement home name
}
```

**Response**:
```typescript
{
  success: boolean;
  message: string;
  error?: string;
}
```

**Example Request**:
```bash
curl -X POST http://localhost:3000/api/delete-home-data \
  -H "Authorization: Bearer <firebase_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "retirementHome": "Sunset Manor"
  }'
```

**Example Response**:
```json
{
  "success": true,
  "message": "All data for Sunset Manor has been deleted"
}
```

---

## 🔒 Authentication Flow

### 1. User Login
```typescript
// Frontend authentication
import { signInWithEmailAndPassword } from 'firebase/auth';

const login = async (email: string, password: string) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const idToken = await userCredential.user.getIdToken();
  return idToken;
};
```

### 2. API Request with Token
```typescript
// Include token in API requests
const response = await fetch('/api/hydration-data', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userRole: 'home_manager',
    retirementHome: 'Sunset Manor'
  })
});
```

---

## 📊 Data Models

### Resident Interface
```typescript
interface Resident {
  name: string;                   // Full name in "LASTNAME, FIRSTNAME" format
  goal: number;                   // Daily hydration goal in mL
  yesterday: number;              // Yesterday's consumption in mL
  day14: number;                  // Day 14 consumption in mL
  day15: number;                  // Day 15 consumption in mL
  day16: number;                  // Day 16 consumption in mL
  missed3Days: "yes" | "no";      // Whether missed 3 consecutive days
  source: string;                // Source file and page
}
```

### User Interface
```typescript
interface User {
  uid: string;                    // Firebase user ID
  email: string;                  // User email
  role: "admin" | "home_manager";
  retirementHome?: string;        // For home managers
  createdAt: Date;               // Account creation date
  lastLogin?: Date;              // Last login date
}
```

### Statistics Interface
```typescript
interface Statistics {
  totalResidents: number;         // Total number of residents
  goalMetCount: number;          // Residents meeting daily goals
  missed3DaysCount: number;      // Residents who missed 3 days
  goalMetPercentage: string;     // Percentage as string (e.g., "75.5%")
}
```

---

## 🐍 Python Scripts Integration

### File Processing Pipeline

1. **File Upload** → API receives files
2. **File Storage** → Files saved to `data/{retirementHome}/`
3. **Script Execution** → Python scripts run automatically:
   - `careplan.py` - Extract resident names and goals
   - `process_dat_pdf.py` - Process consumption data
   - `generate_dashboard_data.py` - Generate JavaScript data
4. **Data Storage** → Results saved to CSV and JavaScript files
5. **API Response** → Success/failure returned to frontend

### Script Parameters
```bash
# Care plan processing
python3 scripts/careplan.py

# Hydration data processing
python3 scripts/process_dat_pdf.py

# Dashboard data generation
python3 scripts/generate_dashboard_data.py
```

---

## 🔧 Error Handling

### Common Error Responses

#### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired authentication token"
}
```

#### 400 Bad Request
```json
{
  "error": "Bad Request",
  "message": "Missing required parameters",
  "details": {
    "missing": ["retirementHome"]
  }
}
```

#### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "Insufficient permissions for this operation"
}
```

#### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "File processing failed",
  "details": "Python script execution error"
}
```

---

## 📝 Request/Response Examples

### Complete File Upload Flow

```typescript
// 1. Upload files
const formData = new FormData();
formData.append('carePlanFiles', carePlanFile);
formData.append('hydrationDataFiles', hydrationFile);
formData.append('retirementHome', 'Sunset Manor');

const uploadResponse = await fetch('/api/process-files', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${idToken}`
  },
  body: formData
});

const uploadResult = await uploadResponse.json();
// { success: true, message: "Files processed successfully", residentsCount: 25 }

// 2. Get processed data
const dataResponse = await fetch('/api/hydration-data', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userRole: 'home_manager',
    retirementHome: 'Sunset Manor'
  })
});

const data = await dataResponse.json();
// { residents: [...] }
```

### User Management Flow

```typescript
// 1. Create new user
const createUserResponse = await fetch('/api/create-user', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'manager@sunsetmanor.com',
    password: 'securepassword123',
    role: 'home_manager',
    retirementHome: 'Sunset Manor'
  })
});

const createResult = await createUserResponse.json();
// { success: true, message: "User created successfully", userId: "..." }

// 2. Delete home data
const deleteResponse = await fetch('/api/delete-home-data', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${managerToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    retirementHome: 'Sunset Manor'
  })
});

const deleteResult = await deleteResponse.json();
// { success: true, message: "All data for Sunset Manor has been deleted" }
```

---

## 🔒 Security Considerations

### Authentication
- All endpoints require valid Firebase ID tokens
- Tokens are validated on each request
- Expired tokens are rejected with 401 status

### Authorization
- Role-based access control enforced
- Home managers can only access their home's data
- Admins can access all data

### File Security
- Only PDF files are accepted for upload
- File paths are sanitized to prevent directory traversal
- Files are stored in user-specific directories

### Data Privacy
- User data is isolated by retirement home
- No cross-tenant data access
- Secure file storage with proper permissions

---

## 📈 Performance Considerations

### File Processing
- Large PDF files are processed asynchronously
- Progress updates provided during processing
- Timeout handling for long-running operations

### Data Retrieval
- Cached data for frequently accessed information
- Efficient CSV parsing for large datasets
- Pagination for large resident lists

### Error Recovery
- Graceful handling of processing failures
- Retry mechanisms for transient errors
- Comprehensive error logging

---

## 🧪 Testing

### Unit Tests
```bash
# Run API tests
npm test

# Run specific test suite
npm test -- --grep "API endpoints"
```

### Integration Tests
```bash
# Test file upload flow
npm run test:integration

# Test authentication flow
npm run test:auth
```

### Manual Testing
```bash
# Test file processing
curl -X POST http://localhost:3000/api/process-files \
  -H "Authorization: Bearer <token>" \
  -F "carePlanFiles=@test_care_plan.pdf" \
  -F "retirementHome=Test Home"

# Test data retrieval
curl -X POST http://localhost:3000/api/hydration-data \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"userRole": "admin"}'
```

---

## 📚 Additional Resources

- [Next.js API Routes Documentation](https://nextjs.org/docs/api-routes/introduction)
- [Firebase Authentication Documentation](https://firebase.google.com/docs/auth)
- [Firebase Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Python PDF Processing](https://pypdf2.readthedocs.io/)

---

**Last Updated**: October 2024  
**Version**: 2.0 (API Documentation)
