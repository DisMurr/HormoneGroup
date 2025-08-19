#!/bin/bash

# Test the trained AI agents
echo "🧪 Testing Trained AI Agents"
echo "============================"
echo ""

echo "🎓 Testing Trained Stripe Agent..."
echo "Command: node scripts/trained-stripe-agent.mjs 'expert analysis'"
echo ""

# Test the agent
node scripts/trained-stripe-agent.mjs "expert financial analysis" 2>&1

echo ""
echo "Test completed!"
