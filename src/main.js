import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

// Mock Alipay 'my' object for browser testing
if (typeof window !== 'undefined' && !window.my) {
  window.my = {
    getAuthCode: ({ success }) => {
      console.log('Mock: getAuthCode');
      setTimeout(() => success({ authCode: 'mock_auth_code_123' }), 500);
    },
    alert: ({ content }) => {
      console.log('Mock Alert:', content);
      window.alert(content);
    },
    confirm: ({ title, content, confirmButtonText, cancelButtonText, success }) => {
      console.log(`Mock Confirm: ${title} - ${content}`);
      // Auto-confirm for testing purposes
      success({ confirm: true });
    },
    tradePay: ({ success }) => {
      console.log('Mock: tradePay');
      setTimeout(() => success(), 1000);
    },
    scan: ({ success }) => {
      console.log('Mock: scan');
      setTimeout(() => success({ code: 'mock_qr_code_xyz' }), 800);
    },
    getLocation: ({ success }) => {
      console.log('Mock: getLocation');
      setTimeout(() => success({
        latitude: 25.276987,
        longitude: 55.296249,
        accuracy: 10
      }), 600);
    }
  };
}

const app = mount(App, {
  target: document.getElementById('app'),
})

export default app
