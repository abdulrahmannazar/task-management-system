import React, { useState, useRef, useEffect } from 'react';

/**
 * EmployeeMultiSelectDropdown
 * Reusable multi-select dropdown for assigning team members.
 * Replaces the open checkbox list with a sleek dropdown containing a search input.
 */
export default function EmployeeMultiSelectDropdown({
  employees = [],
  selectedIds = [],
  onChange,
  disabled = false,
  placeholder = 'Click to select team members...',
  disabledMessage = 'Team member assignment is locked until client confirms the LOE.'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const filteredEmployees = employees.filter((emp) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const nameMatch = emp.name && emp.name.toLowerCase().includes(term);
    const emailMatch = emp.email && emp.email.toLowerCase().includes(term);
    return nameMatch || emailMatch;
  });

  const handleToggle = (empId) => {
    if (disabled) return;
    const exists = selectedIds.includes(empId);
    const updated = exists
      ? selectedIds.filter((id) => id !== empId)
      : [...selectedIds, empId];
    if (onChange) onChange(updated);
  };

  const handleRemove = (empId, e) => {
    e.stopPropagation();
    if (disabled) return;
    if (onChange) {
      onChange(selectedIds.filter((id) => id !== empId));
    }
  };

  const handleClearAll = (e) => {
    e.stopPropagation();
    if (disabled) return;
    if (onChange) onChange([]);
  };

  const selectedEmployees = employees.filter((emp) =>
    selectedIds.includes(emp.emp_id)
  );

  return (
    <div
      ref={dropdownRef}
      style={{ position: 'relative', width: '100%', userSelect: 'none' }}
    >
      {/* Trigger Field */}
      <div
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        style={{
          minHeight: '38px',
          padding: '5px 10px',
          background: disabled ? '#f8fafc' : '#ffffff',
          border: isOpen ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
          borderRadius: '5px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: isOpen ? '0 0 0 2px rgba(2, 132, 199, 0.15)' : 'none',
          transition: 'all 0.15s ease',
          gap: '8px'
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '5px',
            alignItems: 'center',
            flex: 1,
            minWidth: 0
          }}
        >
          {selectedEmployees.length === 0 ? (
            <span
              style={{
                color: disabled ? '#94a3b8' : '#64748b',
                fontSize: '12.5px'
              }}
            >
              {disabled ? disabledMessage : placeholder}
            </span>
          ) : (
            selectedEmployees.map((emp) => (
              <span
                key={emp.emp_id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  color: '#0369a1',
                  borderRadius: '12px',
                  padding: '2px 8px',
                  fontSize: '11.5px',
                  fontWeight: '500'
                }}
              >
                {emp.name}
                {!disabled && (
                  <span
                    onClick={(e) => handleRemove(emp.emp_id, e)}
                    style={{
                      cursor: 'pointer',
                      color: '#0284c7',
                      fontWeight: 'bold',
                      fontSize: '11px',
                      marginLeft: '2px',
                      lineHeight: 1
                    }}
                    title="Remove"
                  >
                    ✕
                  </span>
                )}
              </span>
            ))
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexShrink: 0
          }}
        >
          {selectedIds.length > 0 && !disabled && (
            <span
              onClick={handleClearAll}
              style={{
                fontSize: '11px',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '2px 4px'
              }}
              title="Clear all selected"
            >
              Clear
            </span>
          )}
          <span
            style={{
              fontSize: '10px',
              color: '#64748b',
              transition: 'transform 0.15s ease'
            }}
          >
            {isOpen ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {/* Dropdown Menu Box */}
      {isOpen && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            boxShadow:
              '0 10px 25px -5px rgba(15, 23, 42, 0.18), 0 4px 6px -2px rgba(15, 23, 42, 0.05)',
            zIndex: 9999,
            overflow: 'hidden'
          }}
        >
          {/* Real-Time Search Box */}
          <div
            style={{
              padding: '8px',
              borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc'
            }}
          >
            <input
              type="text"
              placeholder="Search employees by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: '4px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                outline: 'none',
                fontFamily: "'Poppins', sans-serif"
              }}
            />
          </div>

          {/* List of Employees with Checkbox (Multiple Selection) */}
          <div
            style={{
              maxHeight: '200px',
              overflowY: 'auto',
              padding: '4px 0'
            }}
          >
            {filteredEmployees.length === 0 ? (
              <div
                style={{
                  padding: '12px',
                  textAlign: 'center',
                  fontSize: '12px',
                  color: '#64748b'
                }}
              >
                No employees found matching &quot;{searchTerm}&quot;
              </div>
            ) : (
              filteredEmployees.map((emp) => {
                const isSelected = selectedIds.includes(emp.emp_id);
                return (
                  <div
                    key={emp.emp_id}
                    onClick={() => handleToggle(emp.emp_id)}
                    style={{
                      padding: '7px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      background: isSelected ? '#f0f9ff' : 'transparent',
                      transition: 'background 0.1s ease',
                      fontSize: '12.5px'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggle(emp.emp_id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ cursor: 'pointer', accentColor: '#0284c7' }}
                    />
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        flex: 1,
                        minWidth: 0
                      }}
                    >
                      <span
                        style={{
                          fontWeight: isSelected ? '600' : '400',
                          color: isSelected ? '#0284c7' : '#0f172a'
                        }}
                      >
                        {emp.name}
                      </span>
                      {emp.email && (
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          {emp.email}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <span
                        style={{
                          color: '#0284c7',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Action Footer */}
          <div
            style={{
              padding: '6px 12px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11.5px',
              color: '#64748b'
            }}
          >
            <span>
              {selectedIds.length} employee{selectedIds.length === 1 ? '' : 's'}{' '}
              selected
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              style={{
                padding: '3px 10px',
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                fontWeight: '600',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
