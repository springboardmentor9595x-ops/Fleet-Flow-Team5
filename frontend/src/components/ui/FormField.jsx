import React from 'react';

export default function FormField({ label, hint, error, children }) {
  return (
    <label className="block text-slate-100/85 text-sm font-medium">
      <span className="block text-slate-100 mb-3">{label}</span>
      {children}
      {hint ? <p className="mt-2 text-xs text-slate-300/80">{hint}</p> : null}
      {error ? <p className="mt-2 text-sm text-amber-300">{error}</p> : null}
    </label>
  );
}
