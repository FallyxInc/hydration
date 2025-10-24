#!/bin/bash

# Hydration Dashboard - Automated Setup Script
# This script automates the setup process for the modern web application

set -e  # Exit on any error

echo "🚀 Hydration Dashboard - Automated Setup"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the hydration-app directory"
    exit 1
fi

print_info "Starting setup process..."

# Step 1: Check prerequisites
print_info "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18+ is required. Current version: $(node --version)"
    exit 1
fi
print_status "Node.js $(node --version) is installed"

# Check Python
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is not installed. Please install Python 3.6+ from https://python.org/"
    exit 1
fi
print_status "Python $(python3 --version) is installed"

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm"
    exit 1
fi
print_status "npm $(npm --version) is installed"

# Step 2: Install Node.js dependencies
print_info "Installing Node.js dependencies..."
npm install
print_status "Node.js dependencies installed"

# Step 3: Install Python dependencies
print_info "Installing Python dependencies..."
pip3 install PyPDF2 pdfminer.six
print_status "Python dependencies installed"

# Step 4: Check for environment file
print_info "Checking environment configuration..."

if [ ! -f ".env.local" ]; then
    print_warning ".env.local file not found"
    echo ""
    print_info "Creating .env.local template..."
    cat > .env.local << EOF
# Firebase Configuration
# Get these values from your Firebase project settings
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
EOF
    print_warning "Please update .env.local with your Firebase configuration"
    echo ""
    print_info "To get your Firebase configuration:"
    echo "1. Go to https://console.firebase.google.com"
    echo "2. Create a new project or select existing project"
    echo "3. Go to Project Settings → General"
    echo "4. Scroll down to 'Your apps' and click 'Add app'"
    echo "5. Select web icon (</>) and register your app"
    echo "6. Copy the configuration values to .env.local"
    echo ""
    print_warning "You must configure Firebase before running the application"
else
    print_status ".env.local file found"
fi

# Step 5: Create data directory
print_info "Creating data directory..."
mkdir -p data
print_status "Data directory created"

# Step 6: Copy Python scripts
print_info "Copying Python scripts..."
cp ../careplan.py scripts/ 2>/dev/null || print_warning "careplan.py not found in parent directory"
cp ../process_dat_pdf.py scripts/ 2>/dev/null || print_warning "process_dat_pdf.py not found in parent directory"
cp ../generate_dashboard_data.py scripts/ 2>/dev/null || print_warning "generate_dashboard_data.py not found in parent directory"
print_status "Python scripts copied"

# Step 7: Check Firebase configuration
print_info "Checking Firebase configuration..."

# Check if any Firebase config is set
if grep -q "your_api_key_here" .env.local 2>/dev/null; then
    print_warning "Firebase configuration not set up"
    echo ""
    print_info "Next steps:"
    echo "1. Update .env.local with your Firebase configuration"
    echo "2. Enable Authentication in Firebase Console"
    echo "3. Enable Firestore Database in Firebase Console"
    echo "4. Run 'npm run dev' to start the application"
else
    print_status "Firebase configuration appears to be set"
fi

# Step 8: Final setup instructions
echo ""
print_info "Setup completed! Next steps:"
echo ""
echo "1. 🔥 Configure Firebase:"
echo "   - Update .env.local with your Firebase configuration"
echo "   - Enable Authentication (Email/Password) in Firebase Console"
echo "   - Enable Firestore Database in Firebase Console"
echo ""
echo "2. 🚀 Start the application:"
echo "   npm run dev"
echo ""
echo "3. 🌐 Open your browser:"
echo "   http://localhost:3000"
echo ""
echo "4. 👤 Create your first admin account:"
echo "   - Click 'Sign In' on the login page"
echo "   - Create your admin account"
echo "   - Use this account to create other users"
echo ""

print_status "Setup script completed successfully!"
print_info "For detailed setup instructions, see SETUP.md"