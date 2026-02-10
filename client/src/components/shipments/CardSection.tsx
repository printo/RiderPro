import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface CardSectionProps {
  title?: string | React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}

export default function CardSection({
  title,
  icon,
  children,
  className,
  headerClassName,
  contentClassName
}: CardSectionProps) {
  return (
    <Card className={className}>
      <CardContent className={cn("p-4", contentClassName)}>
        {title && (
          <div className={cn("flex items-center gap-2 mb-4", headerClassName)}>
            {icon}
            {typeof title === 'string' ? (
              <h4 className="font-medium">{title}</h4>
            ) : (
              <div className="font-medium">{title}</div>
            )}
          </div>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

