#!/bin/bash

echo "🚀 AI Agent Benchmarking"
echo "========================"

test_agent() {
    local agent="$1" 
    local query="$2"
    
    echo "Testing $agent: $query"
    start=$(date +%s)
    
    if timeout 15s npm run "${agent}:ai" "$query" > /dev/null 2>&1; then
        end=$(date +%s)
        duration=$((end - start))
        echo "✅ Success: ${duration}s"
        return 0
    else
        echo "❌ Failed or timeout"
        return 1
    fi
}

# Test core agents
echo "Testing Stripe agent..."
test_agent "stripe" "account status"

echo "Testing Sanity agent..."  
test_agent "sanity" "content health check"

echo "Testing Database agent..."
test_agent "database" "performance status"

echo ""
echo "Benchmarking complete!"
