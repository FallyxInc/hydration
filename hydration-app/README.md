# Hydration Dashboard - Modern Web Application

A modern web application for managing resident hydration goals and consumption data, built with Next.js, TypeScript, React, and Firebase.

## Features

- 🔐 **Firebase Authentication** - Secure user login and registration
- 👥 **User Management** - Create and manage users with different roles
- 📁 **File Upload** - Upload care plan and hydration data PDFs
- 🔄 **Automated Processing** - Python scripts process uploaded files automatically
- 📊 **Dashboard** - View hydration data with statistics and resident details
- 🎨 **Modern UI** - Built with Tailwind CSS and responsive design

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: Firebase Auth
- **Database**: Firebase Firestore
- **File Processing**: Python scripts (PyPDF2)
- **Deployment**: Vercel (recommended)

## Setup Instructions

### 1. Prerequisites

- Node.js 18+ 
- Python 3.6+
- Firebase project

### 2. Install Dependencies

```bash
cd hydration-app
npm install
```

### 3. Python Dependencies

```bash
pip install PyPDF2
```

### 4. Firebase Setup

1. Create a Firebase project at [https://console.firebase.google.com](https://console.firebase.google.com)
2. Enable Authentication (Email/Password)
3. Enable Firestore Database
4. Get your Firebase config from Project Settings

### 5. Environment Configuration

Create a `.env.local` file in the `hydration-app` directory:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 6. Run the Application

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## Usage

### 1. Authentication
- First user can sign up to create an account
- Subsequent users can be created by admins through the User Management tab

### 2. File Upload
- Navigate to the "File Upload" tab
- Upload a care plan PDF (contains resident names and hydration goals)
- Upload a hydration data PDF (contains daily consumption data)
- Select a user to associate the data with
- Click "Process Files" to run the Python scripts

### 3. View Data
- Navigate to the "Hydration Data" tab to view processed data
- See statistics including goal met percentage and missed days
- View detailed resident information in a table format

### 4. User Management
- Admins can create new users through the "User Management" tab
- Set user roles (user/admin)
- Delete users as needed

## File Processing Flow

1. **Care Plan Processing** (`careplan.py`)
   - Extracts resident names and hydration goals from PDFs
   - Creates base CSV with resident information

2. **Hydration Data Processing** (`process_dat_pdf.py`)
   - Processes daily consumption data from PDFs
   - Updates CSV with consumption data
   - Calculates "Missed 3 Days" status

3. **Dashboard Data Generation** (`generate_dashboard_data.py`)
   - Converts CSV to JavaScript format
   - Generates statistics and summary data

## Project Structure

```
hydration-app/
├── src/
│   ├── app/                 # Next.js app directory
│   │   ├── api/            # API routes
│   │   ├── globals.css     # Global styles
│   │   ├── layout.tsx      # Root layout
│   │   └── page.tsx        # Home page
│   ├── components/         # React components
│   │   ├── Dashboard.tsx   # Main dashboard
│   │   ├── FileUpload.tsx  # File upload interface
│   │   ├── HydrationData.tsx # Data display
│   │   ├── LoginForm.tsx   # Authentication
│   │   └── UserManagement.tsx # User management
│   ├── contexts/           # React contexts
│   │   └── AuthContext.tsx # Authentication context
│   └── lib/                # Utilities
│       └── firebase.ts     # Firebase configuration
├── data/                   # User-specific data storage
├── scripts/                # Python processing scripts
└── public/                 # Static assets
```

## API Endpoints

- `POST /api/process-files` - Process uploaded PDF files
- `GET /api/hydration-data` - Retrieve hydration data
- `POST /api/create-user` - Create new user account

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically

### Other Platforms

The app can be deployed to any platform that supports Next.js:
- Netlify
- AWS Amplify
- Railway
- DigitalOcean App Platform

## Security Considerations

- Firebase Authentication provides secure user management
- File uploads are validated for PDF format
- User-specific data isolation
- Environment variables for sensitive configuration

## Troubleshooting

### Common Issues

1. **Firebase Authentication not working**
   - Check environment variables
   - Ensure Firebase project has Authentication enabled
   - Verify domain is added to authorized domains

2. **File processing fails**
   - Ensure Python and PyPDF2 are installed
   - Check file permissions
   - Verify PDF files are not corrupted

3. **Build errors**
   - Clear `.next` directory and rebuild
   - Check TypeScript errors
   - Verify all dependencies are installed

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the ISC License.
