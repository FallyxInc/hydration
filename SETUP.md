# Hydration Dashboard - Complete Setup Guide

This guide will walk you through setting up the complete Hydration Dashboard system, including both the modern web application and the traditional Python pipeline.

## 🎯 Choose Your Setup

### Option 1: Modern Web Application (Recommended)
- Multi-user system with Firebase authentication
- Role-based access control
- File upload interface
- Real-time dashboard

### Option 2: Traditional Python Pipeline
- Command-line processing
- Static HTML dashboard
- Single-user system

---

## 🚀 Option 1: Modern Web Application Setup

### Prerequisites
- Node.js 18+ ([Download](https://nodejs.org/))
- Python 3.6+ ([Download](https://python.org/))
- Git ([Download](https://git-scm.com/))

### Step 1: Clone Repository
```bash
git clone https://github.com/FallyxInc/hydration.git
cd hydration
```

### Step 2: Install Dependencies

#### Node.js Dependencies
```bash
cd hydration-app
npm install
```

#### Python Dependencies
```bash
# Install globally or in virtual environment
pip install PyPDF2 pdfminer.six

# Or create virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install PyPDF2 pdfminer.six
```

### Step 3: Firebase Setup

#### 3.1 Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create a project"
3. Enter project name: "hydration-dashboard"
4. Enable Google Analytics (optional)
5. Click "Create project"

#### 3.2 Enable Authentication
1. In Firebase Console, go to "Authentication"
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Enable "Email/Password" provider
5. Click "Save"

#### 3.3 Enable Firestore Database
1. Go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in production mode"
4. Select a location for your database
5. Click "Done"

#### 3.4 Get Configuration
1. Go to "Project Settings" (gear icon)
2. Scroll down to "Your apps"
3. Click "Add app" and select web icon (</>)
4. Register app with nickname: "hydration-web"
5. Copy the configuration object

### Step 4: Environment Configuration

Create `hydration-app/.env.local` file:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### Step 5: Run the Application
```bash
cd hydration-app
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### Step 6: Create First User
1. Click "Sign In" on the login page
2. Create your first admin account
3. Use this account to create other users

---

## 🐍 Option 2: Traditional Python Pipeline Setup

### Prerequisites
- Python 3.6+
- Git

### Step 1: Clone Repository
```bash
git clone https://github.com/FallyxInc/hydration.git
cd hydration
```

### Step 2: Install Python Dependencies
```bash
pip install PyPDF2 pdfminer.six
```

### Step 3: Prepare Data Files

#### 3.1 Care Plan PDFs
Place care plan PDFs in the `care-plans/` directory:
```bash
# Example structure
care-plans/
├── 1.pdf
├── 2.pdf
├── 3.pdf
└── 3.pdf
```

#### 3.2 Hydration Data PDFs
Place hydration data PDFs in the `hydration-data/` directory:
```bash
# Example structure
hydration-data/
├── CG.pdf
├── HH.pdf
├── MG.pdf
├── BT.pdf
└── CB.pdf
```

### Step 4: Process Data

#### 4.1 Extract Resident Information
```bash
python3 careplan.py
```
This creates `hydration_goals.csv` with resident names and hydration goals.

#### 4.2 Process Hydration Data
```bash
python3 process_dat_pdf.py
```
This updates the CSV with daily consumption data.

#### 4.3 Generate Dashboard
```bash
python3 generate_dashboard_data.py
```
This creates `dashboard_data.js` for the dashboard.

### Step 5: View Dashboard
```bash
# Open the HTML dashboard
open hydration.html
# Or
python -m http.server 8000
# Then visit http://localhost:8000/hydration.html
```

---

## 🔧 Advanced Configuration

### Python Virtual Environment (Recommended)
```bash
# Create virtual environment
python -m venv hydration-env

# Activate virtual environment
# On macOS/Linux:
source hydration-env/bin/activate
# On Windows:
hydration-env\Scripts\activate

# Install dependencies
pip install PyPDF2 pdfminer.six

# Deactivate when done
deactivate
```

### Firebase Security Rules
Add these rules to your Firestore database:

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

### Environment Variables for Production
For production deployment, set these environment variables:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_production_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_production_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_production_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_production_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_production_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_production_app_id
```

---

## 🚀 Deployment Options

### Vercel (Recommended for Web App)
1. Push code to GitHub
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Click "New Project"
4. Import your GitHub repository
5. Add environment variables in Vercel dashboard
6. Deploy automatically

### Netlify (Alternative)
1. Build the project: `npm run build`
2. Deploy the `out` directory to Netlify
3. Add environment variables in Netlify dashboard

### Traditional Hosting
1. Build the project: `npm run build`
2. Upload files to your web server
3. Configure environment variables on your server

---

## 🐛 Troubleshooting

### Common Issues

**1. Firebase Authentication Not Working**
```bash
# Check environment variables
cat hydration-app/.env.local

# Verify Firebase project has Authentication enabled
# Check Firebase Console → Authentication → Sign-in method
```

**2. Python Dependencies Missing**
```bash
# Check if packages are installed
pip list | grep -E "(PyPDF2|pdfminer)"

# Reinstall if missing
pip install PyPDF2 pdfminer.six
```

**3. File Processing Errors**
```bash
# Check file permissions
ls -la hydration-app/data/

# Verify Python scripts are executable
chmod +x careplan.py process_dat_pdf.py generate_dashboard_data.py
```

**4. Build Errors**
```bash
# Clear Next.js cache
rm -rf hydration-app/.next

# Reinstall dependencies
cd hydration-app && npm install
```

**5. PDF Processing Issues**
- Ensure PDFs are not password-protected
- Check that PDFs contain readable text (not just images)
- Verify file paths are correct

### Debug Mode
Enable debug logging by setting environment variables:

```bash
# For Python scripts
export DEBUG=true
python3 careplan.py

# For Next.js app
cd hydration-app
DEBUG=* npm run dev
```

---

## 📊 Testing Your Setup

### Web Application Testing
1. **Authentication**: Create a user account and log in
2. **File Upload**: Upload a sample PDF and verify processing
3. **Dashboard**: Check that data appears in the dashboard
4. **User Management**: Create additional users with different roles

### Python Pipeline Testing
1. **Care Plan Processing**: Run `python3 careplan.py` and check `hydration_goals.csv`
2. **Hydration Data**: Run `python3 process_dat_pdf.py` and verify CSV updates
3. **Dashboard Generation**: Run `python3 generate_dashboard_data.py` and check `dashboard_data.js`
4. **HTML Dashboard**: Open `hydration.html` and verify data display

---

## 🔒 Security Considerations

### Firebase Security
- Enable Authentication with strong password requirements
- Set up Firestore security rules
- Use Firebase App Check for additional security

### File Security
- Validate uploaded files are PDFs
- Sanitize file paths to prevent directory traversal
- Store files in user-specific directories

### Data Privacy
- Implement data retention policies
- Use encryption for sensitive data
- Regular security audits

---

## 📈 Performance Optimization

### Web Application
- Use Next.js Image optimization
- Implement caching strategies
- Optimize bundle size

### Python Processing
- Use multiprocessing for large files
- Implement file caching
- Optimize regex patterns

---

## 🆘 Getting Help

### Documentation
- [Next.js Documentation](https://nextjs.org/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Python PDF Processing](https://pypdf2.readthedocs.io/)

### Community Support
- GitHub Issues: [Report bugs and request features](https://github.com/FallyxInc/hydration/issues)
- Stack Overflow: Tag questions with `hydration-dashboard`

### Professional Support
For enterprise deployments or custom development, contact the development team.

---

**Last Updated**: October 2024  
**Version**: 2.0 (Complete Setup Guide)
