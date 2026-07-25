/**
 * Test login with known working credentials
 */
import axios from 'axios';

const BASE_URL = 'http://localhost:4000/api';

async function test(email: string, password: string) {
  try {
    console.log(`\nTesting: ${email}`);
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
      identifier: email,
      password,
    });

    if (loginRes.status === 200) {
      console.log(`  ✓ Login successful`);
      console.log(`  ✓ Token: ${loginRes.data.token?.slice(0, 20)}...`);
      console.log(`  ✓ User: ${loginRes.data.user?.fullName}`);
      console.log(`  ✓ Team: ${loginRes.data.user?.teamId || 'none'}`);
      return true;
    }
  } catch (err: any) {
    if (err.response?.status === 401) {
      console.log(`  ✗ Invalid credentials`);
    } else {
      console.log(`  ✗ Error: ${err.message}`);
    }
    return false;
  }
}

async function main() {
  console.log('Testing various email formats...');

  const emails = [
    'anithak.ag25@bitsathy.ac.in',
    'arjunhareeshs.ad24@bitsathy.ac.in',
    'admin@projectverse.com',
  ];

  for (const email of emails) {
    await test(email, 'password123');
  }
}

main();
