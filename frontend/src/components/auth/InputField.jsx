import React from 'react';
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
import { useState } from 'react';
import './InputField.css';

const iconMap = {
  email: Mail,
  password: Lock,
  full_name: User,
  phone: Mail,
  role: User,
  cdl_number: Lock,
};

export default function InputField({ label, type, value, onChange, name, placeholder }) {
  const [visible, setVisible] = useState(false);
  const Icon = iconMap[name] || (name.includes('password') ? Lock : Mail);
  const isPassword = type === 'password' || name.includes('password');

  return (
    <label className="input-field">
      <span className="input-label">{label}</span>
      <div className="input-wrapper">
        <span className="input-icon">
          <Icon />
        </span>
        <input
          name={name}
          type={isPassword ? (visible ? 'text' : 'password') : type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="input-control"
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setVisible((prev) => !prev)}
            className="password-toggle"
            aria-label={visible ? 'Hide password' : 'Show password'}
          >
            {visible ? <EyeOff /> : <Eye />}
          </button>
        ) : null}
      </div>
    </label>
  );
}
