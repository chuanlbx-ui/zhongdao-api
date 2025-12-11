const fetch = require('node-fetch');

// Test the fixed transaction service API
async function testTransactionAPI() {
  console.log('Testing transaction service API...');

  try {
    // First, login to get a token
    const loginResponse = await fetch('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: '13800138000',
        password: 'password123'
      })
    });

    if (!loginResponse.ok) {
      const error = await loginResponse.json();
      console.error('Login failed:', error);
      process.exit(1);
    }

    const loginData = await loginResponse.json();
    const token = loginData.data.token;
    console.log('✓ Login successful');

    // Test the points balance endpoint
    const balanceResponse = await fetch('http://localhost:3000/api/v1/points/balance', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (balanceResponse.ok) {
      const balanceData = await balanceResponse.json();
      console.log('✓ Balance API works:', balanceData.data);
    } else {
      console.error('✗ Balance API failed:', balanceResponse.status);
    }

    // Test the transaction records endpoint
    const transactionsResponse = await fetch('http://localhost:3000/api/v1/points/transactions/simple?page=1&perPage=10', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (transactionsResponse.ok) {
      const transactionsData = await transactionsResponse.json();
      console.log('✓ Transactions API works:', transactionsData.data.pagination);
    } else {
      console.error('✗ Transactions API failed:', transactionsResponse.status);
      const error = await transactionsResponse.json();
      console.error('Error details:', error);
    }

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testTransactionAPI();