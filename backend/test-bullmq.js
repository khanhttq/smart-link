// backend/test-integration.js
const bullMQService = require('./core/queue/BullMQService');

async function testIntegration() {
  console.log('🧪 Testing BullMQ Integration with LinkService...\n');

  try {
    // Khởi tạo BullMQ
    await bullMQService.initialize();
    console.log('✅ BullMQ initialized for integration test\n');

    // Test thêm metadata job (giống như LinkService sẽ làm)
    console.log('📋 Simulating link creation with metadata job...');
    
    const linkData = {
      id: 'link-integration-test',
      shortCode: 'test123',
      originalUrl: 'https://example.com',
      userId: 'user-test'
    };

    // Giả lập việc LinkService tạo job
    await bullMQService.addMetadataJob(
      linkData.id,
      linkData.originalUrl,
      linkData.userId
    );

    // Chờ worker xử lý
    console.log('⏳ Waiting for metadata worker to process...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Kiểm tra kết quả
    const completed = await bullMQService.queues.metadata.getCompleted();
    console.log(`📊 Metadata jobs completed: ${completed.length}`);

    if (completed.length > 0) {
      const job = completed[completed.length - 1]; // Lấy job cuối cùng
      console.log('✅ Latest job result:', job.returnvalue);
    }

    console.log('\n🎉 Integration test completed successfully!');

  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
  } finally {
    await bullMQService.cleanup();
  }
}

testIntegration();