import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

describe('Button', () => {
  it('renders with default variant', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('handles click events', () => {
    let clicked = false;
    render(<Button onClick={() => { clicked = true; }}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(clicked).toBe(true);
  });

  it('can be disabled', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('renders different variants', () => {
    const { rerender } = render(<Button variant="destructive">Delete</Button>);
    let btn = screen.getByRole('button');
    expect(btn.className).toMatch(/destructive/);

    rerender(<Button variant="outline">Cancel</Button>);
    btn = screen.getByRole('button');
    expect(btn.className).toMatch(/border/);

    rerender(<Button variant="ghost">Ghost</Button>);
    btn = screen.getByRole('button');
    expect(btn.className).toMatch(/hover:bg-accent/);
  });

  it('renders different sizes', () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    let btn = screen.getByRole('button');
    expect(btn.className).toMatch(/h-8/);

    rerender(<Button size="lg">Large</Button>);
    btn = screen.getByRole('button');
    expect(btn.className).toMatch(/h-11/);
  });

  it('renders as child element when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/test">Link</a>
      </Button>
    );
    const link = screen.getByRole('link');
    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toBe('/test');
  });
});

describe('Badge', () => {
  it('renders text content', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('applies variant classes', () => {
    const { rerender } = render(<Badge variant="destructive">Error</Badge>);
    expect(screen.getByText('Error').className).toMatch(/destructive/);

    rerender(<Badge variant="success">OK</Badge>);
    expect(screen.getByText('OK').className).toMatch(/emerald/);
  });
});

describe('Card', () => {
  it('renders card with header, title and content', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>My Card</CardTitle>
        </CardHeader>
        <CardContent>Card body</CardContent>
      </Card>
    );
    expect(screen.getByText('My Card')).toBeInTheDocument();
    expect(screen.getByText('Card body')).toBeInTheDocument();
  });
});
