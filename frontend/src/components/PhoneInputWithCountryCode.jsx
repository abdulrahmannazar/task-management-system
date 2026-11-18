import React, { useState, useEffect, useRef, useMemo } from 'react';

/**
 * Curated list of countries with dial codes, flags, and example placeholders.
 * Sri Lanka (+94) is pinned at the top as the primary default.
 */
export const COUNTRY_CODES = [
  { code: '+94', name: 'Sri Lanka', iso: 'LK', flag: '🇱🇰', placeholder: '77 123 4567', priority: 1 },
  { code: '+91', name: 'India', iso: 'IN', flag: '🇮🇳', placeholder: '98765 43210', priority: 2 },
  { code: '+971', name: 'United Arab Emirates', iso: 'AE', flag: '🇦🇪', placeholder: '50 123 4567', priority: 3 },
  { code: '+966', name: 'Saudi Arabia', iso: 'SA', flag: '🇸🇦', placeholder: '50 123 4567', priority: 4 },
  { code: '+44', name: 'United Kingdom', iso: 'GB', flag: '🇬🇧', placeholder: '7911 123456', priority: 5 },
  { code: '+1', name: 'United States', iso: 'US', flag: '🇺🇸', placeholder: '202 555 0123', priority: 6 },
  { code: '+1', name: 'Canada', iso: 'CA', flag: '🇨🇦', placeholder: '416 555 0123', priority: 7 },
  { code: '+61', name: 'Australia', iso: 'AU', flag: '🇦🇺', placeholder: '412 345 678', priority: 8 },
  { code: '+65', name: 'Singapore', iso: 'SG', flag: '🇸🇬', placeholder: '9123 4567', priority: 9 },
  { code: '+974', name: 'Qatar', iso: 'QA', flag: '🇶🇦', placeholder: '3312 3456', priority: 10 },
  { code: '+968', name: 'Oman', iso: 'OM', flag: '🇴🇲', placeholder: '9123 4567', priority: 11 },
  { code: '+965', name: 'Kuwait', iso: 'KW', flag: '🇰🇼', placeholder: '9123 4567', priority: 12 },
  { code: '+973', name: 'Bahrain', iso: 'BH', flag: '🇧🇭', placeholder: '3612 3456', priority: 13 },
  { code: '+960', name: 'Maldives', iso: 'MV', flag: '🇲🇻', placeholder: '712 3456', priority: 14 },
  { code: '+60', name: 'Malaysia', iso: 'MY', flag: '🇲🇾', placeholder: '12 345 6789', priority: 15 },
  { code: '+64', name: 'New Zealand', iso: 'NZ', flag: '🇳🇿', placeholder: '21 123 4567', priority: 16 },
  { code: '+49', name: 'Germany', iso: 'DE', flag: '🇩🇪', placeholder: '151 12345678', priority: 17 },
  { code: '+33', name: 'France', iso: 'FR', flag: '🇫🇷', placeholder: '6 12 34 56 78', priority: 18 },
  { code: '+39', name: 'Italy', iso: 'IT', flag: '🇮🇹', placeholder: '312 345 6789', priority: 19 },
  { code: '+41', name: 'Switzerland', iso: 'CH', flag: '🇨🇭', placeholder: '79 123 45 67', priority: 20 },
  { code: '+31', name: 'Netherlands', iso: 'NL', flag: '🇳🇱', placeholder: '6 12345678', priority: 21 },
  { code: '+81', name: 'Japan', iso: 'JP', flag: '🇯🇵', placeholder: '90 1234 5678', priority: 22 },
  { code: '+86', name: 'China', iso: 'CN', flag: '🇨🇳', placeholder: '138 0013 8000', priority: 23 },
  { code: '+852', name: 'Hong Kong', iso: 'HK', flag: '🇭🇰', placeholder: '9123 4567', priority: 24 },
  { code: '+82', name: 'South Korea', iso: 'KR', flag: '🇰🇷', placeholder: '10 1234 5678', priority: 25 },
  { code: '+27', name: 'South Africa', iso: 'ZA', flag: '🇿🇦', placeholder: '71 123 4567', priority: 26 },
  { code: '+92', name: 'Pakistan', iso: 'PK', flag: '🇵🇰', placeholder: '300 1234567', priority: 27 },
  { code: '+880', name: 'Bangladesh', iso: 'BD', flag: '🇧🇩', placeholder: '1712 345678', priority: 28 },
  { code: '+62', name: 'Indonesia', iso: 'ID', flag: '🇮🇩', placeholder: '812 3456 7890', priority: 29 },
  { code: '+63', name: 'Philippines', iso: 'PH', flag: '🇵🇭', placeholder: '917 123 4567', priority: 30 },
  { code: '+66', name: 'Thailand', iso: 'TH', flag: '🇹🇭', placeholder: '81 234 5678', priority: 31 },
  { code: '+84', name: 'Vietnam', iso: 'VN', flag: '🇻🇳', placeholder: '91 234 5678', priority: 32 },
  { code: '+353', name: 'Ireland', iso: 'IE', flag: '🇮🇪', placeholder: '87 123 4567', priority: 33 },
  { code: '+46', name: 'Sweden', iso: 'SE', flag: '🇸🇪', placeholder: '70 123 45 67', priority: 34 },
  { code: '+47', name: 'Norway', iso: 'NO', flag: '🇳🇴', placeholder: '412 34 567', priority: 35 },
  { code: '+45', name: 'Denmark', iso: 'DK', flag: '🇩🇰', placeholder: '20 12 34 56', priority: 36 },
  { code: '+34', name: 'Spain', iso: 'ES', flag: '🇪🇸', placeholder: '612 34 56 78', priority: 37 },
  { code: '+351', name: 'Portugal', iso: 'PT', flag: '🇵🇹', placeholder: '912 345 678', priority: 38 },
  { code: '+55', name: 'Brazil', iso: 'BR', flag: '🇧🇷', placeholder: '11 91234 5678', priority: 39 },
  { code: '+90', name: 'Turkey', iso: 'TR', flag: '🇹🇷', placeholder: '532 123 4567', priority: 40 },
  { code: '+20', name: 'Egypt', iso: 'EG', flag: '🇪🇬', placeholder: '100 123 4567', priority: 41 },
  { code: '+254', name: 'Kenya', iso: 'KE', flag: '🇰🇪', placeholder: '712 345678', priority: 42 },
  { code: '+234', name: 'Nigeria', iso: 'NG', flag: '🇳🇬', placeholder: '802 123 4567', priority: 43 },
  { code: '+977', name: 'Nepal', iso: 'NP', flag: '🇳🇵', placeholder: '984 1234567', priority: 44 },
  { code: '+230', name: 'Mauritius', iso: 'MU', flag: '🇲🇺', placeholder: '5251 2345', priority: 45 },
  { code: '+248', name: 'Seychelles', iso: 'SC', flag: '🇸🇨', placeholder: '2 512 345', priority: 46 }
];

