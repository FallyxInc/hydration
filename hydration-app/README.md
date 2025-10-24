# Hydration Dashboard - Modern Web Application

A modern web application for managing resident hydration goals and consumption data, built with Next.js, TypeScript, React, and Firebase. This application provides a comprehensive solution for retirement homes to track and manage resident hydration data.

## 🚀 Features

- 🔐 **Firebase Authentication** - Secure user login with role-based access
- 👥 **User Management** - Create and manage users with Admin/Home Manager roles
- 📁 **File Upload** - Upload multiple care plan and hydration data PDFs
- 🔄 **Automated Processing** - Python scripts process uploaded files automatically
- 📊 **Real-time Dashboard** - View hydration data with live statistics
- 🎨 **Modern UI** - Built with Tailwind CSS and responsive design
- 🗑️ **Data Management** - Delete all data for specific retirement homes
- 🏠 **Multi-tenant** - Support for multiple retirement homes with data isolation

## 🏗️ Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: Firebase Auth
- **Database**: Firebase Firestore
- **File Processing**: Python scripts (PyPDF2, pdfminer.six)
- **Deployment**: Vercel (recommended)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.6+
- Firebase project

### 1. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install Python dependencies
pip install PyPDF2 pdfminer.six
```

### 2. Firebase Setup

1. **Create Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Create a new project

2. **Enable Authentication**
   - Go to Authentication → Sign-in method
   - Enable Email/Password provider

3. **Enable Firestore Database**
   - Go to Firestore Database
   - Create database in production mode

4. **Get Configuration**
   - Go to Project Settings → General
   - Add a web app and copy the config

### 3. Environment Configuration

Create `.env.local` file:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 4. Run the Application

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## 👥 User Roles & Access

### **Admin Users**
- Can upload files for any retirement home
- Can create and manage other users
- Can view all data across all homes
- **Access**: File Upload, User Management

### **Home Manager Users**
- Can only view data for their specific retirement home
- Can delete all data for their home
- **Access**: Hydration Data, Delete All Data

## 📁 Project Structure

```
hydration-app/
├── src/
│   ├── app/                     # Next.js app directory
│   │   ├── api/                # API routes
│   │   │   ├── process-files/route.ts      # File processing
│   │   │   ├── hydration-data/route.ts     # Data retrieval
│   │   │   ├── create-user/route.ts        # User creation
│   │   │   └── delete-home-data/route.ts   # Data deletion
│   │   ├── page.tsx            # Home page
│   │   └── layout.tsx          # Root layout
│   ├── components/             # React components
│   │   ├── Dashboard.tsx       # Main dashboard
│   │   ├── FileUpload.tsx     # File upload interface
│   │   ├── HydrationData.tsx  # Data display
│   │   ├── LoginForm.tsx      # Authentication
│   │   └── UserManagement.tsx # User management
│   ├── contexts/              # React contexts
│   │   └── AuthContext.tsx    # Authentication context
│   └── lib/                   # Utilities
│       └── firebase.ts        # Firebase configuration
├── data/                      # User-specific data storage
├── scripts/                   # Python processing scripts
├── .env.local                 # Environment variables
└── package.json               # Dependencies
```

## 🔄 Usage Workflow

### 1. **Authentication**
- First user can sign up to create an account
- Subsequent users are created by admins through User Management
- Users are assigned roles (Admin or Home Manager)

### 2. **File Upload (Admin)**
- Navigate to "File Upload" tab
- Upload care plan PDFs (contains resident names and hydration goals)
- Upload hydration data PDFs (contains daily consumption data)
- Select retirement home to associate data with
- Click "Process Files" to run Python scripts automatically

### 3. **View Data (Home Manager)**
- Navigate to "Hydration Data" tab
- View statistics: Total residents, goal met percentage, missed days
- See detailed resident information in table format
- Use "Delete All Data" button to clear home's data

### 4. **User Management (Admin)**
- Navigate to "User Management" tab
- Create new users with specific roles
- Assign retirement homes to home managers
- Delete users as needed

## 🔧 API Endpoints

### `POST /api/process-files`
Processes uploaded PDF files and runs Python scripts.

**Request Body**:
```json
{
  "carePlanFiles": [File],
  "hydrationDataFiles": [File],
  "retirementHome": "string"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Files processed successfully",
  "residentsCount": 25
}
```

### `POST /api/hydration-data`
Retrieves hydration data for a specific user.

**Request Body**:
```json
{
  "userRole": "admin" | "home_manager",
  "retirementHome": "string"
}
```

**Response**:
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
      "missed3Days": "no"
    }
  ]
}
```

