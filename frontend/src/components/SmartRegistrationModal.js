import React, { useState } from 'react';
import { 
  Modal, 
  Form, 
  Input, 
  Button, 
  Typography, 
  Space,
  Alert,
  message,
  Progress,
  Steps
} from 'antd';
import {
  UserOutlined,
  LockOutlined,
  MailOutlined,
  UserAddOutlined,
  CheckCircleOutlined,
  SafetyOutlined,
  RocketOutlined
} from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import './SmartRegistrationModal.less';

const { Title, Text } = Typography;
const { Step } = Steps;

const SmartRegistrationModal = ({ 
  visible, 
  onCancel, 
  email, 
  password,
  onSuccess 
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const { register } = useAuthStore();

  // Set initial form values when modal opens
  React.useEffect(() => {
    if (visible && email) {
      form.setFieldsValue({
        email: email,
        password: password || '',
        confirmPassword: password || ''
      });
    }
  }, [visible, email, password, form]);

  // Password strength checker
  const getPasswordStrength = (password) => {
    if (!password) return { percent: 0, status: 'exception', text: 'Chưa nhập mật khẩu' };
    
    let score = 0;
    if (password.length >= 8) score += 25;
    if (/[a-z]/.test(password)) score += 25;
    if (/[A-Z]/.test(password)) score += 25;
    if (/[0-9]/.test(password)) score += 25;
    
    if (score < 50) return { percent: score, status: 'exception', text: 'Yếu' };
    if (score < 75) return { percent: score, status: 'active', text: 'Trung bình' };
    if (score < 100) return { percent: score, status: 'normal', text: 'Mạnh' };
    return { percent: 100, status: 'success', text: 'Rất mạnh' };
  };

  const handleSubmit = async (values) => {
    setLoading(true);
    
    try {
      setCurrentStep(1); // Show processing step
      
      const result = await register({
        name: values.name,
        email: values.email,
        password: values.password
      });
      
      if (result.success) {
        setCurrentStep(2); // Show success step
        
        setTimeout(() => {
          message.success('🎉 Tài khoản đã được tạo thành công!');
          form.resetFields();
          setCurrentStep(0);
          onSuccess && onSuccess(result);
        }, 1500);
      } else {
        message.error('Đăng ký thất bại. Vui lòng thử lại!');
        setCurrentStep(0);
      }
    } catch (error) {
      console.error('Registration error:', error);
      message.error('Có lỗi xảy ra. Vui lòng thử lại!');
      setCurrentStep(0); // Back to form
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setCurrentStep(0);
    form.resetFields();
    onCancel();
  };

  const passwordValue = Form.useWatch('password', form);
  const passwordStrength = getPasswordStrength(passwordValue);

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Registration Form
        return (
          <>
            {/* Header */}
            <div className="modal-header">
              <RocketOutlined className="header-icon" />
              <Title level={3} className="header-title">
                Tạo tài khoản mới
              </Title>
              <Text type="secondary" className="header-subtitle">
                Email chưa được đăng ký. Hãy tạo tài khoản để tiếp tục!
              </Text>
            </div>

            {/* Smart Info */}
            <Alert
              message={
                <Space>
                  <SafetyOutlined />
                  <Text strong>Đăng ký thông minh</Text>
                </Space>
              }
              description="Chúng tôi đã điền sẵn email và mật khẩu. Chỉ cần nhập tên để hoàn tất!"
              type="success"
              showIcon={false}
              className="smart-alert"
            />

            {/* Registration Form */}
            <Form
              form={form}
              name="smartRegister"
              onFinish={handleSubmit}
              layout="vertical"
              size="large"
              className="registration-form"
            >
              <Form.Item
                name="name"
                rules={[
                  { required: true, message: 'Vui lòng nhập họ tên!' },
                  { min: 2, message: 'Họ tên phải có ít nhất 2 ký tự!' }
                ]}
              >
                <Input 
                  prefix={<UserOutlined />} 
                  placeholder="Họ và tên"
                  autoFocus
                />
              </Form.Item>

              <Form.Item
                name="email"
                rules={[
                  { required: true, message: 'Vui lòng nhập email!' },
                  { type: 'email', message: 'Email không hợp lệ!' }
                ]}
              >
                <Input 
                  prefix={<MailOutlined />} 
                  placeholder="Email"
                  disabled
                />
              </Form.Item>

              <Form.Item
                name="password"
                rules={[
                  { required: true, message: 'Vui lòng nhập mật khẩu!' },
                  { min: 8, message: 'Mật khẩu phải có ít nhất 8 ký tự!' }
                ]}
              >
                <div>
                  <Input.Password 
                    prefix={<LockOutlined />} 
                    placeholder="Mật khẩu"
                  />
                  {passwordValue && (
                    <div className="password-strength">
                      <Progress 
                        percent={passwordStrength.percent} 
                        status={passwordStrength.status}
                        showInfo={false}
                        strokeWidth={4}
                      />
                      <Text type="secondary" className="strength-text">
                        Độ mạnh mật khẩu: {passwordStrength.text}
                      </Text>
                    </div>
                  )}
                </div>
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                dependencies={['password']}
                rules={[
                  { required: true, message: 'Vui lòng xác nhận mật khẩu!' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('Mật khẩu xác nhận không khớp!'));
                    },
                  }),
                ]}
              >
                <Input.Password 
                  prefix={<LockOutlined />} 
                  placeholder="Xác nhận mật khẩu"
                />
              </Form.Item>

              <Form.Item className="form-actions">
                <Space>
                  <Button 
                    onClick={handleCancel}
                    disabled={loading}
                  >
                    Hủy
                  </Button>
                  <Button 
                    type="primary" 
                    htmlType="submit" 
                    loading={loading}
                    icon={<UserAddOutlined />}
                    className="submit-button"
                  >
                    Tạo tài khoản
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </>
        );

      case 1: // Processing Step
        return (
          <div className="step-content">
            <div className="processing-animation">
              <RocketOutlined className="processing-icon" />
            </div>
            <Title level={3} className="step-title">
              Đang tạo tài khoản...
            </Title>
            <Text type="secondary" className="step-subtitle">
              Vui lòng chờ trong giây lát
            </Text>
            <Progress 
              percent={100} 
              status="active"
              showInfo={false}
              strokeWidth={6}
              className="progress-bar"
            />
          </div>
        );

      case 2: // Success Step
        return (
          <div className="step-content">
            <CheckCircleOutlined className="success-icon" />
            <Title level={3} className="step-title">
              Tài khoản đã được tạo!
            </Title>
            <Text className="step-subtitle">
              Chào mừng bạn đến với <Text strong>Shortlink System</Text>
            </Text>
            <Text type="secondary" className="step-subtitle">
              Đang chuyển hướng đến dashboard...
            </Text>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      title={null}
      open={visible}
      onCancel={handleCancel}
      footer={null}
      width={520}
      centered
      destroyOnHidden // Replaced destroyOnClose
      maskClosable={!loading}
      closable={!loading && currentStep === 0}
      className="smart-registration-modal"
    >
      {/* Progress Steps */}
      {currentStep > 0 && (
        <Steps current={currentStep} size="small" className="progress-steps">
          <Step title="Nhập thông tin" />
          <Step title="Đang xử lý" />
          <Step title="Hoàn thành" />
        </Steps>
      )}

      {renderStepContent()}
    </Modal>
  );
};

export default SmartRegistrationModal;