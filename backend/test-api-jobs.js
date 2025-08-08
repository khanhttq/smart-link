// backend/test-api-jobs.js - Sửa URL
async function testJobsAPI() {
  console.log('🧪 Testing Background Jobs API...\n');

  const baseUrl = 'http://localhost:4000/api/admin'; // Sửa từ 5000 thành 4000
  
  try {
    // Test 1: Kiểm tra queue stats
    console.log('📊 Testing Queue Stats...');
    const statsResponse = await fetch(`${baseUrl}/queues`);
    const statsData = await statsResponse.json();
    
    if (statsData.success) {
      console.log('✅ Queue Stats:', JSON.stringify(statsData.data.stats, null, 2));
    } else {
      console.log('❌ Queue Stats failed:', statsData.message);
    }

    // Test 2: Thêm test jobs
    console.log('\n📋 Testing Add Test Jobs...');
    const testJobsResponse = await fetch(`${baseUrl}/jobs/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const testJobsData = await testJobsResponse.json();
    
    if (testJobsData.success) {
      console.log('✅ Test Jobs Added:', testJobsData.data.jobs);
    } else {
      console.log('❌ Test Jobs failed:', testJobsData.message);
    }

    // Chờ jobs được xử lý
    console.log('\n⏳ Waiting for jobs to process...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Test 3: Kiểm tra lại queue stats sau khi xử lý
    console.log('\n📊 Checking Queue Stats After Processing...');
    const finalStatsResponse = await fetch(`${baseUrl}/queues`);
    const finalStatsData = await finalStatsResponse.json();
    
    if (finalStatsData.success) {
      console.log('✅ Final Queue Stats:', JSON.stringify(finalStatsData.data.stats, null, 2));
    }

    console.log('\n🎉 API Jobs test completed!');

  } catch (error) {
    console.error('❌ API Test failed:', error.message);
  }
}

// Chờ một chút để server khởi động
setTimeout(() => {
  testJobsAPI();
}, 2000);