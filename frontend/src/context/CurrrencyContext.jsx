import React, { createContext, useContext, useState } from 'react';

export const CURRENCY_OPTIONS = [
  { code: 'USD', symbol: '$', label: 'USD ($)' },
  { code: 'LKR', symbol: 'Rs.', label: 'LKR (Rs.)' },
  { code: 'EUR', symbol: '€', label: 'EUR (€)' },
  { code: 'GBP', symbol: '£', label: 'GBP (£)' },
  { code: 'AED', symbol: 'AED', label: 'AED' },
  { code: 'INR', symbol: '₹', label: 'INR (₹)' },
  { code: 'AUD', symbol: 'A$', label: 'AUD (A$)' },
  { code: 'CAD', symbol: 'C$', label: 'CAD (C$)' },
  { code: 'SGD', symbol: 'S$', label: 'SGD (S$)' },
  { code: 'SAR', symbol: 'SAR', label: 'SAR' },
  { code: 'QAR', symbol: 'QAR', label: 'QAR' }
];

const CurrencyContext = createContext();

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState(() => {
    return localStorage.getItem('app_currency') || 'USD';
  });

  const currentOption = CURRENCY_OPTIONS.find(c => c.code === currency) || CURRENCY_OPTIONS[0];
  const currencySymbol = currentOption.symbol;

  const setCurrency = (code) => {
    setCurrencyState(code);
    localStorage.setItem('app_currency', code);
  };

  const formatCurrency = (amount) => {
    const num = Number(amount || 0);
    const formatted = num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return `${currencySymbol} ${formatted}`;
  };

  return (
    <CurrencyContext.Provider value={{
      currency,
      currencySymbol,
      setCurrency,
      formatCurrency,
      currencyList: CURRENCY_OPTIONS
    }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    const stored = localStorage.getItem('app_currency') || 'USD';
    const opt = CURRENCY_OPTIONS.find(c => c.code === stored) || CURRENCY_OPTIONS[0];
    return {
      currency: opt.code,
      currencySymbol: opt.symbol,
      setCurrency: () => {},
      formatCurrency: (val) => `${opt.symbol} ${Number(val || 0).toFixed(2)}`,
      currencyList: CURRENCY_OPTIONS
    };
  }
  return context;
}