/**
 * Intelligent helper to parse raw telephone values (stored in DB or typed)
 * into country code and local number components.
 */
export function parsePhoneValue(rawVal, defaultCode = '+94') {
  if (!rawVal || !String(rawVal).trim()) {
    return { selectedCode: defaultCode, localNumber: '' };
  }

  const trimmed = String(rawVal).trim();

  // If starts with +, try matching the longest matching country code
  if (trimmed.startsWith('+')) {
    const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
    for (const c of sorted) {
      if (trimmed.startsWith(c.code)) {
        const remainder = trimmed.slice(c.code.length).trim();
        return { selectedCode: c.code, localNumber: remainder };
      }
    }
    // Generic match for other country codes (+123 ...)
    const match = trimmed.match(/^(\+\d{1,4})\s*(.*)$/);
    if (match) {
      return { selectedCode: match[1], localNumber: match[2].trim() };
    }
  }

  // If starts with 0 (Sri Lankan local number e.g. 077 123 4567), strip leading 0 and default to +94
  if (trimmed.startsWith('0')) {
    return { selectedCode: '+94', localNumber: trimmed.replace(/^0+/, '') };
  }

  // Unprefixed number (e.g. 771234567)
  return { selectedCode: defaultCode, localNumber: trimmed };
}

/**
 * Reusable Phone Input with Country Code Selector
 * Matches Frontier Advisory design system (#0f172a, #0284c7, #f4f6f8)
 */
