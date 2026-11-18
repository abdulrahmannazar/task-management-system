import React from 'react';
import BlobLoader from './BlobLoader';

/**
 * ButtonLoader: Compact Organic Blob Loading Animation
 * Fits perfectly inside button boxes for creating, deleting, submitting, and saving.
 */
export default function ButtonLoader({ message = 'Saving...', size = 14, light = true }) {
  return <BlobLoader inline size={size} light={light} message={message} />;
}
