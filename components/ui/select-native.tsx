import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SelectHTMLProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const SelectHTML = React.forwardRef<HTMLSelectElement, SelectHTMLProps>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  >
    {children}
  </select>
));
SelectHTML.displayName = 'SelectHTML';

export { SelectHTML };
