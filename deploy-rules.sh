#!/bin/bash

# Script to deploy Firestore rules
# Run this from the project directory

echo "🔥 Deploying Firestore Rules..."
echo ""

# Check if firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Installing..."
    npm install -g firebase-tools
fi

# Login to Firebase (if not already logged in)
echo "🔐 Checking Firebase login..."
firebase login --no-localhost

# Deploy only the Firestore rules
echo ""
echo "📤 Deploying rules..."
firebase deploy --only firestore:rules

echo ""
echo "✅ Done! Rules should now be deployed."
echo "🔄 Refresh your browser to see the changes."
