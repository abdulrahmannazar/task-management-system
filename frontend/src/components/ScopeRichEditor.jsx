import React, { useRef, useEffect, useState, useCallback } from 'react';

/**
 * Word-style Rich Text Editor for Custom Scopes
 * Pure React / contentEditable with zero external dependencies.
 */
export default function ScopeRichEditor({
  value = '',
  onChange,
  placeholder = 'Enter scope details...',
  minHeight = '90px',
  style = {}
}) {
  const editorRef = useRef(null);
  const lastEmittedValueRef = useRef('');
  const [isFocused, setIsFocused] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [currentBlockTag, setCurrentBlockTag] = useState('p');
  const [activeStates, setActiveStates] = useState({
    bold: false,
    italic: false,
    unorderedList: false,
    orderedList: false
  });

  // Calculate clean text and strip empty wrapper tags (e.g. <p><br></p>)
  const getCleanContent = useCallback(() => {
    if (!editorRef.current) return { html: '', text: '', isEmpty: true };
    const html = editorRef.current.innerHTML;
    // Strip HTML tags and zero-width characters to see if there is genuine visible text
    const text = (editorRef.current.innerText || '')
      .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
      .trim();

    const isEmpty = text.length === 0;
    return {
      html: isEmpty ? '' : html,
      text,
      isEmpty
    };
  }, []);

  // Update live word count, active tag, and formatting states
  const updateStatus = useCallback(() => {
    if (!editorRef.current) return;

    const { text } = getCleanContent();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    setWordCount(words);

    // Active formatting states
    try {
      setActiveStates({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        unorderedList: document.queryCommandState('insertUnorderedList'),
        orderedList: document.queryCommandState('insertOrderedList')
      });
    } catch {
      // ignore security/unsupported errors
    }

    // Active block tag detection
    try {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        let node = selection.anchorNode;
        if (node && node.nodeType === Node.TEXT_NODE) node = node.parentNode;
        let detected = 'p';
        while (node && node !== editorRef.current && node.parentNode) {
          const name = node.nodeName.toLowerCase();
          if (['p', 'h2', 'h3', 'pre', 'ul', 'ol', 'li', 'blockquote'].includes(name)) {
            detected = name;
            break;
          }
          node = node.parentNode;
        }
        setCurrentBlockTag(detected);
      }
    } catch {
      // ignore
    }
  }, [getCleanContent]);

  // Synchronize incoming external value
  useEffect(() => {
    if (!editorRef.current) return;
    const targetValue = value || '';
    if (targetValue !== lastEmittedValueRef.current && targetValue !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = targetValue;
      lastEmittedValueRef.current = targetValue;
      updateStatus();
    }
  }, [value, updateStatus]);

  // Handle user typing or pasting
  const handleInput = () => {
    const { html } = getCleanContent();
    lastEmittedValueRef.current = html;
    if (onChange) {
      onChange(html);
    }
    updateStatus();
  };

  // Execute formatting command safely while retaining caret
  const execCmd = (cmd, val = null) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    try {
      document.execCommand(cmd, false, val);
    } catch (e) {
      console.warn('execCommand error:', e);
    }
    handleInput();
  };

  // Format block style (p, h2, h3, pre)
  const handleBlockChange = (e) => {
    const tag = e.target.value;
    execCmd('formatBlock', tag === 'p' ? '<p>' : `<${tag}>`);
  };

  // Insert Link dialog
  const handleInsertLink = () => {
    const url = window.prompt('Enter link URL (e.g. https://example.com):', 'https://');
    if (url && url.trim()) {
      execCmd('createLink', url.trim());
    }
  };

  // Current editor empty state for placeholder
  const { isEmpty } = getCleanContent();

  return (
    <div
      style={{
        ...styles.container,
        borderColor: isFocused ? '#0284c7' : '#cbd5e1',
        boxShadow: isFocused ? '0 0 0 2px rgba(2, 132, 199, 0.15)' : 'none',
        ...style
      }}
    >
      <style>{`
        .scope-editor-content p { margin: 0 0 4px 0; }
        .scope-editor-content h2 { margin: 6px 0 2px 0; font-size: 15px; font-weight: 700; color: #0f172a; }
        .scope-editor-content h3 { margin: 4px 0 2px 0; font-size: 13.5px; font-weight: 700; color: #0f172a; }
        .scope-editor-content ul { margin: 4px 0 6px 0; padding-left: 20px; list-style-type: disc; }
        .scope-editor-content ol { margin: 4px 0 6px 0; padding-left: 20px; list-style-type: decimal; }
        .scope-editor-content li { margin-bottom: 2px; }
        .scope-editor-content pre { background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 12px; margin: 4px 0; }
        .scope-editor-content a { color: #0284c7; text-decoration: underline; }
      `}</style>

      {/* Top Formatting Toolbar */}
      <div style={styles.toolbar}>
        {/* Block Style Dropdown */}
        <select
          value={['p', 'h2', 'h3', 'pre'].includes(currentBlockTag) ? currentBlockTag : 'p'}
          onChange={handleBlockChange}
          style={styles.blockSelect}
          title="Text Block Style"
        >
          <option value="p">Paragraph</option>
          <option value="h2">Heading 1</option>
          <option value="h3">Heading 2</option>
          <option value="pre">Preformatted</option>
        </select>

        <div style={styles.divider} />

        {/* Text Formatting: Bold & Italic */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            execCmd('bold');
          }}
          style={{
            ...styles.toolBtn,
            ...(activeStates.bold ? styles.activeToolBtn : {})
          }}
          title="Bold (Ctrl+B)"
        >
          <b>B</b>
        </button>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            execCmd('italic');
          }}
          style={{
            ...styles.toolBtn,
            ...(activeStates.italic ? styles.activeToolBtn : {})
          }}
          title="Italic (Ctrl+I)"
        >
          <i>I</i>
        </button>

        <div style={styles.divider} />

        {/* Lists: Bulleted & Numbered */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            execCmd('insertUnorderedList');
          }}
          style={{
            ...styles.toolBtn,
            ...(activeStates.unorderedList ? styles.activeToolBtn : {})
          }}
          title="Bulleted List"
        >
          • List
        </button>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            execCmd('insertOrderedList');
          }}
          style={{
            ...styles.toolBtn,
            ...(activeStates.orderedList ? styles.activeToolBtn : {})
          }}
          title="Numbered List"
        >
          1. List
        </button>

        <div style={styles.divider} />

        {/* Links */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            handleInsertLink();
          }}
          style={styles.toolBtn}
          title="Insert Link"
        >
          Link
        </button>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            execCmd('unlink');
          }}
          style={styles.toolBtn}
          title="Remove Link"
        >
          Unlink
        </button>

        <div style={styles.divider} />

        {/* Undo / Redo */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            execCmd('undo');
          }}
          style={styles.toolBtn}
          title="Undo (Ctrl+Z)"
        >
          ↶
        </button>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            execCmd('redo');
          }}
          style={styles.toolBtn}
          title="Redo (Ctrl+Y)"
        >
          ↷
        </button>
      </div>

      {/* Editable Content Area */}
      <div style={{ position: 'relative', flex: 1, minHeight }}>
        {isEmpty && !isFocused && (
          <div style={styles.placeholder}>
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="scope-editor-content"
          onInput={handleInput}
          onKeyUp={updateStatus}
          onMouseUp={updateStatus}
          onFocus={() => {
            setIsFocused(true);
            updateStatus();
          }}
          onBlur={() => {
            setIsFocused(false);
            updateStatus();
          }}
          style={{
            ...styles.editorArea,
            minHeight
          }}
        />
      </div>

      {/* Bottom Status Bar */}
      <div style={styles.statusBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={styles.statusLabel}>Block:</span>
          <span style={styles.statusTagBadge}>&lt;{currentBlockTag || 'p'}&gt;</span>
        </div>
        <div style={styles.wordCount}>
          Words: {wordCount}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    background: '#ffffff',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#cbd5e1',
    borderRadius: '6px',
    display: 'flex',
    flexDirection: 'column',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    overflow: 'hidden'
  },
  toolbar: {
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    padding: '5px 8px',
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '4px'
  },
  blockSelect: {
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    padding: '3px 6px',
    fontSize: '12px',
    color: '#0f172a',
    fontWeight: '500',
    outline: 'none',
    cursor: 'pointer'
  },
  divider: {
    width: '1px',
    height: '16px',
    background: '#cbd5e1',
    margin: '0 3px'
  },
  toolBtn: {
    padding: '3px 7px',
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    color: '#0f172a',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    lineHeight: '1.2',
    transition: 'all 0.12s ease'
  },
  activeToolBtn: {
    background: '#e0f2fe',
    borderColor: '#0284c7',
    color: '#0284c7',
    boxShadow: 'inset 0 1px 2px rgba(2, 132, 199, 0.15)'
  },
  editorArea: {
    padding: '8px 12px',
    outline: 'none',
    fontSize: '13px',
    lineHeight: '1.55',
    color: '#0f172a',
    fontFamily: "'Poppins', system-ui, -apple-system, sans-serif"
  },
  placeholder: {
    position: 'absolute',
    top: '8px',
    left: '12px',
    color: '#94a3b8',
    fontSize: '13px',
    pointerEvents: 'none',
    userSelect: 'none'
  },
  statusBar: {
    background: '#f8fafc',
    borderTop: '1px solid #e2e8f0',
    padding: '3px 12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '11px',
    color: '#64748b'
  },
  statusLabel: {
    color: '#64748b',
    fontWeight: '500'
  },
  statusTagBadge: {
    fontFamily: 'monospace',
    textTransform: 'lowercase',
    color: '#0369a1',
    background: '#e0f2fe',
    padding: '1px 5px',
    borderRadius: '3px',
    fontWeight: 'bold'
  },
  wordCount: {
    color: '#64748b',
    fontWeight: '500'
  }
};
