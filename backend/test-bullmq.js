// backend/test-workers.js - Thay thế toàn bộ nội dung
const bullMQService = require('./core/queue/BullMQService');

async function testWorkers() {
  console.log('🧪 Testing BullMQ Workers...\n');

  try {
    // Khởi tạo BullMQ service (bao gồm cả workers)
    await bullMQService.initialize();
    console.log('✅ BullMQ và Workers khởi tạo thành công!\n');

    // Test 1: Thêm và xử lý metadata job
    console.log('📋 Test 1: Metadata Job...');
    await bullMQService.addMetadataJob(
      'link-789',
      'https://github.com',
      'user-123'
    );

    // Test 2: Thêm và xử lý email job
    console.log('\n📧 Test 2: Email Job...');
    await bullMQService.addEmailJob(
      'welcome',
      'user@example.com',
      { userName: 'John Doe' }
    );

    // Chờ một chút để workers xử lý
    console.log('\n⏳ Chờ workers xử lý jobs...');
    await new Promise(resolve => setTimeout(resolve, 4000)); // Chờ 4 giây

    // Kiểm tra trạng thái queue
    console.log('\n📊 Kiểm tra kết quả:');
    
    const metadataCompleted = await bullMQService.queues.metadata.getCompleted();
    const emailCompleted = await bullMQService.queues.email.getCompleted();
    const metadataWaiting = await bullMQService.queues.metadata.getWaiting();
    const emailWaiting = await bullMQService.queues.email.getWaiting();

    console.log(`📋 Metadata - Hoàn thành: ${metadataCompleted.length}, Chờ: ${metadataWaiting.length}`);
    console.log(`📧 Email - Hoàn thành: ${emailCompleted.length}, Chờ: ${emailWaiting.length}`);

    // Hiển thị kết quả của job đầu tiên
    if (metadataCompleted.length > 0) {
      const job = metadataCompleted[0];
      console.log(`\n✅ Metadata Job Result:`, job.returnvalue);
    }

    if (emailCompleted.length > 0) {
      const job = emailCompleted[0];
      console.log(`\n✅ Email Job Result:`, job.returnvalue);
    }

    console.log('\n🎉 Workers test hoàn tất!');
    
  } catch (error) {
    console.error('❌ Workers test thất bại:', error.message);
  } finally {
    // Sử dụng phương thức cleanup mới
    await bullMQService.cleanup();
  }
}

testWorkers();