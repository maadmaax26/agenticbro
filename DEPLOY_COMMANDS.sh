#!/bin/bash

# Deployment Script for Value Prop Page

cd /Users/efinney/.openclaw/workspace/aibro

# 1. Test build locally
echo "Building locally..."
npm run build

if [ $? -ne 0 ]; then
    echo "Build failed! Check errors above."
    exit 1
fi

echo "Build successful!"

# 2. Commit to git
echo "Committing changes..."
git add .
git commit -m "feat: add Value Proposition page with navigation

- Add ValueProposition component with full feature breakdown
- Add 'Why Agentic Bro?' button in header
- Implement page navigation with conditional rendering
- Add competitive advantages table
- Add roadmap section
- Add token economics section"

git push

if [ $? -ne 0 ]; then
    echo "Git push failed! Check authentication."
    exit 1
fi

echo "Git push successful!"

# 3. Deploy to Vercel
echo "Deploying to Vercel..."
vercel --prod

if [ $? -ne 0 ]; then
    echo "Vercel deployment failed! Check errors above."
    exit 1
fi

echo "Deployment successful! Visit https://agenticbro.app"