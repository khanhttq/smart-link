// backend/core/queue/BullMQService.js
const { Queue, Worker, QueueEvents } = require('bullmq');
const Redis = require('ioredis');

class BullMQService {
  constructor() {
    this.connection = null;
    this.queues = {};
    this.workers = {};
    this.isInitialized = false;
  }

  // Phương thức initialize() để khởi tạo kết nối Redis và các queue
    // Thay thế phương thức initialize() hiện tại
    async initialize() {
    console.log('📋 Khởi tạo BullMQ Service...');
    
    try {
        // Cấu hình Redis cho BullMQ (khác với Redis thường)
        this.connection = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        db: 1,
        maxRetriesPerRequest: null, // BullMQ yêu cầu null
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        lazyConnect: true // Kết nối lazy để tránh lỗi
        });

        await this.connection.ping();
        console.log('✅ Kết nối BullMQ Redis thành công');

        // Khởi tạo queues
        await this.initializeQueues();

        // Khởi tạo workers  
        await this.initializeWorkers();

        this.isInitialized = true;
        console.log('✅ BullMQ Service khởi tạo hoàn tất');
        
    } catch (error) {
        console.error('❌ Khởi tạo BullMQ thất bại:', error);
        throw error;
    }
    }

  // Thêm vào trong class BullMQService, sau phương thức initialize()

    async initializeQueues() {
    const queueOptions = {
        connection: this.connection,
        defaultJobOptions: {
        removeOnComplete: 100, // Giữ 100 job hoàn thành
        removeOnFail: 50,      // Giữ 50 job thất bại
        attempts: 3,           // Thử lại 3 lần
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
        },
    };

    // Khởi tạo các queue
    this.queues.metadata = new Queue('metadata-fetching', queueOptions);
    this.queues.email = new Queue('email-notifications', queueOptions);
    this.queues.analytics = new Queue('analytics-processing', queueOptions);
    this.queues.clickTracking = new Queue('click-tracking', queueOptions);

    console.log('✅ Các queue được khởi tạo thành công');
    }

    // Phương thức thêm job metadata
    async addMetadataJob(linkId, url, userId) {
    if (!this.isInitialized) {
        throw new Error('BullMQ Service chưa được khởi tạo');
    }

    const job = await this.queues.metadata.add('fetch', {
        linkId,
        url,
        userId,
        timestamp: new Date()
    });

    console.log(`📋 Metadata job được thêm: ${job.id} cho URL: ${url}`);
    return job.id;
    }

    // Phương thức thêm job email
    async addEmailJob(type, to, data) {
    if (!this.isInitialized) {
        throw new Error('BullMQ Service chưa được khởi tạo');
    }

    const job = await this.queues.email.add(type, {
        type,
        to,
        data,
        timestamp: new Date()
    });

    console.log(`📧 Email job được thêm: ${job.id} (${type} -> ${to})`);
    return job.id;
    }

        // Thêm vào class BullMQService, sau phương thức initializeQueues()

    async initializeWorkers() {
    const workerOptions = {
        connection: this.connection,
        concurrency: 5, // Xử lý 5 job đồng thời
    };

    // Worker xử lý metadata
    this.workers.metadata = new Worker('metadata-fetching', async (job) => {
        return await this.processMetadataJob(job);
    }, workerOptions);

    // Worker xử lý email
    this.workers.email = new Worker('email-notifications', async (job) => {
        return await this.processEmailJob(job);
    }, workerOptions);

    // Worker xử lý analytics
    this.workers.analytics = new Worker('analytics-processing', async (job) => {
        return await this.processAnalyticsJob(job);
    }, workerOptions);

    // Worker xử lý click tracking
    this.workers.clickTracking = new Worker('click-tracking', async (job) => {
        return await this.processClickTrackingJob(job);
    }, { ...workerOptions, concurrency: 10 });

    console.log('✅ Tất cả Workers đã được khởi tạo');
    }

    // Job processor cho metadata
    async processMetadataJob(job) {
    const { linkId, url, userId } = job.data;
    console.log(`🔍 Đang xử lý metadata cho: ${url}`);

    try {
        // Simulate metadata fetching
        await new Promise(resolve => setTimeout(resolve, 2000)); // Giả lập 2 giây

        // Giả lập kết quả metadata
        const metadata = {
        title: `Title for ${url}`,
        description: `Description for ${url}`,
        image: `https://example.com/image.jpg`
        };

        console.log(`✅ Metadata hoàn thành cho ${url}:`, metadata);
        
        // Cập nhật progress
        job.updateProgress(100);

        return {
        success: true,
        linkId,
        metadata
        };

    } catch (error) {
        console.error(`❌ Lỗi xử lý metadata cho ${url}:`, error.message);
        throw error;
    }
    }

    // Job processor cho email
    async processEmailJob(job) {
    const { type, to, data } = job.data;
    console.log(`📧 Đang gửi email ${type} tới: ${to}`);

    try {
        // Simulate email sending
        await new Promise(resolve => setTimeout(resolve, 1000)); // Giả lập 1 giây

        console.log(`✅ Email ${type} đã gửi thành công tới ${to}`);
        
        job.updateProgress(100);

        return {
        success: true,
        type,
        to,
        messageId: `msg-${Date.now()}`
        };

    } catch (error) {
        console.error(`❌ Lỗi gửi email tới ${to}:`, error.message);
        throw error;
    }
    }

    // Job processor cho analytics
    async processAnalyticsJob(job) {
    const { type, data } = job.data;
    console.log(`📈 Đang xử lý analytics: ${type}`);

    try {
        // Simulate analytics processing
        await new Promise(resolve => setTimeout(resolve, 1500));

        console.log(`✅ Analytics ${type} đã xử lý xong`);
        
        job.updateProgress(100);

        return {
        success: true,
        type,
        processed: true
        };

    } catch (error) {
        console.error(`❌ Lỗi xử lý analytics:`, error.message);
        throw error;
    }
    }

    // Job processor cho click tracking
    async processClickTrackingJob(job) {
    const { clicks } = job.data;
    console.log(`📊 Đang xử lý ${clicks?.length || 1} click events`);

    try {
        // Simulate click processing
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log(`✅ Click tracking hoàn thành`);
        
        job.updateProgress(100);

        return {
        success: true,
        processed: clicks?.length || 1
        };

    } catch (error) {
        console.error(`❌ Lỗi xử lý click tracking:`, error.message);
        throw error;
    }
    }

    // Thêm phương thức cleanup 
    async cleanup() {
    console.log('🧹 Dọn dẹp BullMQ Service...');

    try {
        // Đóng tất cả workers
        for (const worker of Object.values(this.workers)) {
        await worker.close();
        }

        // Đóng tất cả queues
        for (const queue of Object.values(this.queues)) {
        await queue.close();
        }

        // Đóng kết nối Redis
        if (this.connection) {
        await this.connection.quit();
        }

        console.log('✅ BullMQ cleanup hoàn tất');
        
    } catch (error) {
        console.error('❌ Lỗi cleanup:', error);
    }
    }
}

module.exports = new BullMQService();