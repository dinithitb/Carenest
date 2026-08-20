'use client';

import React from 'react';

interface SlimBannerProps {
  title: string;
  subtitle?: React.ReactNode;
}

export default function SlimBanner({ title, subtitle }: SlimBannerProps) {
  return (
    <div className="mb-4 rounded-lg bg-white border border-gray-100 shadow-sm px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
