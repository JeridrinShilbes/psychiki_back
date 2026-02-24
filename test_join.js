async function testJoin() {
  const eventsResponse = await fetch('http://localhost:3000/api/events');
  const events = await eventsResponse.json();

  if (events.length === 0) {
    console.log("No events to test with");
    return;
  }

  const eventId = events[0]._id || events[0].id;
  const userName = "testuser_" + Date.now();
  console.log(`Testing with event ${eventId} and user ${userName}`);

  console.log("1. Joining event first time...");
  const res1 = await fetch(`http://localhost:3000/api/events/${eventId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName })
  });
  console.log("First join status:", res1.status);
  const data1 = await res1.json();
  console.log("First join response:", data1);

  console.log("\n2. Joining event SECOND time (should fail)...");
  const res2 = await fetch(`http://localhost:3000/api/events/${eventId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName })
  });
  console.log("Second join status:", res2.status);
  const data2 = await res2.json();
  console.log("Second join response:", data2);

  if (res1.status === 200 && res2.status === 400) {
    console.log("\nTEST PASSED! Successfully prevented duplicate join.");
  } else {
    console.log("\nTEST FAILED!");
  }
}

testJoin().catch(console.error);
