// frontend/src/components/SmartRegistrationModal.js - FIXED VERSION
import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  Form, 
  Input, 
  Button, 
  Typography, 
  Space,
  Alert,
  Progress,
  Steps,
  Checkbox
} from 'antd';
import {
  UserOutlined,
  LockOutlined,
  MailOutlined,
  UserAddOutlined,
  CheckCircleOutlined,
  SafetyOutlined,
  RocketOutlined,
  EyeOutlined,
  EyeInvisibleOutlined
} from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import notificationService from '../services/notificationService';
import { ERROR_CODES } from '../constants/errorCodes';
import './SmartRegistrationModal.less';

const { Title, Text } = Typography;
const { Step } = Steps;

// ✅ FIX: Unified validation rules (same as RegisterPage)
const VALIDATION_RULES = {
  name: [
    { required: true, message: 'Vui lòng nhập họ tên!' },
    { min: 2, message: 'Họ tên phải có ít nhất 2 ký tự!' },
    { max: 50, message: 'Họ tên không được quá 50 ký tự!' },
    { pattern: /^[a-zA-ZÀ-ỹ\s]+$/, message: 'Họ tên chỉ được chứa chữ cái và khoảng trắng!' }
  ],
  email: [
    { required: true, message: 'Email là bắt buộc!' },
    { type: 'email', message: 'Định dạng email không hợp lệ!' }
  ],
  password: [
    { required: true, message: 'Vui lòng nhập mật khẩu!' },
    { min: 8, message: 'Mật khẩu phải có ít nhất 8 ký tự!' },
    { 
      pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 
      message: 'Mật khẩu phải có ít nhất 1 chữ hoa, 1 chữ thường và 1 số!' 
    }
  ]
};

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
  const [acceptTerms, setAcceptTerms] = useState(false);
  const { register, getPasswordStrength } = useAuthStore();

  // ✅ FIX: Set initial form values when modal opens
  useEffect(() => {
    if (visible && email) {
      form.setFieldsValue({
        email: email,
        password: password || '',
        confirmPassword: password || ''
      });
    }
  }, [visible, email, password, form]);

  // ✅ FIX: Reset form when modal closes
  useEffect(() => {
    if (!visible) {
      setCurrentStep(0);
      setLoading(false);
      setAcceptTerms(false);
      form.resetFields();
    }
  }, [visible, form]);

  // Watch password field for strength indicator
  const passwordValue = Form.useWatch('password', form);
  const passwordStrength = passwordValue ? getPasswordStrength(passwordValue) : null;

  // ✅ FIX: Enhanced form submission
  const handleSubmit = async (values) => {
    setLoading(true);
    
    try {
      console.log('🚀 Smart registration submission...');
      
      // Additional validation
      if (!acceptTerms) {
        notificationService.error('Vui lòng đồng ý với điều khoản sử dụng!');
        setLoading(false);
        return;
      }

      if (values.password !== values.confirmPassword) {
        notificationService.error('Mật khẩu xác nhận không khớp!');
        setLoading(false);
        return;
      }

      setCurrentStep(1); // Show processing step
      
      const result = await register({
        name: values.name,
        email: values.email,
        password: values.password
      });
      
      if (result && result.success) {
        console.log('✅ Smart registration successful');
        setCurrentStep(2); // Show success step
        
        // Show success step for a moment, then close
        setTimeout(() => {
          form.resetFields();
          setCurrentStep(0);
          setAcceptTerms(false);
          onSuccess && onSuccess(result);
        }, 2000);
        
      } else {
        console.error('❌ Smart registration failed:', result);
        setCurrentStep(0); // Back to form
        
        // Error already handled by authStore/notificationService
        const errorCode = result?.error || ERROR_CODES.SYSTEM_UNKNOWN_ERROR;
        
        // Focus on error field if validation failed
        if (errorCode === ERROR_CODES.VALIDATION_REQUIRED_FIELD) {
          const firstErrorField = form.getFieldsError().find(field => field.errors.length > 0);
          if (firstErrorField) {
            form.scrollToField(firstErrorField.name);
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Smart registration error:', error);
      notificationService.handleError(error, 'Smart Registration');
      setCurrentStep(0); // Back to form
    } finally {
      setLoading(false);
    }
  };

  // ✅ FIX: Enhanced cancel handler
  const handleCancel = () => {
    if (!loading) {
      setCurrentStep(0);
      setAcceptTerms(false);
      form.resetFields();
      onCancel();
    }
  };

  // ✅ FIX: Custom password confirmation validator
  const validateConfirmPassword = ({ getFieldValue }) => ({
    validator(_, value) {
      if (!value || getFieldValue('password') === value) {
        return Promise.resolve();
      }
      return Promise.reject(new Error('Mật khẩu xác nhận không khớp!'));
    },
  });

  // ✅ FIX: Render step content with better UX
  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Registration Form
        return (
          <div className="modal-content">
            {/* Header */}
            <div className="modal-header">
              <RocketOutlined className="header-icon smart-icon" />
              <Title level={3} className="header-title">
                Đăng ký thông minh
              </Title>
              <Text type="secondary" className="header-subtitle">
                Email chưa được đăng ký. Hãy tạo tài khoản để tiếp tục!
              </Text>
            </div>

            {/* Smart Info Alert */}
            <Alert
              message={
                <Space>
                  <SafetyOutlined />
                  <Text strong>Thông tin đã được điền sẵn</Text>
                </Space>
              }
              description="Chúng tôi đã điền sẵn email và mật khẩu từ thông tin đăng nhập. Chỉ cần nhập tên để hoàn tất đăng ký!"
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
              className="smart-registration-form"
              scrollToFirstError
            >
              {/* Full Name */}
              <Form.Item
                name="name"
                label="Họ và tên"
                rules={VALIDATION_RULES.name}
                hasFeedback
              >
                <Input
                  prefix={<UserOutlined />}
                  placeholder="Nhập họ và tên đầy đủ"
                  autoFocus
                  maxLength={50}
                  showCount
                />
              </Form.Item>

              {/* Email (Disabled) */}
              <Form.Item
                name="email"
                label="Địa chỉ email"
                rules={VALIDATION_RULES.email}
              >
                <Input
                  prefix={<MailOutlined />}
                  placeholder="Email"
                  disabled
                  className="disabled-input"
                />
              </Form.Item>

              {/* Password with strength indicator */}
              <Form.Item
                name="password"
                label="Mật khẩu"
                rules={VALIDATION_RULES.password}
                hasFeedback
              >
                <div>
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder="Mật khẩu"
                    iconRender={(visible) => (visible ? <EyeOutlined /> : <EyeInvisibleOutlined />)}
                  />
                  
                  {/* Password strength indicator */}
                  {passwordStrength && (
                    <div className="password-strength-container">
                      <Progress
                        percent={passwordStrength.score}
                        status={passwordStrength.status}
                        showInfo={false}
                        strokeWidth={4}
                        trailColor="#f0f0f0"
                      />
                      <Text 
                        type="secondary" 
                        className={`strength-text strength-${passwordStrength.level}`}
                      >
                        Độ mạnh: {passwordStrength.text}
                      </Text>
                    </div>
                  )}
                </div>
              </Form.Item>

              {/* Confirm Password */}
              <Form.Item
                name="confirmPassword"
                label="Xác nhận mật khẩu"
                dependencies={['password']}
                rules={[
                  { required: true, message: 'Vui lòng xác nhận mật khẩu!' },
                  validateConfirmPassword
                ]}
                hasFeedback
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="Nhập lại mật khẩu"
                  iconRender={(visible) => (visible ? <EyeOutlined /> : <EyeInvisibleOutlined />)}
                />
              </Form.Item>

              {/* Terms and Conditions */}
              <Form.Item
                name="terms"
                valuePropName="checked"
                rules={[
                  { required: true, message: 'Vui lòng đồng ý với điều khoản sử dụng!' }
                ]}
              >
                <Checkbox
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                >
                  Tôi đồng ý với Điều khoản sử dụng và Chính sách bảo mật
                </Checkbox>
              </Form.Item>

              {/* Form Actions */}
              <Form.Item className="form-actions">
                <Space size="middle" style={{ width: '100%', justifyContent: 'flex-end' }}>
                  <Button 
                    onClick={handleCancel}
                    disabled={loading}
                    size="large"
                  >
                    Hủy
                  </Button>
                  <Button 
                    type="primary" 
                    htmlType="submit" 
                    loading={loading}
                    disabled={!acceptTerms}
                    icon={<UserAddOutlined />}
                    size="large"
                    className="submit-button"
                  >
                    {loading ? 'Đang tạo...' : 'Tạo tài khoản'}
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </div>
        );

      case 1: // Processing Step
        return (
          <div className="step-content processing-step">
            <div className="processing-animation">
              <RocketOutlined className="processing-icon spinning" />
            </div>
            <Title level={3} className="step-title">
              Đang tạo tài khoản...
            </Title>
            <Text type="secondary" className="step-subtitle">
              Vui lòng chờ trong giây lát, chúng tôi đang thiết lập tài khoản của bạn
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
          <div className="step-content success-step">
            <CheckCircleOutlined className="success-icon" />
            <Title level={3} className="step-title success-title">
              Tài khoản đã được tạo thành công!
            </Title>
            <Text className="step-subtitle success-subtitle">
              Chào mừng bạn đến với <Text strong>Shortlink System</Text>
            </Text>
            <Text type="secondary" className="step-subtitle">
              Đang chuyển hướng đến trang chính...
            </Text>
            <Progress 
              percent={100} 
              status="success"
              showInfo={false}
              strokeWidth={6}
              className="success-progress"
            />
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
      width={560}
      centered
      destroyOnClose
      maskClosable={!loading && currentStep === 0}
      closable={!loading && currentStep === 0}
      className="smart-registration-modal"
      styles={{
        body: { padding: '24px' }
      }}
    >
      {/* Progress Steps - Only show during process */}
      {currentStep > 0 && (
        <div className="modal-steps">
          <Steps current={currentStep} size="small" className="progress-steps">
            <Step title="Nhập thông tin" />
            <Step title="Đang xử lý" />
            <Step title="Hoàn thành" />
          </Steps>
        </div>
      )}

      {/* Step Content */}
      <div className="modal-body">
        {renderStepContent()}
      </div>
    </Modal>
  );
};

export default SmartRegistrationModal;