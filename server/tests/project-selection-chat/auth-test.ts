/**
 * Test login and API calls to diagnose auth issues
 */
import axios from 'axios';

const BASE_URL = 'http://localhost:4000/api';
const EMAIL = 'arjunhareeshs.ad24@bitsathy.ac.in';
const PASSWORD = 'password123';

async function main() {
  console.log('Testing login and API calls...\n');

  try {
    // 1. Try login
    console.log(`1. Attempting login with: ${EMAIL}`);
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
      identifier: EMAIL,
      password: PASSWORD,
    });

    console.log(`   Status: ${loginRes.status}`);
    console.log(`   Response keys:`, Object.keys(loginRes.data));

    if (!loginRes.data.token) {
      console.log('   ERROR: No token in response!');
      console.log('   Full response:', JSON.stringify(loginRes.data, null, 2));
      process.exit(1);
    }

    const token = loginRes.data.token;
    const user = loginRes.data.user;
    console.log(`   ✓ Token received: ${token.slice(0, 20)}...`);
    console.log(`   ✓ User: ${user.email}, teamId: ${user.teamId}`);

    // 2. Test authorized endpoint
    console.log(`\n2. Testing authorized endpoint with token...`);
    const client = axios.create({
      baseURL: BASE_URL,
      headers: { Authorization: `Bearer ${token}` },
    });

    const treeRes = await client.get('/projects/catalog/tree');
    console.log(`   Status: ${treeRes.status}`);
    console.log(`   Tree entries: ${treeRes.data?.tree?.length || 0}`);

    if (treeRes.status === 200) {
      console.log(`   ✓ Authorized request successful!`);
    } else {
      console.log(`   ERROR: Got status ${treeRes.status}`);
      console.log('   Response:', treeRes.data);
    }

    // 3. Test catalog
    console.log(`\n3. Fetching catalog...`);
    const catalogRes = await client.get('/projects/catalog', {
      params: { type: 'Hardware' },
    });
    console.log(`   Status: ${catalogRes.status}`);
    console.log(`   Items: ${catalogRes.data?.length || 0}`);
    if (catalogRes.status === 200) {
      console.log(`   ✓ Catalog fetch successful!`);
    }
  } catch (err: any) {
    console.error('ERROR:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', err.response.data);
    }
    process.exit(1);
  }
}

main();
