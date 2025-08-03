import React, { useState, useEffect } from 'react';
import { Select, Button, Modal, Form, Input, Alert } from 'antd';
import { PlusOutlined, GlobalOutlined } from '@ant-design/icons';

const DomainSelector = ({ value, onChange, userId }) => {
  const [domains, setDomains] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchUserDomains();
  }, [userId]);

  const fetchUserDomains = async () => {
    try {
      const response = await fetch('/api/domains');
      const data = await response.json();
      setDomains([
        { id: null, domain: 'shortlink.com', displayName: 'Default (shortlink.com)' },
        ...data.data
      ]);
    } catch (error) {
      console.error('Failed to fetch domains:', error);
    }
  };

  const handleAddDomain = async (values) => {
    try {
      const response = await fetch('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      
      if (response.ok) {
        await fetchUserDomains();
        setShowAddModal(false);
        form.resetFields();
      }
    } catch (error) {
      console.error('Failed to add domain:', error);
    }
  };

  return (
    <>
      <Select
        value={value}
        onChange={onChange}
        style={{ width: '100%' }}
        placeholder="Chọn domain"
        dropdownRender={(menu) => (
          <>
            {menu}
            <div style={{ padding: 8, borderTop: '1px solid #f0f0f0' }}>
              <Button
                type="text"
                icon={<PlusOutlined />}
                onClick={() => setShowAddModal(true)}
                style={{ width: '100%' }}
              >
                Thêm domain mới
              </Button>
            </div>
          </>
        )}
      >
        {domains.map(domain => (
          <Select.Option key={domain.id || 'default'} value={domain.id}>
            <GlobalOutlined style={{ marginRight: 8 }} />
            {domain.displayName || domain.domain}
            {domain.isVerified === false && (
              <span style={{ color: '#ff4d4f', fontSize: 12 }}> (Chưa xác thực)</span>
            )}
          </Select.Option>
        ))}
      </Select>

      <Modal
        title="Thêm Domain Tùy Chỉnh"
        open={showAddModal}
        onCancel={() => setShowAddModal(false)}
        footer={null}
      >
        <Alert
          message="Hướng dẫn"
          description="Sau khi thêm domain, bạn cần cấu hình DNS records để xác thực ownership."
          type="info"
          style={{ marginBottom: 16 }}
        />
        
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddDomain}
        >
          <Form.Item
            name="domain"
            label="Domain"
            rules={[
              { required: true, message: 'Vui lòng nhập domain' },
              { pattern: /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.([a-zA-Z]{2,}\.)*[a-zA-Z]{2,}$/, message: 'Domain không hợp lệ' }
            ]}
          >
            <Input placeholder="abc.com" />
          </Form.Item>
          
          <Form.Item
            name="displayName"
            label="Tên hiển thị"
          >
            <Input placeholder="ABC Company" />
          </Form.Item>
          
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              Thêm Domain
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default DomainSelector;