### `POST /api/create-user`
Creates a new user account.

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "role": "admin" | "home_manager",
  "retirementHome": "string"
}
```

### `POST /api/delete-home-data`
Deletes all data for a specific retirement home.

**Request Body**:
```json
{
  "retirementHome": "string"
}
```

## 🐍 Python Scripts Integration

The application automatically runs Python scripts when files are uploaded:

### 1. **careplan.py**
- Extracts resident names and hydration goals from care plan PDFs
- Uses strict filtering to avoid medical conditions being parsed as names
- Outputs names in "LASTNAME, FIRSTNAME" format

### 2. **process_dat_pdf.py**
- Processes daily hydration consumption data
- Handles both regular and "Extra" hydration files
- Calculates "Missed 3 Days" status

### 3. **generate_dashboard_data.py**
- Converts CSV data to JavaScript format
- Calculates statistics and summary data

## 🔒 Security & Data Management

### Firebase Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### Data Isolation
- **Home-specific Storage**: Each retirement home's data is stored in separate directories
- **User Permissions**: Home managers can only access their home's data
- **Admin Override**: Admins can access all data for management purposes

### File Security
- **PDF Validation**: Only PDF files are accepted for upload
- **Path Sanitization**: File paths are sanitized to prevent directory traversal
- **User-specific Storage**: Files are stored in user-specific directories

## 🚀 Deployment

### Vercel (Recommended)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Deploy to Vercel"
   git push origin main
   ```

2. **Connect to Vercel**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository

3. **Configure Environment Variables**
   - Go to Project Settings → Environment Variables
   - Add all Firebase configuration variables

4. **Deploy**
   - Vercel will automatically deploy on every push to main

### Other Deployment Options

- **Netlify**: Static site hosting with serverless functions
- **AWS Amplify**: Full-stack deployment with AWS services
- **Railway**: Simple deployment with environment variables
- **DigitalOcean App Platform**: Container-based deployment

## 🐛 Debugging & Troubleshooting

### Debug Logging
The application includes comprehensive debug logging:

1. **Frontend Logs**: Check browser console for React component logs
2. **API Logs**: Check terminal where Next.js is running for API route logs
3. **Python Scripts**: Debug output shows name extraction and filtering process

### Common Issues

**1. Firebase Authentication Errors**
```bash
# Check environment variables
cat .env.local

# Verify Firebase project configuration
# Ensure Authentication is enabled in Firebase Console
```

**2. File Processing Failures**
```bash
# Check Python dependencies
pip list | grep -E "(PyPDF2|pdfminer)"

# Verify file permissions
ls -la data/
```

**3. Build Errors**
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
npm install
```

**4. Name Extraction Issues**
- Check debug output in terminal when processing files
- Verify PDF text extraction is working
- Review filtered names in debug logs

## 📊 Data Format

### Resident Data Structure
```typescript
interface Resident {
  name: string;           // "Smith, John"
  goal: number;          // 1500 (mL)
  yesterday: number;     // 1350 (mL)
  day14: number;         // 1200 (mL)
  day15: number;         // 1300 (mL)
  day16: number;         // 1400 (mL)
  missed3Days: string;   // "yes" | "no"
  source: string;        // "1.pdf - Page 5"
}
```

### Statistics
```typescript
interface Statistics {
  totalResidents: number;      // Total count
  goalMetCount: number;       // Residents meeting goals
  missed3DaysCount: number;    // Residents who missed 3 days
  goalMetPercentage: string;   // "75.5%"
}
```

## 🔧 Configuration

### Environment Variables
```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### Python Configuration
- **PDF Libraries**: PyPDF2 (primary), pdfminer.six (fallback)
- **Name Extraction**: Strict regex pattern with medical condition filtering
- **File Processing**: Automatic detection of regular vs extra files

## 📈 Features & Capabilities

### File Upload System
- **Multiple File Support**: Upload multiple care plan and hydration data PDFs
- **Retirement Home Selection**: Associate files with specific homes
- **Automated Processing**: Python scripts run automatically after upload
- **Progress Tracking**: Real-time feedback during processing

### Dashboard Features
- **Real-time Statistics**: Total residents, goal met percentage, missed days
- **Resident Table**: Detailed view of all residents with consumption data
- **Data Management**: Delete all data for specific retirement home
- **Responsive Design**: Works on desktop and mobile devices

### User Management
- **Role-based Access**: Admin vs Home Manager permissions
- **User Creation**: Admins can create and manage users
- **Data Isolation**: Home managers only see their home's data
- **Secure Authentication**: Firebase-based user management

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes
4. Test thoroughly with different PDF formats
5. Submit a pull request with detailed description

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section above
2. Review debug logs for specific error messages
3. Verify all dependencies are installed correctly
4. Ensure Firebase configuration is complete

---

**Last Updated**: October 2024  
**Version**: 2.0 (Modern Web Application)