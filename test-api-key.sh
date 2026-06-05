#!/bin/bash

# Test your Anthropic API key
# Usage: ./test-api-key.sh YOUR_API_KEY

if [ -z "$1" ]; then
  echo "Usage: ./test-api-key.sh YOUR_API_KEY"
  echo "Get your API key from: https://console.anthropic.com/"
  exit 1
fi

API_KEY="$1"

echo "Testing Anthropic API key..."
echo ""

curl https://api.anthropic.com/v1/messages \
  -H 'anthropic-version: 2023-06-01' \
  -H "x-api-key: $API_KEY" \
  -H 'content-type: application/json' \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "max_tokens": 10,
    "messages": [
      {"role": "user", "content": "Say hello"}
    ]
  }'

echo ""
echo ""
echo "If you see a JSON response, your API key is working!"
echo "If you see an error, check that your API key is correct."
