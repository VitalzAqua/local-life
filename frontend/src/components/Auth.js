import React, { useState } from 'react';
import apiService from '../services/apiService';
import { storeUserSession } from '../utils/auth';

const Auth = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      let userData;
      if (isLogin) {
        userData = await apiService.login({
          email: formData.email,
          password: formData.password
        });
      } else {
        userData = await apiService.register(formData);
      }
      
      if (userData) {
        storeUserSession(userData);
        onLogin(userData);
      }
    } catch (error) {
      setError(error.response?.data?.error || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="auth-container">
      <h2>{isLogin ? 'Login' : 'Register'}</h2>
      {error && <div className="error-message">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        {!isLogin && (
          <div className="form-group">
            <label>Name:</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required={!isLogin}
            />
          </div>
        )}
        
        <div className="form-group">
          <label>Email:</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="form-group">
          <label>Password:</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
          />
        </div>
        
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Please wait...' : (isLogin ? 'Login' : 'Register')}
        </button>
      </form>
      
      <p>
        {isLogin ? "Don't have an account? " : "Already have an account? "}
        <button
          className="link-button"
          onClick={() => setIsLogin(!isLogin)}
        >
          {isLogin ? 'Register' : 'Login'}
        </button>
      </p>
    </div>
  );
};

export default Auth; 