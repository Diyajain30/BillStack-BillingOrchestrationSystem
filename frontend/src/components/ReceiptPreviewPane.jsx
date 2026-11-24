import React from 'react';

export default function ReceiptPreviewPane({ receiptImage, billNo }) {
  if (!receiptImage) {
    return (
      <div className="h-full min-h-[300px] flex flex-col items-center justify-center bg-sage-50/70 border border-dashed border-sage-300 rounded-xl p-6 text-center">
        <p className="text-sm font-medium text-stone-600">No Receipt Image Attached</p>
        <p className="text-xs text-stone-400 mt-1">
          Bills uploaded after this update will display the scanned invoice here for side-by-side verification.
        </p>
      </div>
    );
  }

  const isPdf =
    receiptImage.startsWith('data:application/pdf') ||
    receiptImage.toLowerCase().endsWith('.pdf');

  return (
    <div className="h-full flex flex-col bg-stone-50 border border-sage-200 rounded-xl overflow-hidden">
      <div className="px-3.5 py-2 bg-white border-b border-sage-100 flex items-center justify-between">
        <span className="text-xs font-semibold text-stone-700">
          Uploaded Bill Preview {billNo ? `(#${billNo})` : ''}
        </span>
        <a
          href={receiptImage}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-medium text-sage-700 hover:text-sage-900 underline"
        >
          Open Full Size
        </a>
      </div>

      <div className="flex-1 p-3 flex items-center justify-center overflow-auto max-h-[65vh] bg-stone-100/70">
        {isPdf ? (
          <iframe
            src={receiptImage}
            title={`Receipt ${billNo || ''}`}
            className="w-full h-[55vh] rounded border border-sage-200 bg-white"
          />
        ) : (
          <img
            src={receiptImage}
            alt={`Receipt ${billNo || ''}`}
            className="max-w-full max-h-[60vh] object-contain rounded shadow-sm bg-white"
          />
        )}
      </div>
    </div>
  );
}