#!/bin/bash

echo "🚀 Setting up Hydration Dashboard Application..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.6+ first."
    exit 1
fi

echo "✅ Node.js and Python are installed"

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Install Python dependencies
echo "🐍 Installing Python dependencies..."
pip3 install PyPDF2

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p data
mkdir -p scripts

# Copy Python scripts to the app directory
echo "📋 Copying Python processing scripts..."
cp ../careplan.py scripts/
cp ../process_dat_pdf.py scripts/
cp ../generate_dashboard_data.py scripts/

# Create .env.local file if it doesn't exist
if [ ! -f .env.local ]; then
    echo "⚙️ Creating environment configuration..."
    cp env.example .env.local
    echo "📝 Please edit .env.local with your Firebase configuration"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Set up a Firebase project at https://console.firebase.google.com"
echo "2. Enable Authentication (Email/Password) and Firestore Database"
echo "3. Get your Firebase config and update .env.local"
echo "4. Run 'npm run dev' to start the development server"
echo ""
echo "For detailed instructions, see README.md"