export default function PhoneInputWithCountryCode({
  name,
  value = '',
  onChange,
  placeholder,
  required = false,
  disabled = false,
  id,
  style = {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const phoneInputRef = useRef(null);

  // Parse current value
  const { selectedCode, localNumber } = useMemo(() => {
    return parsePhoneValue(value);
  }, [value]);

  const currentCountry = useMemo(() => {
    return (
      COUNTRY_CODES.find((c) => c.code === selectedCode) || {
        code: selectedCode,
        name: 'Country',
        iso: 'XX',
        flag: '🌐',
        placeholder: '77 123 4567'
      }
    );
  }, [selectedCode]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      // Focus search input when opened
      setTimeout(() => {
        if (searchInputRef.current) searchInputRef.current.focus();
      }, 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Filter countries by name or dial code
  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return COUNTRY_CODES;
    const q = searchQuery.toLowerCase().replace(/^\+/, '');
    return COUNTRY_CODES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.replace('+', '').includes(q) ||
        c.iso.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Propagate updated phone number to parent
  const emitChange = (code, number) => {
    if (!onChange) return;
    const cleanNumber = String(number || '').trim();
    // If empty number, pass empty string so optional fields remain blank
    const fullValue = cleanNumber ? `${code} ${cleanNumber}` : '';
    onChange({
      target: {
        name,
        value: fullValue
      }
    });
  };

  const handleSelectCountry = (country) => {
    setIsOpen(false);
    setSearchQuery('');
    emitChange(country.code, localNumber);
    if (phoneInputRef.current) {
      phoneInputRef.current.focus();
    }
  };

  const handleNumberChange = (e) => {
    let raw = e.target.value;

    // If user pasted a full international number with +, parse it automatically
    if (raw.trim().startsWith('+')) {
      const parsed = parsePhoneValue(raw);
      emitChange(parsed.selectedCode, parsed.localNumber);
      return;
    }

    // Strip redundant leading 0 if user enters e.g. 077... when country code is selected
    if (raw.startsWith('0') && raw.length > 1) {
      raw = raw.replace(/^0+/, '');
    }

    // Filter to only digits, spaces, and hyphens
    const cleaned = raw.replace(/[^0-9\s\-()]/g, '');
    emitChange(selectedCode, cleaned);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    emitChange(selectedCode, '');
    if (phoneInputRef.current) phoneInputRef.current.focus();
  };

  const dynamicPlaceholder = placeholder || currentCountry.placeholder || '77 123 4567';

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        ...style
      }}
    >
      {/* Input Group Container */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: disabled ? '#f8fafc' : '#ffffff',
          border: isFocused ? '1px solid #0284c7' : '1px solid #cbd5e1',
          borderRadius: '8px',
          boxShadow: isFocused ? '0 0 0 3px rgba(2, 132, 199, 0.12)' : 'none',
          transition: 'all 0.15s ease',
          boxSizing: 'border-box',
          width: '100%'
        }}
      >
        {/* Country Code Trigger Button */}
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          title={`Country Code: ${currentCountry.name} (${currentCountry.code})`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 10px 10px 12px',
            backgroundColor: isOpen ? '#f1f5f9' : '#f8fafc',
            border: 'none',
            borderRight: '1px solid #e2e8f0',
            borderTopLeftRadius: '7px',
            borderBottomLeftRadius: '7px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: '13.5px',
            fontWeight: '600',
            color: '#0f172a',
            outline: 'none',
            whiteSpace: 'nowrap',
            userSelect: 'none',
            transition: 'background-color 0.15s ease'
          }}
        >
          <span style={{ fontSize: '16px', lineHeight: 1 }}>{currentCountry.flag}</span>
          <span style={{ color: '#0f172a', fontWeight: '600' }}>{currentCountry.code}</span>
          <span
            style={{
              fontSize: '10px',
              color: '#64748b',
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s ease'
            }}
          >
            ▼
          </span>
        </button>

        {/* Local Phone Number Input */}
        <input
          ref={phoneInputRef}
          type="tel"
          id={id}
          name={name}
          value={localNumber}
          onChange={handleNumberChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={dynamicPlaceholder}
          required={required}
          disabled={disabled}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            padding: '10px 12px',
            fontSize: '14px',
            color: '#0f172a',
            backgroundColor: 'transparent',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
            minWidth: 0
          }}
        />

        {/* Clear Button */}
        {localNumber && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            title="Clear number"
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '0 10px',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              outline: 'none',
              transition: 'color 0.15s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#e11d48')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
          >
            ✕
          </button>
        )}
      </div>

      {/* Country Code Dropdown Panel */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 5px)',
            left: 0,
            zIndex: 1050,
            width: '300px',
            maxWidth: '92vw',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '10px',
            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.15), 0 8px 10px -6px rgba(15, 23, 42, 0.1)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeIn 0.12s ease-out'
          }}
        >
          {/* Search Header */}
          <div
            style={{
              padding: '8px 10px',
              borderBottom: '1px solid #f1f5f9',
              backgroundColor: '#f8fafc'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '0 8px'
              }}
            >
              <span style={{ fontSize: '13px', color: '#94a3b8', marginRight: '6px' }}></span>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search country or code (+94)"
                style={{
                  width: '100%',
                  border: 'none',
                  outline: 'none',
                  padding: '7px 0',
                  fontSize: '12.5px',
                  color: '#0f172a',
                  backgroundColor: 'transparent'
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* List of Countries */}
          <div
            style={{
              maxHeight: '230px',
              overflowY: 'auto',
              padding: '4px 0'
            }}
          >
            {filteredCountries.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                No countries found matching "{searchQuery}"
              </div>
            ) : (
              filteredCountries.map((c) => {
                const isSelected = c.code === selectedCode;
                return (
                  <button
                    key={`${c.iso}-${c.code}`}
                    type="button"
                    onClick={() => handleSelectCountry(c)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      backgroundColor: isSelected ? '#f0f9ff' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '13px',
                      transition: 'background-color 0.1s ease',
                      outline: 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px' }}>{c.flag}</span>
                      <span
                        style={{
                          fontWeight: isSelected ? '600' : '500',
                          color: isSelected ? '#0284c7' : '#1e293b'
                        }}
                      >
                        {c.name}
                      </span>
                      {c.iso === 'LK' && (
                        <span
                          style={{
                            fontSize: '10px',
                            backgroundColor: '#e0f2fe',
                            color: '#0369a1',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            fontWeight: '600'
                          }}
                        >
                          Default
                        </span>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: '12.5px',
                        fontWeight: '600',
                        color: isSelected ? '#0284c7' : '#64748b'
                      }}
                    >
                      {c.code}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
