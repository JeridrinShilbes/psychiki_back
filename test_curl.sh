#!/bin/bash
EVENTS=$(curl -s http://localhost:3000/api/events)
FIRST_ID=$(echo $EVENTS | node -e "const data=JSON.parse(require('fs').readFileSync(0, 'utf-8')); console.log(data[0]._id || data[0].id)")

echo "Testing with ID: $FIRST_ID"
curl -X POST -H "Content-Type: application/json" -d '{"userName":"curl_user"}' http://localhost:3000/api/events/$FIRST_ID/join
echo ""
curl -X POST -H "Content-Type: application/json" -d '{"userName":"curl_user"}' http://localhost:3000/api/events/$FIRST_ID/join
echo ""
