const axios = require('axios');

async function testGmailRestriction() {
  const baseUrl = 'http://localhost:5000/api/auth';
  
  const testCases = [
    { name: 'Invalid Domain', email: 'test@outlook.com', expectedStatus: 400 },
    { name: 'Valid Gmail', email: 'test.user.123@gmail.com', expectedStatus: 409 }, // 409 if exists or 201 if new
  ];

  for (const tc of testCases) {
    try {
      console.log(`Testing: ${tc.name} (${tc.email})...`);
      const res = await axios.post(`${baseUrl}/register`, {
        name: 'Test User',
        email: tc.email,
        password: 'Password123'
      });
      console.log(`Result: SUCCESS (Status ${res.status})`);
    } catch (error) {
      console.log(`Result: EXPECTED ERROR (Status ${error.response?.status}): ${error.response?.data?.error}`);
    }
    console.log('---');
  }
}

testGmailRestriction();
