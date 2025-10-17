import React from "react";

type StandardPageProps = {
  title: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
  children: React.ReactNode;
};

export default function StandardPage({ title, subtitle, rightAction, children }: StandardPageProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            {subtitle ? (
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {rightAction ? <div className="ml-4 shrink-0">{rightAction}</div> : null}
        </div>
      </div>
      {children}
    </div>
  );
}


