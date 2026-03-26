#!/bin/bash
set -e

echo "🎯 Stiglitz - Verification Workflow"
echo "==================================="
echo ""

echo "1️⃣  Building locally..."
npm run build || { echo "❌ Build failed"; exit 1; }
echo "✅ Build successful"
echo ""

echo "2️⃣  Running E2E tests locally..."
# Note: Este script asume que tienes un server local corriendo
# Si quieres testear producción, usa PLAYWRIGHT_BASE_URL
npm run test:e2e || { echo "❌ Tests failed"; exit 1; }
echo "✅ Tests passed"
echo ""

echo "3️⃣  Deploying to Vercel..."
vercel --prod --yes || { echo "❌ Deploy failed"; exit 1; }
echo "✅ Deployed"
echo ""

echo "4️⃣  Testing production..."
PLAYWRIGHT_BASE_URL=https://action-colleague.vercel.app npm run test:e2e || { echo "❌ Production tests failed"; exit 1; }
echo "✅ Production tests passed"
echo ""

echo "✅✅✅ ALL CHECKS PASSED! ✅✅✅"
echo ""
echo "Fix is DONE and verified in production 🎯"
