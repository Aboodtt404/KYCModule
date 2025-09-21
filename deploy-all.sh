#!/bin/bash

echo "🚀 Deploying KYC Module with SMS Verification..."

# Check if DFX is running
if ! dfx ping > /dev/null 2>&1; then
    echo "❌ DFX is not running. Starting DFX..."
    dfx start --background
    sleep 5
fi

# Deploy main KYC canisters first
echo "📦 Deploying main KYC canisters (backend, frontend)..."
dfx deploy backend frontend

if [ $? -eq 0 ]; then
    echo "✅ Main KYC canisters deployed successfully!"
else
    echo "❌ Failed to deploy main KYC canisters"
    exit 1
fi

# Deploy SMS verification canister from its directory
echo "📱 Deploying SMS verification canister..."
cd sms_verification

# Check if SMS verification canister exists, if not create it
if ! dfx canister id sms_verification_backend > /dev/null 2>&1; then
    echo "Creating SMS verification canister..."
    dfx canister create sms_verification_backend
fi

# Deploy the SMS verification canister
dfx deploy sms_verification_backend

if [ $? -eq 0 ]; then
    echo "✅ SMS verification canister deployed successfully!"
else
    echo "❌ Failed to deploy SMS verification canister"
    exit 1
fi

cd ..

echo ""
echo "🎉 All canisters deployed successfully!"
echo ""
echo "📋 Deployment Summary:"
echo "  • Backend canister: $(dfx canister id backend)"
echo "  • Frontend canister: $(dfx canister id frontend)"
echo "  • SMS verification canister: $(dfx canister id sms_verification_backend)"
echo ""
echo "🌐 Access your application at:"
echo "  • Frontend: http://$(dfx canister id frontend).localhost:4943"
echo "  • Backend: http://$(dfx canister id backend).localhost:4943"
echo "  • SMS Backend: http://$(dfx canister id sms_verification_backend).localhost:4943"
